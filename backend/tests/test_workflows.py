from datetime import timedelta
import smtplib
import pytest
from sqlalchemy import select, func, text
from fastapi import HTTPException
from app import documents, onboarding, email_agent, services
from app.database import models as m
from app.database.session import Session
from app.schemas import EmployeeInput, EmailInput, ContractFields


def test_postgres_and_migration(db):
    assert db.scalar(text("SHOW server_version")).startswith("17.")
    assert db.scalar(text("SELECT version_num FROM alembic_version"))
    assert len(m.Base.metadata.tables) == 29


def test_document_and_employee_idempotency(db, actor, document, contract_csv):
    assert documents.ingest(db, "other.csv", contract_csv, actor).id == document.id
    result = documents.extract(db, document.id, actor)
    assert result["valid"]
    assert result["fields"]["employee_name"] == "Test Demo"
    data = EmployeeInput(employee_number="X1", name="Test Name", nationality="Saudi", synthetic=True)
    e = services.create_employee(db, data, "create-test", actor)
    assert services.create_employee(db, data, "create-test", actor).id == e.id
    with pytest.raises(HTTPException):
        services.create_employee(db, data, "different-key", actor)


def test_full_onboarding_and_duplicate_retry(db, actor, document, smtp):
    first = onboarding.run(db, document.id, actor)
    assert first["state"] == "COMPLETED"
    assert all(s["status"] == "completed" for s in first["steps"])
    second = onboarding.run(db, document.id, actor)
    assert second["id"] == first["id"]
    assert len(smtp.sent) == 1
    assert db.scalar(select(func.count()).select_from(m.Employee)) == 1
    assert db.scalar(select(func.count()).select_from(m.HRTask)) == 5
    assert db.scalar(select(func.count()).select_from(m.Contract)) == 1
    with Session() as fresh:
        assert fresh.get(m.OnboardingWorkflow, first["id"]).state == "COMPLETED"
        assert fresh.scalar(select(func.count()).select_from(m.AuditEvent)) >= 5


def test_onboarding_display_order_is_independent_of_tied_timestamps(db, document):
    workflow = m.OnboardingWorkflow(document_id=document.id, idempotency_key="step-order")
    db.add(workflow)
    db.flush()
    created = m.now()
    for name in reversed(onboarding.STEP_NAMES):
        db.add(m.OnboardingStep(workflow_id=workflow.id, name=name, created_at=created))
    db.commit()
    assert [step["name"] for step in onboarding.result(db, workflow)["steps"]] == [
        "Extract contract",
        "Validate information",
        "Create employee",
        "Generate HR tasks",
        "Simulate IT requests",
        "Send welcome email",
        "Verify outcome",
    ]


def test_invalid_contract_requires_review(db, actor, contract_csv, smtp):
    doc = documents.ingest(db, "missing.csv", contract_csv.replace(b"2027-12-31", b"2025-01-01"), actor)
    result = onboarding.run(db, doc.id, actor)
    assert result["state"] == "AWAITING_REVIEW"
    assert db.scalar(select(func.count()).select_from(m.Employee)) == 0
    assert not smtp.sent
    reviewed = documents.review(
        db,
        doc.id,
        ContractFields(
            employee_name="Test Demo",
            employee_number="TEST-001",
            nationality="Saudi",
            start_date="2026-01-01",
            end_date="2027-12-31",
            email="welcome@humain.test",
            synthetic=True,
        ),
        actor,
    )
    assert reviewed["valid"]
    assert onboarding.run(db, doc.id, actor)["state"] == "COMPLETED"


def test_smtp_recovery_preserves_records(db, actor, document, monkeypatch, smtp):
    cls = smtp

    def fail(*a, **k):
        raise ConnectionRefusedError()

    monkeypatch.setattr("app.email_agent.smtplib.SMTP", fail)
    result = onboarding.run(db, document.id, actor)
    assert result["state"] == "FAILED"
    assert db.scalar(select(func.count()).select_from(m.Employee)) == 1
    monkeypatch.setattr("app.email_agent.smtplib.SMTP", cls)
    assert onboarding.run(db, document.id, actor)["state"] == "COMPLETED"
    assert len(cls.sent) == 1
    assert db.scalar(select(func.count()).select_from(m.HRTask)) == 5


def test_uncertain_smtp_never_blind_retries(db, actor, document, smtp, monkeypatch):
    def uncertain(self, msg):
        raise smtplib.SMTPServerDisconnected()

    monkeypatch.setattr(smtp, "send_message", uncertain)
    assert onboarding.run(db, document.id, actor)["state"] == "AWAITING_REVIEW"
    job = db.scalar(select(m.NotificationJob))
    assert job.state == "UNKNOWN"
    with pytest.raises(HTTPException, match="review"):
        email_agent.send(db, job.id, actor)
    assert job.attempts == 1


def test_recipient_policy_and_no_external_smtp(db, actor, smtp):
    employee = services.create_employee(
        db,
        EmployeeInput(
            employee_number="OUT1", name="Unauthorized Demo", nationality="Saudi", email="someone@example.com"
        ),
        "external-test",
        actor,
    )
    job = email_agent.prepare(db, EmailInput(employee_id=employee.id, template_code="welcome"), actor)
    assert job.state == "AWAITING_REVIEW"
    with pytest.raises(HTTPException):
        email_agent.send(db, job.id, actor)
    assert not smtp.sent


def test_reminders_deduplicate_and_dates_are_grounded(db, actor, smtp):
    emp = services.create_employee(
        db,
        EmployeeInput(
            employee_number="DUE1",
            name="Renewal Demo",
            nationality="Egyptian",
            email="renewals@humain.test",
            iqama_expiry=services.today() + timedelta(days=12),
        ),
        "deadline-test",
        actor,
    )
    assert email_agent.reminders(db, 30, actor)["count"] == 1
    second = email_agent.reminders(db, 30, actor)
    assert second["results"][0]["duplicate_prevented"]
    assert len(smtp.sent) == 1
    with pytest.raises(HTTPException):
        email_agent.prepare(db, EmailInput(employee_id=emp.id, template_code="iqama", due_date=services.today()), actor)
    services.scan_compliance(db, actor)
    emp.iqama_expiry = services.today() + timedelta(days=90)
    db.commit()
    services.scan_compliance(db, actor)
    assert db.scalar(select(m.ComplianceAlert)).status == "resolved"


def test_upload_restrictions(db, actor):
    for filename, content in [("bad.exe", b"hello"), ("bad.pdf", b"not pdf"), ("bad.xlsx", b"not zip")]:
        with pytest.raises(HTTPException):
            documents.ingest(db, filename, content, actor)


def test_email_review_requires_current_policy_and_blocks_uncertain_resend(db, actor, smtp, monkeypatch):
    from app.config import settings

    employee = services.create_employee(
        db,
        EmployeeInput(
            employee_number="REVIEW1", name="Review Demo", nationality="Saudi", email="unapproved@humain.test"
        ),
        "review-email",
        actor,
    )
    job = email_agent.prepare(db, EmailInput(employee_id=employee.id, template_code="welcome"), actor)
    with pytest.raises(HTTPException):
        email_agent.review_prepared_job(db, job.id, actor)
    db.rollback()
    cfg = settings()
    monkeypatch.setattr(cfg, "smtp_allowed_recipients", cfg.smtp_allowed_recipients + ",unapproved@humain.test")
    assert email_agent.review_prepared_job(db, job.id, actor)["state"] == "PREPARED"
    assert db.scalar(select(m.ApprovalRequest)).state == "approved"
    assert email_agent.send(db, job.id, actor)["status"] == "SMTP_ACCEPTED"
    job.state = "UNKNOWN"
    db.commit()
    with pytest.raises(HTTPException):
        email_agent.review_prepared_job(db, job.id, actor)


def test_csv_formula_is_never_executed(db, actor):
    content = b'employee_name,employee_number,nationality\n"=WEBSERVICE(https://example.com)",X,Saudi\n'
    doc = documents.ingest(db, "formula.csv", content, actor)
    result = documents.extract(db, doc.id, actor)
    assert result["fields"]["employee_name"].startswith("=WEBSERVICE")
    assert not result["valid"]


def test_dashboard_deadline_window_is_90_days_and_inclusive(db, actor):
    for delta in [-1, 31, 90, 91]:
        services.create_employee(
            db,
            EmployeeInput(
                employee_number=f"WINDOW-{delta}",
                name=f"Window Demo {delta}",
                nationality="Saudi",
                synthetic=True,
                iqama_expiry=services.today() + timedelta(days=delta),
            ),
            f"window-{delta}",
            actor,
        )
    result = services.dashboard(db)
    assert result["deadline_window_days"] == 90
    assert {alert["name"] for alert in result["alerts"]} == {"Window Demo -1", "Window Demo 31", "Window Demo 90"}
