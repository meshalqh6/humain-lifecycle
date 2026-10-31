"""Durable SMTP outbox. Uncertain acceptance is never retried automatically."""

import smtplib
import ssl
from email.message import EmailMessage
from datetime import date
from fastapi import HTTPException
from sqlalchemy import select
from app import email_settings
from app.database import models as m
from app.services import audit, get, lock, row, deadlines


def check_policy(recipient, cfg):
    if recipient.lower() not in cfg.recipients:
        raise HTTPException(403, "Recipient is outside the approved allowlist")
    if cfg.smtp_mode == "sandbox":
        if cfg.smtp_host not in {"localhost", "127.0.0.1"} or cfg.smtp_port != 1025 or not recipient.endswith(".test"):
            raise HTTPException(403, "Sandbox requires local SMTP port 1025 and .test recipients")
    elif cfg.smtp_mode == "real":
        if not cfg.real_email_authorized or not cfg.smtp_username or not cfg.smtp_password.get_secret_value():
            raise HTTPException(403, "External SMTP is disabled until explicitly authorized and configured")
    else:
        raise HTTPException(403, "SMTP sending is disabled")


def review_prepared_job(db, job_id, actor):
    job = db.scalar(select(m.NotificationJob).where(m.NotificationJob.id == job_id).with_for_update())
    if not job or job.state != "AWAITING_REVIEW":
        raise HTTPException(
            409,
            "Only a held recipient-authorization job can be rechecked. Uncertain SMTP sends require independent reconciliation.",
        )
    cfg = email_settings.effective(db)
    check_policy(job.recipient, cfg)
    employee = get(db, m.Employee, job.employee_id)
    template = get(db, m.NotificationTemplate, job.template_id)
    if (
        not template.approved
        or employee.deleted_at
        or email_settings.recipient_for(cfg, employee, template.code) != job.recipient
        or employee.status == "inactive"
    ):
        raise HTTPException(403, "Current employee, recipient and template policy must all permit this message")
    job.state = "PREPARED"
    for approval in db.scalars(
        select(m.ApprovalRequest).where(
            m.ApprovalRequest.action == "email.recipient", m.ApprovalRequest.state == "pending"
        )
    ):
        if approval.detail.get("employee_id") == job.employee_id and approval.detail.get("template") == template.code:
            approval.state = "approved"
    audit(db, actor, "email.policy_reviewed", job.id)
    db.commit()
    return row(job)


def prepare(db, data, actor):
    employee = get(db, m.Employee, data.employee_id)
    cfg = email_settings.effective(db)
    recipient = email_settings.recipient_for(cfg, employee, data.template_code)
    if employee.deleted_at or employee.status == "inactive" or not recipient:
        raise HTTPException(422, "An active employee with an approved email is required")
    template = db.scalar(
        select(m.NotificationTemplate).where(
            m.NotificationTemplate.code == data.template_code, m.NotificationTemplate.approved.is_(True)
        )
    )
    if not template:
        raise HTTPException(403, "This email template has not been approved")
    # Ground reminder dates in authoritative records; callers cannot choose an arbitrary deadline.
    if data.template_code != "welcome":
        if not data.due_date:
            raise HTTPException(422, "A reminder must reference a deadline")
        if not any(
            a["employee_id"] == employee.id
            and a["kind"] == data.template_code
            and a["due_date"] == data.due_date.isoformat()
            for a in deadlines(db, 365)
        ):
            raise HTTPException(422, "Deadline does not match the employee record")
    key = f"{employee.id}:{data.template_code}:{data.due_date or 'once'}"
    lock(db, "email:" + key)
    obj = db.scalar(select(m.NotificationJob).where(m.NotificationJob.idempotency_key == key))
    if obj:
        db.commit()
        return obj
    values = {
        "name": employee.name,
        "employee_number": employee.employee_number,
        "due_date": str(data.due_date or ""),
        "kind": data.template_code.replace("_", " "),
    }
    try:
        check_policy(recipient, cfg)
        state = "PREPARED"
    except HTTPException:
        state = "AWAITING_REVIEW"
        db.add(
            m.ApprovalRequest(
                requested_by=actor.id,
                action="email.recipient",
                detail={"employee_id": employee.id, "template": data.template_code},
            )
        )
    obj = m.NotificationJob(
        employee_id=employee.id,
        template_id=template.id,
        recipient=recipient,
        subject=template.subject.format(**values),
        body=template.body.format(**values),
        idempotency_key=key,
        state=state,
    )
    db.add(obj)
    db.flush()
    audit(db, actor, "email.prepared", obj.id, state=state)
    db.commit()
    return obj


def send(db, job_id, actor):
    job = db.scalar(select(m.NotificationJob).where(m.NotificationJob.id == job_id).with_for_update())
    if not job:
        raise HTTPException(404, "Email job not found")
    if job.state == "SMTP_ACCEPTED":
        db.commit()
        return {
            "job_id": job.id,
            "status": "SMTP_ACCEPTED",
            "duplicate_prevented": True,
            "inbox_delivery_confirmed": False,
        }
    if job.state in {"SENDING", "UNKNOWN", "AWAITING_REVIEW"}:
        raise HTTPException(409, "This email requires human review; automatic resend is blocked")
    if job.attempts >= 3:
        raise HTTPException(409, "Email retry limit reached")
    cfg = email_settings.effective(db)
    check_policy(job.recipient, cfg)
    employee = get(db, m.Employee, job.employee_id)
    template = get(db, m.NotificationTemplate, job.template_id)
    if (
        employee.deleted_at
        or employee.status == "inactive"
        or email_settings.recipient_for(cfg, employee, template.code) != job.recipient
    ):
        raise HTTPException(409, "Employee or recipient changed after preparation; human reconciliation is required")
    if not template.approved:
        raise HTTPException(403, "Template approval has been revoked")
    job.state = "SENDING"
    job.attempts += 1
    audit(db, actor, "email.sending", job.id, attempt=job.attempts)
    db.commit()  # claim is durable BEFORE entering SMTP
    message_id = f"<{job.id}@humain.local>"
    smtp = None
    data_started = False
    try:
        msg = EmailMessage()
        msg["Subject"], msg["From"], msg["To"], msg["Message-ID"] = (
            job.subject,
            cfg.smtp_from,
            job.recipient,
            message_id,
        )
        msg.set_content(job.body)
        smtp = smtplib.SMTP(cfg.smtp_host, cfg.smtp_port, timeout=15)
        if cfg.smtp_mode == "real":
            smtp.starttls(context=ssl.create_default_context())
            smtp.login(cfg.smtp_username, cfg.smtp_password.get_secret_value())
        data_started = True
        refused = smtp.send_message(msg)
        if refused:
            raise smtplib.SMTPRecipientsRefused(refused)
        job.state = "SMTP_ACCEPTED"
        detail = "SMTP server accepted the message; inbox delivery is unverified"
    except Exception as exc:
        # Transport loss during DATA is ambiguous; only definite pre-send/refusal failures may retry.
        definite = isinstance(
            exc,
            (
                smtplib.SMTPRecipientsRefused,
                smtplib.SMTPSenderRefused,
                smtplib.SMTPDataError,
                smtplib.SMTPAuthenticationError,
            ),
        )
        job.state = "FAILED" if not data_started or definite else "UNKNOWN"
        detail = type(exc).__name__  # never include credentials/server exception contents
    finally:
        if smtp:
            try:
                smtp.quit()
            except Exception:
                pass
    db.add(m.EmailLog(job_id=job.id, status=job.state, message_id=message_id, detail=detail))
    audit(db, actor, "email." + job.state.lower(), job.id, detail=detail)
    db.commit()
    return {"job_id": job.id, "status": job.state, "duplicate_prevented": False, "inbox_delivery_confirmed": False}


def reminders(db, days, actor, kind="all"):
    from app.schemas import EmailInput

    results = []
    for alert in deadlines(db, days, kind):
        job = prepare(
            db,
            EmailInput(
                employee_id=alert["employee_id"],
                template_code=alert["kind"],
                due_date=date.fromisoformat(alert["due_date"]),
            ),
            actor,
        )
        results.append(
            send(db, job.id, actor)
            if job.state in {"PREPARED", "FAILED", "SMTP_ACCEPTED"}
            else {"job_id": job.id, "status": job.state}
        )
    return {"results": results, "count": len(results)}


def overview(db):
    return {
        "mode": email_settings.public(db)["smtp_mode"],
        "approved_recipients": sorted(email_settings.effective(db).recipients),
        "templates": [row(t) for t in db.scalars(select(m.NotificationTemplate))],
        "jobs": [
            row(j)
            for j in db.scalars(select(m.NotificationJob).order_by(m.NotificationJob.created_at.desc()).limit(100))
        ],
        "logs": [row(log) for log in db.scalars(select(m.EmailLog).order_by(m.EmailLog.created_at.desc()).limit(100))],
    }
