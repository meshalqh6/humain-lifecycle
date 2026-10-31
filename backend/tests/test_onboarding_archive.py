import pytest
from sqlalchemy import select, func
from app import onboarding
from app.database import models as m
from app.security import hash_password, session_token


@pytest.mark.parametrize("state", ["COMPLETED", "RUNNING", "AWAITING_REVIEW"])
def test_archive_hides_card_preserves_records_and_is_repeat_safe(client, db, actor, document, smtp, state):
    result = onboarding.run(db, document.id, actor)
    workflow = db.get(m.OnboardingWorkflow, result["id"])
    workflow.state = state
    db.commit()
    models = [m.Employee, m.Contract, m.HRTask, m.OnboardingStep, m.NotificationJob, m.EmailLog]
    counts = [db.scalar(select(func.count()).select_from(model)) for model in models]
    attempts = len(smtp.sent)
    assert client.post(f"/api/onboarding/{workflow.id}/archive").json() == {"archived": True}
    assert client.post(f"/api/onboarding/{workflow.id}/archive").json() == {"archived": True}
    assert client.get("/api/onboarding").json()["total"] == 0
    assert client.get("/api/dashboard").json()["onboarding"] == 0
    db.refresh(workflow)
    assert workflow.archived_at is not None
    assert workflow.state == state
    assert [db.scalar(select(func.count()).select_from(model)) for model in models] == counts
    assert len(smtp.sent) == attempts
    assert len(db.scalars(select(m.AuditEvent).where(m.AuditEvent.action == "onboarding.archived")).all()) == 1
    # The source stays idempotent even if it is explicitly retried after hiding its card.
    assert onboarding.run(db, document.id, actor)["id"] == workflow.id
    db.refresh(workflow)
    assert workflow.archived_at is not None
    assert len(smtp.sent) == attempts


def test_archive_requires_write_permission(client, db, actor, document):
    workflow = m.OnboardingWorkflow(document_id=document.id, idempotency_key="archive-permissions")
    role = m.Role(name="archive-read-only")
    db.add_all([workflow, role])
    db.flush()
    viewer = m.User(username="archive-viewer", password_hash=hash_password("synthetic"), role_id=role.id)
    db.add(viewer)
    db.commit()
    client.cookies.clear()
    client.cookies.set("humain_session", session_token(viewer))
    assert client.post(f"/api/onboarding/{workflow.id}/archive").status_code == 403
    db.refresh(workflow)
    assert workflow.archived_at is None
