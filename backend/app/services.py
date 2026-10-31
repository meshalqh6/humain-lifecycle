"""Transactional HR services. No network side effects inside database transactions."""

import hashlib
from datetime import datetime, timezone, timedelta
import pandas as pd
from fastapi import HTTPException
from sqlalchemy import select, text, func
from app.database import models as m
from app.schemas import EmployeeInput, TaskInput
from app.adapters import sadiah


def today():
    return (datetime.now(timezone.utc) + timedelta(hours=3)).date()


def lock(db, key):
    value = int.from_bytes(hashlib.sha256(key.encode()).digest()[:8], "big", signed=True)
    db.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": value})


def audit(db, actor, action, object_id=None, **detail):
    event = m.AuditEvent(actor_id=actor.id if actor else None, action=action, object_id=object_id, detail=detail)
    db.add(event)
    return event


def row(obj):
    return {
        c.name: getattr(obj, c.name)
        for c in obj.__table__.columns
        if c.name not in {"password_hash", "idempotency_key"}
        and not (isinstance(obj, m.ContractDocument) and c.name == "content")
    }


def get(db, model, id):
    obj = db.get(model, id)
    if obj is None:
        raise HTTPException(404, "Record not found")
    return obj


def create_employee(db, data: EmployeeInput, key, actor):
    lock(db, "employee:" + data.employee_number)
    existing = db.scalar(select(m.Employee).where(m.Employee.idempotency_key == key))
    if existing:
        if any(getattr(existing, k) != v for k, v in data.model_dump().items()):
            raise HTTPException(409, "Idempotency key already used with different input")
        db.commit()
        return existing
    if db.scalar(select(m.Employee).where(m.Employee.employee_number == data.employee_number)):
        raise HTTPException(409, "Employee number already exists; review the existing profile")
    employee = m.Employee(**data.model_dump(), idempotency_key=key)
    db.add(employee)
    db.flush()
    audit(db, actor, "employee.created", employee.id, synthetic=data.synthetic)
    db.commit()
    return employee


def task(db, data: TaskInput, key, actor, workflow_id=None, simulated=False):
    lock(db, "task:" + key)
    existing = db.scalar(select(m.HRTask).where(m.HRTask.idempotency_key == key))
    if existing:
        return existing
    get(db, m.Employee, data.employee_id)
    obj = m.HRTask(**data.model_dump(), idempotency_key=key, workflow_id=workflow_id, simulated=simulated)
    db.add(obj)
    db.flush()
    audit(db, actor, "task.created", obj.id, simulated=simulated)
    return obj


def workforce(db):
    return db.scalars(
        select(m.Employee)
        .where(m.Employee.deleted_at.is_(None), m.Employee.status != "inactive")
        .order_by(m.Employee.name)
    ).all()


def saudization(db):
    frame = pd.DataFrame(
        [{"Nationality": e.nationality, "Profession": e.profession} for e in workforce(db)],
        columns=["Nationality", "Profession"],
    )
    return sadiah.compute_saudization(
        frame,
        {
            "nationality_column": "Nationality",
            "profession_column": "Profession",
            "saudi_nationality_values": [
                "Saudi",
                "Saudi Arabia",
                "Saudi Arabian",
                "KSA",
                "سعودي",
                "سعودية",
                "السعودية",
                "سعودى",
                "SA",
                "Ø³Ø¹ÙˆØ¯ÙŠ",
                "Ø³Ø¹ÙˆØ¯ÙŠØ©",
                "Ø§Ù„Ø³Ø¹ÙˆØ¯ÙŠØ©",
            ],
        },
    )


def deadlines(db, days=30, kind="all"):
    # Reuse original logic, injecting the explicitly selected Riyadh calendar date.
    employees = workforce(db)
    names = {e.id: e for e in employees}
    records = [
        {"Employee Name": e.id, "Iqama Expiry Date": e.iqama_expiry, "Work Permit Expiry": e.work_permit_expiry}
        for e in employees
    ]
    for contract in db.scalars(select(m.Contract).where(m.Contract.status == "active")):
        if contract.employee_id in names:
            records.append({"Employee Name": contract.employee_id, "Contract End Date": contract.end_date})
    fieldmap = {"Contract End Date": "contract", "Iqama Expiry Date": "iqama", "Work Permit Expiry": "work_permit"}
    # Original code references global date; copy the function with a private globals dictionary, without mutation.
    import types

    class RiyadhDate:
        @staticmethod
        def today():
            return today()

    fn = types.FunctionType(sadiah.find_expiring.__code__, {**sadiah.find_expiring.__globals__, "date": RiyadhDate})
    alerts = fn(
        pd.DataFrame(records),
        {"name_column": "Employee Name", "date_columns_to_check": list(fieldmap), "alert_window_days": days},
    )
    return sorted(
        [
            {
                "employee_id": a["name"],
                "name": names[a["name"]].name,
                "kind": fieldmap[a["field"]],
                "due_date": a["date"].isoformat(),
                "days_left": a["days_left"],
                "expired": a["expired"],
            }
            for a in alerts
            if kind == "all" or fieldmap[a["field"]] == kind
        ],
        key=lambda a: a["days_left"],
    )


def scan_compliance(db, actor, days=30):
    alerts = deadlines(db, days)
    lock(db, "compliance:scan")
    active = {(a["employee_id"], a["kind"], a["due_date"]) for a in alerts}
    for old in db.scalars(select(m.ComplianceAlert).where(m.ComplianceAlert.status == "open")):
        if (old.employee_id, old.kind, old.due_date.isoformat()) not in active:
            old.status = "resolved"
    for a in alerts:
        existing = db.scalar(
            select(m.ComplianceAlert).where(
                m.ComplianceAlert.employee_id == a["employee_id"],
                m.ComplianceAlert.kind == a["kind"],
                m.ComplianceAlert.due_date == datetime.fromisoformat(a["due_date"]).date(),
            )
        )
        if not existing:
            db.add(
                m.ComplianceAlert(
                    employee_id=a["employee_id"], kind=a["kind"], due_date=datetime.fromisoformat(a["due_date"]).date()
                )
            )
        else:
            existing.status = "open"
    audit(db, actor, "compliance.scanned", count=len(alerts), window=days)
    db.commit()
    return alerts


def dashboard(db):
    deadline_window_days = 90
    ratio = saudization(db)
    counts = {
        name: db.scalar(select(func.count()).select_from(model).where(*conditions))
        for name, model, conditions in [
            ("headcount", m.Employee, [m.Employee.deleted_at.is_(None), m.Employee.status != "inactive"]),
            ("onboarding", m.OnboardingWorkflow, [m.OnboardingWorkflow.archived_at.is_(None), m.OnboardingWorkflow.state.notin_(["COMPLETED", "CANCELLED"])]),
            ("completed_workflows", m.OnboardingWorkflow, [m.OnboardingWorkflow.state == "COMPLETED"]),
            ("pending_tasks", m.HRTask, [m.HRTask.status == "pending"]),
            ("smtp_accepted", m.NotificationJob, [m.NotificationJob.state == "SMTP_ACCEPTED"]),
        ]
    }
    return {
        **counts,
        "saudization": ratio,
        "deadline_window_days": deadline_window_days,
        "alerts": deadlines(db, deadline_window_days),
        "recent_actions": [
            row(x) for x in db.scalars(select(m.AuditEvent).order_by(m.AuditEvent.created_at.desc()).limit(8))
        ],
        "tasks": [row(x) for x in db.scalars(select(m.HRTask).where(m.HRTask.status == "pending").limit(8))],
    }
