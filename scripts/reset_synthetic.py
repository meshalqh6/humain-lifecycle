"""Explicit synthetic-only reset. Preserves audit records, source files and Docker volumes."""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
from app.config import settings
from app.database import models as m
from app.database.session import Session
from app.email_settings import effective
from app.services import audit
from sqlalchemy import delete, select

parser = argparse.ArgumentParser()
parser.add_argument("--confirm", choices=["RESET_SYNTHETIC"], required=True)
parser.parse_args()
if (
    settings().smtp_mode != "sandbox"
    or not settings().database_url.get_secret_value().endswith("/humain_lifecycle")
):
    sys.exit("Reset is restricted to the local sandbox development database")
with Session() as db:
    if effective(db).smtp_mode != "sandbox":
        sys.exit(
            "Reset is restricted to effective sandbox mode; no records were changed"
        )
    ids = list(db.scalars(select(m.Employee.id).where(m.Employee.synthetic.is_(True))))
    workflows = list(
        db.scalars(
            select(m.OnboardingWorkflow.id).where(
                m.OnboardingWorkflow.employee_id.in_(ids)
            )
        )
    )
    jobs = list(
        db.scalars(
            select(m.NotificationJob.id).where(m.NotificationJob.employee_id.in_(ids))
        )
    )
    document_ids = list(
        db.scalars(
            select(m.OnboardingWorkflow.document_id).where(
                m.OnboardingWorkflow.id.in_(workflows)
            )
        )
    )
    for journey in db.scalars(
        select(m.Journey).where(m.Journey.document_id.in_(document_ids))
    ):
        journey.state = "READY"
        journey.error = "Synthetic employee records were reset. Resume to prepare this contract again."
        journey.outcome = {}
        journey.verified_at = None
    db.flush()
    for model, condition in [
        (m.EmailLog, m.EmailLog.job_id.in_(jobs)),
        (m.NotificationJob, m.NotificationJob.id.in_(jobs)),
        (m.ApprovalRequest, m.ApprovalRequest.workflow_id.in_(workflows)),
        (m.OnboardingStep, m.OnboardingStep.workflow_id.in_(workflows)),
        (m.HRTask, m.HRTask.employee_id.in_(ids)),
        (m.OnboardingWorkflow, m.OnboardingWorkflow.id.in_(workflows)),
        (m.ComplianceAlert, m.ComplianceAlert.employee_id.in_(ids)),
        (m.Contract, m.Contract.employee_id.in_(ids)),
        (m.Employee, m.Employee.id.in_(ids)),
    ]:
        db.execute(delete(model).where(condition))
    actor = db.scalar(select(m.User).where(m.User.username == "admin"))
    audit(db, actor, "demo.synthetic_reset", count=len(ids))
    db.commit()
print(
    "Synthetic profiles removed; audit, documents, non-synthetic records and database volume preserved. Run app.seed for a fresh roster."
)
