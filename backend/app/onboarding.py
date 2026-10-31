from sqlalchemy import select
from datetime import date
from fastapi import HTTPException
from app import documents, email_agent
from app.database import models as m
from app.schemas import EmployeeInput, TaskInput, EmailInput
from app.services import get, lock, audit, task, today, row

STEP_NAMES = (
    "Extract contract",
    "Validate information",
    "Create employee",
    "Generate HR tasks",
    "Simulate IT requests",
    "Send welcome email",
    "Verify outcome",
)


def run(db, document_id, actor):
    # Extraction commits independently, so model failures cannot roll back a previously imported employee.
    extraction = documents.extract(db, document_id, actor)
    from app.journeys import policy_gate

    policy_gate(db, document_id, extraction["fields"])
    lock(db, "onboard:" + document_id)
    workflow = db.scalar(select(m.OnboardingWorkflow).where(m.OnboardingWorkflow.document_id == document_id))
    if not workflow:
        workflow = m.OnboardingWorkflow(
            document_id=document_id, state="DOCUMENT_RECEIVED", idempotency_key="onboard:" + document_id
        )
        db.add(workflow)
        db.flush()
        for index, name in enumerate(STEP_NAMES):
            db.add(
                m.OnboardingStep(workflow_id=workflow.id, name=name, status="completed" if index == 0 else "pending")
            )
        audit(db, actor, "onboarding.created", workflow.id)
    if workflow.state == "COMPLETED":
        db.commit()
        return result(db, workflow)
    if workflow.state == "CANCELLED":
        raise HTTPException(409, "Cancelled workflows cannot be restarted")
    if not extraction["valid"]:
        workflow.state = "AWAITING_REVIEW"
        workflow.error = "Resolve extraction validation issues before onboarding"
        if not db.scalar(
            select(m.ApprovalRequest).where(
                m.ApprovalRequest.workflow_id == workflow.id, m.ApprovalRequest.state == "pending"
            )
        ):
            db.add(
                m.ApprovalRequest(
                    workflow_id=workflow.id,
                    requested_by=actor.id,
                    action="contract.review",
                    detail={"issues": extraction["issues"]},
                )
            )
        audit(db, actor, "onboarding.awaiting_review", workflow.id)
        db.commit()
        return result(db, workflow)
    f = extraction["fields"]
    lock(db, "employee:" + f["employee_number"])
    employee = db.scalar(select(m.Employee).where(m.Employee.employee_number == f["employee_number"]))
    if employee and workflow.employee_id != employee.id:
        workflow.state = "AWAITING_REVIEW"
        workflow.error = "Employee number already exists; duplicate creation blocked"
        audit(db, actor, "onboarding.duplicate_blocked", workflow.id)
        db.commit()
        return result(db, workflow)
    if not employee:
        values = EmployeeInput(
            employee_number=f["employee_number"],
            name=f["employee_name"],
            nationality=f["nationality"],
            profession=f.get("occupation") or f.get("job_title") or "Unspecified",
            email=f["email"],
            iqama_expiry=f.get("iqama_expiry"),
            work_permit_expiry=f.get("work_permit_expiry"),
            synthetic=f.get("synthetic", False),
            status="onboarding",
        )
        employee = m.Employee(**values.model_dump(), idempotency_key="document:" + document_id)
        db.add(employee)
        db.flush()
        workflow.employee_id = employee.id
        db.add(
            m.Contract(
                employee_id=employee.id,
                document_id=document_id,
                start_date=date.fromisoformat(f["start_date"]),
                end_date=date.fromisoformat(f["end_date"]),
                salary=f.get("salary"),
                employer=f.get("employer"),
            )
        )
        audit(db, actor, "employee.created", employee.id, workflow_id=workflow.id, synthetic=employee.synthetic)
    for title, simulated in [
        ("Verify identity and Qiwa approval", False),
        ("Collect onboarding documents", False),
        ("Schedule orientation", False),
        ("IT account provisioning request (simulated)", True),
        ("IT equipment request (simulated)", True),
    ]:
        task(
            db,
            TaskInput(employee_id=employee.id, title=title, due_date=today()),
            "onboard:" + workflow.id + ":" + title,
            actor,
            workflow.id,
            simulated,
        )
    workflow.state = "RUNNING"
    workflow.error = None
    for step in db.scalars(select(m.OnboardingStep).where(m.OnboardingStep.workflow_id == workflow.id)):
        if step.name not in {"Send welcome email", "Verify outcome"}:
            step.status = "completed"
            step.result = {"simulated": step.name == "Simulate IT requests"}
    audit(db, actor, "onboarding.records_committed", workflow.id, employee_id=employee.id)
    db.commit()  # employee, contract and tasks are durable before email
    job = email_agent.prepare(db, EmailInput(employee_id=employee.id, template_code="welcome"), actor)
    outcome = (
        email_agent.send(db, job.id, actor)
        if job.state not in {"AWAITING_REVIEW", "UNKNOWN", "SENDING"}
        else {"status": job.state}
    )
    workflow = get(db, m.OnboardingWorkflow, workflow.id)
    verified = (
        db.scalar(select(m.Contract).where(m.Contract.document_id == document_id)) is not None
        and len(db.scalars(select(m.HRTask).where(m.HRTask.workflow_id == workflow.id)).all()) == 5
    )
    # Completion refers to automation setup, not all human onboarding tasks being finished.
    workflow.state = (
        "COMPLETED"
        if verified and outcome["status"] == "SMTP_ACCEPTED"
        else "AWAITING_REVIEW"
        if outcome["status"] in {"UNKNOWN", "SENDING", "AWAITING_REVIEW"}
        else "FAILED"
    )
    workflow.error = (
        None
        if workflow.state == "COMPLETED"
        else "Employee and tasks persisted; welcome email requires review or retry"
    )
    for step in db.scalars(select(m.OnboardingStep).where(m.OnboardingStep.workflow_id == workflow.id)):
        if step.name == "Send welcome email":
            step.status = "completed" if outcome["status"] == "SMTP_ACCEPTED" else "pending"
            step.result = outcome
        if step.name == "Verify outcome":
            step.status = "completed" if verified else "failed"
            step.result = {
                "database_verified": verified,
                "human_tasks_remaining": True,
                "it_provisioning": "simulated only",
            }
    audit(db, actor, "onboarding." + workflow.state.lower(), workflow.id, database_verified=verified)
    db.commit()
    return result(db, workflow)


def result(db, workflow):
    steps = db.scalars(
        select(m.OnboardingStep)
        .where(m.OnboardingStep.workflow_id == workflow.id)
        .order_by(m.OnboardingStep.created_at, m.OnboardingStep.id)
    ).all()
    # Creation timestamps may tie; the workflow definition determines display order.
    positions = {name: index for index, name in enumerate(STEP_NAMES)}
    steps.sort(key=lambda step: positions.get(step.name, len(STEP_NAMES)))
    return {
        **row(workflow),
        "employee": row(get(db, m.Employee, workflow.employee_id)) if workflow.employee_id else None,
        "steps": [row(step) for step in steps],
    }


def cancel(db, id, actor):
    workflow = get(db, m.OnboardingWorkflow, id)
    if workflow.state == "COMPLETED":
        raise HTTPException(409, "Completed workflows cannot be cancelled")
    workflow.state = "CANCELLED"
    audit(db, actor, "onboarding.cancelled", id)
    db.commit()
    return result(db, workflow)
