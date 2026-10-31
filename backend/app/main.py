import json
import logging
import threading
import time
from contextlib import asynccontextmanager
from datetime import timedelta
from typing import Annotated
from fastapi import FastAPI, Depends, HTTPException, Request, Response, UploadFile, Header, Query
from fastapi.responses import StreamingResponse
from fastapi.exceptions import RequestValidationError
from sqlalchemy import select, func, text
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from app import schemas as s, services, documents, onboarding, email_agent, agent, ollama, scheduler
from app import responses as out
from app import email_settings, journeys
from app.config import settings
from app.database import models as m
from app.database.session import db_session, Session
from app.security import current_user, require, verify_password, session_token, authorize
from app.seed import bootstrap


class JSONLog(logging.Formatter):
    def format(self, record):
        return json.dumps(
            {
                "time": m.now().isoformat(),
                "level": record.levelname,
                "message": record.getMessage(),
                "error_type": getattr(record, "error_type", None),
            }
        )


handler = logging.StreamHandler()
handler.setFormatter(JSONLog())
logging.getLogger("humain").addHandler(handler)
logging.getLogger("humain").setLevel(logging.INFO)


@asynccontextmanager
async def lifespan(app):
    with Session() as db:
        bootstrap(db)
        # Interrupted operations have durable outcomes, and are never silently repeated.
        for flow in db.scalars(select(m.AgentWorkflow).where(m.AgentWorkflow.state == "RUNNING")):
            flow.state = "FAILED"
            services.audit(db, None, "agent.interrupted", flow.id)
        for job in db.scalars(select(m.NotificationJob).where(m.NotificationJob.state == "SENDING")):
            job.state = "UNKNOWN"
            services.audit(db, None, "email.interrupted", job.id)
        for job in db.scalars(select(m.SchedulerJob).where(m.SchedulerJob.state == "RUNNING")):
            job.state = "FAILED"
            job.next_run = m.now() + timedelta(minutes=5)
        for journey in db.scalars(select(m.Journey).where(m.Journey.state == "RUNNING")):
            journey.state = "FAILED"
            journey.error = "The application restarted during this journey. Inspect persisted evidence and resume."
            services.audit(db, None, "journey.interrupted", journey.id)
        db.commit()
    stop = threading.Event()
    worker = threading.Thread(target=scheduler.loop, args=(stop,), daemon=True)
    if settings().scheduler_enabled:
        worker.start()
    yield
    stop.set()
    if worker.is_alive():
        worker.join(timeout=2)


app = FastAPI(title="HUMAIN Lifecycle · HUMAIN Chat", version="0.1.0", lifespan=lifespan)
DB = Annotated[object, Depends(db_session)]
Reader = Annotated[m.User, Depends(require("hr.read"))]
Writer = Annotated[m.User, Depends(require("hr.write"))]
DocumentWriter = Annotated[m.User, Depends(require("document.write"))]
EmailSender = Annotated[m.User, Depends(require("email.send"))]
Auditor = Annotated[m.User, Depends(require("audit.read"))]
Key = Annotated[str, Header(alias="Idempotency-Key", min_length=8, max_length=160)]


@app.exception_handler(RequestValidationError)
async def invalid_request(request, exc):
    from fastapi.responses import JSONResponse

    errors = [{"field": ".".join(str(p) for p in e["loc"]), "message": e["msg"]} for e in exc.errors()]
    return JSONResponse(
        status_code=422,
        content={"error": {"message": "; ".join(e["field"] + ": " + e["message"] for e in errors), "fields": errors}},
    )


@app.middleware("http")
async def request_policy(request, call_next):
    if request.method in {"POST", "PUT", "PATCH", "DELETE"}:
        if request.headers.get("X-Humain-Request") != "1":
            return Response(
                content=json.dumps({"error": {"message": "Missing application request header"}}),
                status_code=403,
                media_type="application/json",
            )
        origin = request.headers.get("origin")
        if origin and origin not in {
            "http://127.0.0.1:5173",
            "http://localhost:5173",
            "http://127.0.0.1:8000",
            "http://127.0.0.1:5180",
        }:
            return Response(status_code=403)
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "same-origin"
    response.headers["Cache-Control"] = "no-store"
    return response


@app.exception_handler(HTTPException)
async def http_error(request, exc):
    from fastapi.responses import JSONResponse

    return JSONResponse(status_code=exc.status_code, content={"error": {"message": exc.detail}})


@app.exception_handler(IntegrityError)
async def conflict(request, exc):
    from fastapi.responses import JSONResponse

    return JSONResponse(
        status_code=409,
        content={
            "error": {"message": "A conflicting record already exists; inspect the current state before retrying"}
        },
    )


@app.exception_handler(SQLAlchemyError)
async def database_error(request, exc):
    from fastapi.responses import JSONResponse

    logging.getLogger("humain").error("Database request failed", extra={"error_type": type(exc).__name__})
    return JSONResponse(
        status_code=503, content={"error": {"message": "Database request failed. No success was recorded."}}
    )


@app.exception_handler(ollama.ModelUnavailable)
async def model_error(request, exc):
    from fastapi.responses import JSONResponse

    return JSONResponse(status_code=503, content={"error": {"message": str(exc)}})


attempts = {}


@app.post("/api/auth/login")
def login(data: s.Login, request: Request, response: Response, db: DB):
    ip = request.client.host
    recent = [t for t in attempts.get(ip, []) if time.monotonic() - t < 60]
    if len(recent) >= 8:
        raise HTTPException(429, "Too many sign-in attempts; retry in one minute")
    user = db.scalar(select(m.User).where(m.User.username == data.username, m.User.active.is_(True)))
    if not user or not verify_password(data.password, user.password_hash):
        attempts[ip] = recent + [time.monotonic()]
        raise HTTPException(401, "Incorrect username or password")
    response.set_cookie("humain_session", session_token(user), httponly=True, samesite="strict", max_age=28800)
    services.audit(db, user, "auth.login")
    db.commit()
    return {"id": user.id, "username": user.username}


@app.post("/api/auth/logout")
def logout(response: Response):
    response.delete_cookie("humain_session")
    return {"signed_out": True}


@app.get("/api/auth/me")
def me(user=Depends(current_user)):
    return {"id": user.id, "username": user.username}


@app.get("/api/health", response_model=out.HealthOut)
def health():
    return {"status": "ok", "service": "HUMAIN Lifecycle"}


@app.get("/api/health/database", response_model=out.DatabaseHealthOut)
def database_health(db: DB):
    version = db.scalar(text("SHOW server_version"))
    migration = db.scalar(text("SELECT version_num FROM alembic_version"))
    return {"connected": True, "version": version, "migration": migration}


@app.get("/api/health/ollama", response_model=out.OllamaHealthOut)
def ollama_health():
    return ollama.health()


@app.get("/api/dashboard")
def dashboard(db: DB, user: Reader):
    return services.dashboard(db)


def page(db, model, conditions=(), offset=0, limit=25):
    return {
        "items": [
            services.row(x)
            for x in db.scalars(
                select(model).where(*conditions).order_by(model.created_at.desc()).offset(offset).limit(limit)
            )
        ],
        "total": db.scalar(select(func.count()).select_from(model).where(*conditions)),
        "offset": offset,
        "limit": limit,
    }


@app.get("/api/employees", response_model=out.PageOut[out.EmployeeOut])
def employees(
    db: DB,
    user: Reader,
    q: str = "",
    department_id: str | None = None,
    profession: str | None = None,
    workforce_only: bool = False,
    offset: int = Query(0, ge=0),
    limit: int = Query(25, ge=1, le=100),
):
    conditions = [m.Employee.deleted_at.is_(None)]
    if profession is not None:
        conditions.append(m.Employee.profession == profession)
    if workforce_only:
        conditions.append(m.Employee.status != "inactive")
    if q:
        pattern = "%" + q.replace("%", "\\%").replace("_", "\\_") + "%"
        conditions.append(
            m.Employee.name.ilike(pattern)
            | m.Employee.employee_number.ilike(pattern)
            | m.Employee.profession.ilike(pattern)
        )
    if department_id:
        conditions.append(m.Employee.department_id == department_id)
    return page(db, m.Employee, conditions, offset, limit)


@app.post("/api/employees", response_model=out.EmployeeOut)
def add_employee(data: s.EmployeeInput, db: DB, user: Writer, idempotency_key: Key):
    return services.row(services.create_employee(db, data, idempotency_key, user))


@app.post("/api/employees/import")
async def import_roster(
    file: UploadFile, db: DB, user: Writer, synthetic: bool = True, confirm_authorized: bool = False
):
    from app.adapters import roster

    content = await file.read(8 * 1024 * 1024 + 1)
    preview = roster.parse(content, file.filename or "", synthetic)
    if not confirm_authorized:
        return preview
    return roster.apply(db, preview, user)


@app.get("/api/employees/{id}")
def employee(id: str, db: DB, user: Reader):
    obj = services.get(db, m.Employee, id)
    return {
        **services.row(obj),
        "contracts": page(db, m.Contract, [m.Contract.employee_id == id])["items"],
        "tasks": page(db, m.HRTask, [m.HRTask.employee_id == id])["items"],
    }


@app.put("/api/employees/{id}")
def edit_employee(id: str, data: s.EmployeeInput, db: DB, user: Writer):
    obj = services.get(db, m.Employee, id)
    for key, value in data.model_dump().items():
        setattr(obj, key, value)
    services.audit(db, user, "employee.updated", id)
    db.commit()
    return services.row(obj)


@app.delete("/api/employees/{id}")
def archive_employee(id: str, db: DB, user: Writer):
    obj = services.get(db, m.Employee, id)
    obj.deleted_at = m.now()
    services.audit(db, user, "employee.archived", id)
    db.commit()
    return {"archived": True}


@app.get("/api/departments")
def departments(db: DB, user: Reader):
    return page(db, m.Department)


@app.get("/api/contracts", response_model=out.PageOut[out.ContractOut])
def contracts(db: DB, user: Reader, offset: int = Query(0, ge=0), limit: int = Query(25, ge=1, le=100)):
    return page(db, m.Contract, offset=offset, limit=limit)


@app.get("/api/documents", response_model=out.PageOut[out.DocumentOut])
def document_list(db: DB, user: Reader, offset: int = Query(0, ge=0), limit: int = Query(25, ge=1, le=100)):
    return page(db, m.ContractDocument, offset=offset, limit=limit)


@app.post("/api/documents")
async def upload(file: UploadFile, db: DB, user: DocumentWriter):
    content = await file.read(8 * 1024 * 1024 + 1)
    return services.row(documents.ingest(db, file.filename or "", content, user))


@app.get("/api/documents/{id}/download")
def download(id: str, db: DB, user: Reader):
    doc = services.get(db, m.ContractDocument, id)
    return Response(
        doc.content,
        media_type=doc.content_type,
        headers={
            "Content-Disposition": 'attachment; filename="contract'
            + (
                ".pdf"
                if doc.content_type == "application/pdf"
                else ".xlsx"
                if "spreadsheet" in doc.content_type
                else ".csv"
            )
            + '"'
        },
    )


@app.post("/api/documents/{id}/extract")
def extract(id: str, db: DB, user: DocumentWriter):
    return documents.extract(db, id, user)


@app.put("/api/documents/{id}/review")
def review(id: str, data: s.ContractFields, db: DB, user=Depends(require("approval.review"))):
    return documents.review(db, id, data, user)


@app.get("/api/onboarding")
def onboardings(db: DB, user: Reader, offset: int = Query(0, ge=0), limit: int = Query(25, ge=1, le=100)):
    p = page(db, m.OnboardingWorkflow, [m.OnboardingWorkflow.archived_at.is_(None)], offset=offset, limit=limit)
    p["items"] = [onboarding.result(db, db.get(m.OnboardingWorkflow, x["id"])) for x in p["items"]]
    return p


@app.post("/api/onboarding/{id}/archive")
def archive_onboarding(id: str, db: DB, user: Writer):
    workflow = services.get(db, m.OnboardingWorkflow, id)
    services.lock(db, "onboard:" + workflow.document_id)
    db.refresh(workflow)
    if not workflow.archived_at:
        workflow.archived_at = m.now()
        services.audit(db, user, "onboarding.archived", id)
        db.commit()
    return {"archived": True}


@app.post("/api/onboarding")
def onboard(data: s.OnboardInput, db: DB, user: Writer):
    for permission in ["document.write", "email.send"]:
        authorize(db, user, permission)
    return onboarding.run(db, data.document_id, user)


@app.post("/api/onboarding/{id}/cancel")
def cancel(id: str, db: DB, user: Writer):
    return onboarding.cancel(db, id, user)


@app.get("/api/tasks")
def tasks(db: DB, user: Reader, offset: int = Query(0, ge=0), limit: int = Query(25, ge=1, le=100)):
    return page(db, m.HRTask, offset=offset, limit=limit)


@app.post("/api/tasks")
def add_task(data: s.TaskInput, db: DB, user: Writer, idempotency_key: Key):
    obj = services.task(db, data, idempotency_key, user)
    db.commit()
    return services.row(obj)


@app.post("/api/tasks/{id}/complete")
def complete_task(id: str, db: DB, user: Writer):
    obj = services.get(db, m.HRTask, id)
    if obj.simulated:
        raise HTTPException(
            409, "Simulated provisioning is a demo request and cannot be marked as a real provisioned account"
        )
    obj.status = "completed"
    services.audit(db, user, "task.completed", id)
    db.commit()
    return services.row(obj)


@app.get("/api/compliance")
def compliance(db: DB, user: Reader, days: int = Query(30, ge=0, le=365), kind: str = "all"):
    return {"alerts": services.deadlines(db, days, kind)}


@app.post("/api/compliance/scan")
def scan(db: DB, user: Writer):
    return {"alerts": services.scan_compliance(db, user, email_settings.effective(db).alert_window_days)}


@app.get("/api/saudization")
def saudization(db: DB, user: Reader):
    return services.saudization(db)


@app.get("/api/communications")
def communications(db: DB, user: Reader):
    return email_agent.overview(db)


@app.post("/api/communications/prepare")
def prepare(data: s.EmailInput, db: DB, user: EmailSender):
    return services.row(email_agent.prepare(db, data, user))


@app.post("/api/communications/{id}/send")
def send(id: str, db: DB, user: EmailSender):
    return email_agent.send(db, id, user)


@app.post("/api/communications/{id}/review")
def review_email_policy(id: str, db: DB, user=Depends(require("approval.review"))):
    authorize(db, user, "email.send")
    return email_agent.review_prepared_job(db, id, user)


@app.post("/api/communications/reminders/run")
def reminders(data: s.DeadlineInput, db: DB, user: EmailSender):
    return email_agent.reminders(db, data.days, user, data.kind)


@app.get("/api/agent/conversations")
def conversations(db: DB, user=Depends(current_user)):
    return page(
        db, m.AgentConversation,
        [m.AgentConversation.user_id == user.id, m.AgentConversation.deleted_at.is_(None)], limit=100,
    )


@app.post("/api/agent/conversations")
def new_conversation(db: DB, user=Depends(current_user)):
    obj = m.AgentConversation(user_id=user.id)
    db.add(obj)
    db.commit()
    return services.row(obj)


@app.get("/api/agent/conversations/{id}", response_model=out.ConversationOut)
def conversation(id: str, db: DB, user=Depends(current_user)):
    obj = services.get(db, m.AgentConversation, id)
    if obj.user_id != user.id:
        raise HTTPException(403, "Conversation access denied")
    if obj.deleted_at:
        raise HTTPException(404, "Chat has been deleted")
    flows = db.scalars(
        select(m.AgentWorkflow).where(m.AgentWorkflow.conversation_id == id).order_by(m.AgentWorkflow.created_at.desc())
    ).all()
    return {
        **services.row(obj),
        "messages": [
            services.row(x)
            for x in db.scalars(
                select(m.AgentMessage).where(m.AgentMessage.conversation_id == id).order_by(m.AgentMessage.created_at)
            )
        ],
        "workflows": [services.row(f) for f in flows],
        "tools": [
            services.row(t)
            for t in db.scalars(
                select(m.AgentToolExecution)
                .join(m.AgentWorkflow)
                .where(m.AgentWorkflow.conversation_id == id)
                .order_by(m.AgentToolExecution.created_at)
            )
        ],
    }


@app.delete("/api/agent/conversations/{id}")
def delete_conversation(id: str, db: DB, user=Depends(current_user)):
    services.lock(db, "chat:" + id)
    obj = services.get(db, m.AgentConversation, id)
    if obj.user_id != user.id:
        raise HTTPException(403, "Conversation access denied")
    if obj.deleted_at:
        return {"deleted": True}
    if db.scalar(select(m.AgentWorkflow).where(
        m.AgentWorkflow.conversation_id == id, m.AgentWorkflow.state == "RUNNING",
    )):
        raise HTTPException(409, "Wait for this chat's running request to finish before deleting it")
    obj.deleted_at = m.now()
    services.audit(db, user, "conversation.deleted", id)
    db.commit()
    return {"deleted": True}


@app.post("/api/agent/chat")
def chat(data: s.ChatInput, db: DB, user: Reader):
    conversation = services.get(db, m.AgentConversation, data.conversation_id)
    if conversation.user_id != user.id:
        raise HTTPException(403, "Conversation access denied")
    if conversation.deleted_at:
        raise HTTPException(404, "Chat has been deleted")
    return StreamingResponse(
        agent.run_chat(data, user.id), media_type="text/event-stream", headers={"X-Accel-Buffering": "no"}
    )


@app.get("/api/agent/tools")
def tools(user: Reader):
    return {
        "tools": [{"name": name, "permission": p, "description": desc} for name, (_, p, desc) in agent.REGISTRY.items()]
    }


@app.get("/api/agent/workflows")
def workflows(db: DB, user: Auditor):
    return page(db, m.AgentWorkflow, limit=100)


@app.get("/api/audit")
def audit(db: DB, user: Auditor, offset: int = Query(0, ge=0), limit: int = Query(25, ge=1, le=100), q: str = ""):
    return page(db, m.AuditEvent, [m.AuditEvent.action.ilike("%" + q + "%")] if q else [], offset, limit)


@app.get("/api/approvals")
def approvals(db: DB, user=Depends(require("approval.review"))):
    return page(db, m.ApprovalRequest)


@app.get("/api/settings")
def get_settings(db: DB, user: Reader):
    cfg = settings().model_copy(
        update={k: v for k, v in email_settings.public(db).items() if k != "password_configured"}
    )
    return {
        "ollama_model": cfg.ollama_model,
        "ollama_url": cfg.ollama_url,
        "smtp_mode": cfg.smtp_mode,
        "smtp_host": cfg.smtp_host,
        "smtp_port": cfg.smtp_port,
        "real_email_authorized": cfg.real_email_authorized,
        "alert_window_days": cfg.alert_window_days,
        "scheduler_enabled": cfg.scheduler_enabled,
        "scheduler": page(db, m.SchedulerJob)["items"],
        "policy": "Routine HR operations only. Contract signing, salary changes, termination and real IT provisioning are unavailable. Email preferences apply immediately from Settings; database and model configuration remain in the local environment.",
    }


@app.get("/api/evaluation")
def evaluation(db: DB, user: Auditor):
    flows = db.scalars(select(m.AgentWorkflow)).all()
    tools = db.scalars(select(m.AgentToolExecution)).all()
    onboard = db.scalars(select(m.OnboardingWorkflow)).all()
    accepted = db.scalar(
        select(func.count()).select_from(m.NotificationJob).where(m.NotificationJob.state == "SMTP_ACCEPTED")
    )
    return {
        "agent_runs": len(flows),
        "agent_completed": sum(f.state == "COMPLETED" for f in flows),
        "mean_latency_ms": round(sum(f.elapsed_ms or 0 for f in flows) / len(flows)) if flows else None,
        "tool_executions": len(tools),
        "tools_succeeded": sum(t.status == "success" for t in tools),
        "onboarding_runs": len(onboard),
        "onboarding_completed": sum(f.state == "COMPLETED" for f in onboard),
        "human_interventions": db.scalar(select(func.count()).select_from(m.ApprovalRequest)),
        "smtp_accepted_jobs": accepted,
        "manual_baseline_seconds": None,
        "time_saved_seconds": None,
        "extraction_accuracy": None,
        "note": "Only measured database counts and recorded latency. Complete the manual baseline and labeled extraction benchmark before claiming time savings or accuracy.",
    }


@app.get("/api/settings/email")
def get_email_settings(db: DB, user=Depends(require("settings.write"))):
    return email_settings.public(db)


@app.put("/api/settings/email")
def update_email_settings(data: s.EmailSettingsInput, db: DB, user=Depends(require("settings.write"))):
    authorize(db, user, "email.send")
    return email_settings.save(db, data, user)


@app.get("/api/journeys")
def journey_list(db: DB, user: Reader):
    return {
        "items": [
            journeys.result(db, j)
            for j in db.scalars(select(m.Journey).order_by(m.Journey.created_at.desc()).limit(100))
        ]
    }


@app.post("/api/journeys")
def start_journey(data: s.JourneyInput, db: DB, user: Writer):
    for permission in ["document.write", "email.send"]:
        authorize(db, user, permission)
    return journeys.start(db, data, user)


@app.get("/api/journeys/{id}")
def journey_detail(id: str, db: DB, user: Reader):
    return journeys.result(db, services.get(db, m.Journey, id))


@app.post("/api/journeys/{id}/resume")
def resume_journey(id: str, db: DB, user: Writer):
    for permission in ["document.write", "email.send"]:
        authorize(db, user, permission)
    return journeys.run(db, id, user)


@app.post("/api/journeys/{id}/exception")
def journey_exception(id: str, data: s.DecisionInput, db: DB, user=Depends(require("approval.review"))):
    for permission in ["hr.write", "document.write", "email.send"]:
        authorize(db, user, permission)
    return journeys.accept_exception(db, id, data.note, user)


@app.put("/api/journeys/{id}/measurement")
def journey_measurement(id: str, data: s.MeasurementInput, db: DB, user: Auditor):
    authorize(db, user, "hr.write")
    return journeys.measure(db, id, data, user)


@app.get("/api/exceptions")
def exceptions(db: DB, user=Depends(require("approval.review"))):
    authorize(db, user, "hr.read")
    return journeys.inbox(db)


@app.get("/api/policies")
def company_policies(db: DB, user: Reader):
    return {
        "items": [
            services.row(p)
            for p in db.scalars(select(m.CompanyPolicy).order_by(m.CompanyPolicy.created_at.desc()).limit(100))
        ]
    }


@app.post("/api/policies")
def new_company_policy(data: s.CompanyPolicyInput, db: DB, user=Depends(require("settings.write"))):
    return journeys.create_policy(db, data, user)


@app.post("/api/policies/{id}/activate")
def activate_company_policy(id: str, data: s.PolicyActivationInput, db: DB, user=Depends(require("approval.review"))):
    authorize(db, user, "settings.write")
    return journeys.activate_policy(db, id, user, data.active)


@app.post("/api/settings/email/test")
def test_email_connection(db: DB, user=Depends(require("settings.write"))):
    authorize(db, user, "email.send")
    return email_settings.test_connection(db, user)


@app.put("/api/journeys/{id}/review")
def review_journey_contract(id: str, data: s.ContractFields, db: DB, user=Depends(require("approval.review"))):
    for permission in ["hr.write", "document.write", "email.send"]:
        authorize(db, user, permission)
    journey = services.get(db, m.Journey, id)
    if journey.state in {"RUNNING", "VERIFIED"}:
        raise HTTPException(409, "This journey cannot be reviewed in its current state")
    reviewed = documents.review(db, journey.document_id, data, user)
    if not reviewed["valid"]:
        return {"journey": journeys.result(db, journey), "review": reviewed}
    return {"journey": journeys.run(db, id, user, human_resume=False), "review": reviewed}
