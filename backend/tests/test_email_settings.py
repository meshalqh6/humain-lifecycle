from datetime import timedelta
from sqlalchemy import select, func
from app import email_settings, email_agent, services
from app.database import models as m
from app.database.session import Session
from app.schemas import EmployeeInput, EmailInput
from app.security import hash_password, session_token


def payload(client, **changes):
    values = client.get("/api/settings/email").json()
    values.pop("password_configured")
    return {**values, **changes}


def test_settings_persist_and_password_is_never_returned(client, db):
    secret = "synthetic-app-password-test"
    result = client.put(
        "/api/settings/email",
        json=payload(client, alert_recipient="hr@humain.test", smtp_password=secret, alert_window_days=45),
    )
    assert result.status_code == 200, result.text
    assert secret not in result.text
    assert result.json()["password_configured"]
    assert "hr@humain.test" in result.json()["smtp_allowed_recipients"]
    record = db.get(m.EmailConfiguration, "workspace")
    assert secret not in record.encrypted_password
    with Session() as fresh:
        assert email_settings.effective(fresh).smtp_password.get_secret_value() == secret
        assert email_settings.public(fresh)["alert_recipient"] == "hr@humain.test"
    response = client.put("/api/settings/email", json=payload(client, smtp_password=None))
    assert response.json()["password_configured"]
    assert secret not in client.get("/api/audit").text
    assert db.scalar(select(func.count()).select_from(m.EmailLog)) == 0


def test_unauthorized_settings_change_is_denied(client, db):
    role = m.Role(name="email-viewer")
    db.add(role)
    db.flush()
    user = m.User(username="limited", role_id=role.id, password_hash=hash_password("synthetic"))
    db.add(user)
    db.commit()
    client.cookies.clear()
    client.cookies.set("humain_session", session_token(user))
    assert client.get("/api/settings/email").status_code == 403
    assert client.put("/api/settings/email", json={"smtp_host": "localhost"}).status_code in {403, 422}


def test_external_delivery_requires_explicit_configuration(client):
    values = payload(
        client,
        smtp_mode="real",
        smtp_host="smtp.example.com",
        smtp_port=587,
        smtp_from="hr@example.com",
        smtp_username="hr@example.com",
        alert_recipient="hr@example.com",
    )
    assert client.put("/api/settings/email", json=values).status_code == 422
    assert client.put("/api/settings/email", json={**values, "real_email_authorized": True}).status_code == 422
    assert (
        client.put(
            "/api/settings/email", json={**values, "real_email_authorized": True, "smtp_password": "synthetic-only"}
        ).status_code
        == 200
    )
    assert (
        client.put(
            "/api/settings/email", json=payload(client, smtp_mode="sandbox", real_email_authorized=False)
        ).status_code
        == 422
    )


def test_alert_destination_routes_only_renewals_and_old_jobs_are_not_redirected(client, db, actor, smtp):
    employee = services.create_employee(
        db,
        EmployeeInput(
            employee_number="EMAIL-UI",
            name="Settings Demo",
            nationality="Saudi",
            email="welcome@humain.test",
            iqama_expiry=services.today() + timedelta(days=10),
        ),
        "email-ui-route",
        actor,
    )
    result = client.put("/api/settings/email", json=payload(client, alert_recipient="hr@humain.test"))
    assert result.status_code == 200
    renewal = email_agent.prepare(
        db, EmailInput(employee_id=employee.id, template_code="iqama", due_date=employee.iqama_expiry), actor
    )
    welcome = email_agent.prepare(db, EmailInput(employee_id=employee.id, template_code="welcome"), actor)
    assert renewal.recipient == "hr@humain.test"
    assert welcome.recipient == "welcome@humain.test"
    assert email_agent.send(db, renewal.id, actor)["status"] == "SMTP_ACCEPTED"
    assert smtp.sent[-1]["To"] == "hr@humain.test"
    client.put("/api/settings/email", json=payload(client, alert_recipient="other@humain.test"))
    db.expire_all()
    assert db.get(m.NotificationJob, renewal.id).recipient == "hr@humain.test"
    assert email_agent.send(db, renewal.id, actor)["duplicate_prevented"]
    assert len(smtp.sent) == 1


def test_global_alert_recipient_supports_rosters_without_employee_email(client, db, actor):
    client.put("/api/settings/email", json=payload(client, alert_recipient="hr@humain.test"))
    employee = services.create_employee(
        db,
        EmployeeInput(
            employee_number="NO-EMAIL", name="Roster Demo", nationality="Saudi", iqama_expiry=services.today()
        ),
        "email-ui-null",
        actor,
    )
    job = email_agent.prepare(
        db, EmailInput(employee_id=employee.id, template_code="iqama", due_date=employee.iqama_expiry), actor
    )
    assert job.recipient == "hr@humain.test" and job.state == "PREPARED"
