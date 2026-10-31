"""Persisted administrator email preferences; secrets are never returned by this service."""

import base64
from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from fastapi import HTTPException
from pydantic import SecretStr
from app.config import settings
from app.database.models import EmailConfiguration
from app.services import audit, lock

FIELDS = [
    "smtp_mode",
    "smtp_host",
    "smtp_port",
    "smtp_from",
    "smtp_username",
    "alert_recipient",
    "smtp_allowed_recipients",
    "real_email_authorized",
    "alert_window_days",
]


def cipher():
    key = HKDF(algorithm=hashes.SHA256(), length=32, salt=None, info=b"humain-email-settings-v1").derive(
        settings().auth_secret.get_secret_value().encode()
    )
    return Fernet(base64.urlsafe_b64encode(key))


def public(db):
    record = db.get(EmailConfiguration, "workspace")
    values = {k: getattr(settings(), k) for k in FIELDS}
    if record:
        values.update(record.values)
    values["password_configured"] = (
        bool(record.encrypted_password) if record else bool(settings().smtp_password.get_secret_value())
    )
    return values


def effective(db):
    record = db.get(EmailConfiguration, "workspace")
    if not record:
        return settings()
    try:
        password = cipher().decrypt(record.encrypted_password.encode()).decode() if record.encrypted_password else ""
    except InvalidToken:
        raise HTTPException(503, "Stored SMTP password cannot be unlocked. Re-enter it in Email Settings.") from None
    return settings().model_copy(update={**record.values, "smtp_password": SecretStr(password)})


def save(db, data, actor):
    lock(db, "settings:email")
    record = db.get(EmailConfiguration, "workspace")
    encrypted = (
        record.encrypted_password
        if record
        else cipher().encrypt(settings().smtp_password.get_secret_value().encode()).decode()
        if settings().smtp_password.get_secret_value()
        else None
    )
    if data.clear_password:
        encrypted = None
    elif data.smtp_password and data.smtp_password.get_secret_value():
        encrypted = cipher().encrypt(data.smtp_password.get_secret_value().encode()).decode()
    if data.smtp_mode == "real" and not encrypted:
        raise HTTPException(422, "Enter an SMTP app password before enabling real delivery")
    values = data.model_dump(include=set(FIELDS))
    # Selecting a global alert destination explicitly authorizes that exact recipient.
    recipients = {v for v in values["smtp_allowed_recipients"].split(",") if v}
    if data.alert_recipient:
        recipients.add(data.alert_recipient)
    values["smtp_allowed_recipients"] = ",".join(sorted(recipients))
    if record is None:
        record = EmailConfiguration(id="workspace", values=values, encrypted_password=encrypted)
        db.add(record)
    else:
        record.values, record.encrypted_password = values, encrypted
    audit(
        db,
        actor,
        "settings.email.updated",
        "workspace",
        changed_fields=FIELDS,
        password_changed=bool(data.clear_password or data.smtp_password),
        mode=data.smtp_mode,
    )
    db.commit()
    return public(db)


def recipient_for(cfg, employee, template_code):
    return cfg.alert_recipient if template_code != "welcome" and cfg.alert_recipient else employee.email


def test_connection(db, actor):
    import smtplib
    import ssl

    cfg = effective(db)
    if cfg.smtp_mode == "disabled":
        raise HTTPException(409, "Choose a delivery mode before testing the connection")
    if cfg.smtp_mode == "real" and not cfg.real_email_authorized:
        raise HTTPException(403, "Real SMTP is not authorized")
    smtp = None
    try:
        smtp = smtplib.SMTP(cfg.smtp_host, cfg.smtp_port, timeout=15)
        smtp.ehlo()
        if cfg.smtp_mode == "real":
            smtp.starttls(context=ssl.create_default_context())
            smtp.ehlo()
            smtp.login(cfg.smtp_username, cfg.smtp_password.get_secret_value())
        result = {
            "connected": True,
            "authenticated": cfg.smtp_mode == "real",
            "message": "Connection verified. No email was sent.",
        }
    except Exception as exc:
        result = {
            "connected": False,
            "authenticated": False,
            "error_type": type(exc).__name__,
            "message": "SMTP connection or authentication failed. Check the account, app password and network access. No email was sent.",
        }
    finally:
        if smtp:
            try:
                smtp.quit()
            except Exception:
                pass
    audit(
        db,
        actor,
        "settings.email.connection_test",
        "workspace",
        connected=result["connected"],
        error_type=result.get("error_type"),
    )
    db.commit()
    return result
