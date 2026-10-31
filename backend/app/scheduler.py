"""One local polling worker; PostgreSQL row locks serialize scheduler claims."""

import threading
import logging
from datetime import timedelta
from sqlalchemy import select
from app.database import models as m
from app.database.session import Session
from app import email_agent, services
from app.email_settings import effective

log = logging.getLogger("humain.scheduler")


def tick():
    with Session() as db:
        job = db.scalar(
            select(m.SchedulerJob)
            .where(m.SchedulerJob.next_run <= m.now(), m.SchedulerJob.state.in_(["READY", "FAILED"]))
            .with_for_update(skip_locked=True)
            .limit(1)
        )
        if not job:
            return
        job.state = "RUNNING"
        job.last_run = m.now()
        job.attempts += 1
        job.next_run = m.now() + timedelta(hours=24)
        db.commit()
        actor = db.scalar(select(m.User).where(m.User.username == "admin", m.User.active.is_(True)))
        try:
            if actor is None:
                raise RuntimeError("Scheduler owner unavailable")
            from app.security import authorize

            authorize(db, actor, "email.send")
            services.scan_compliance(db, actor, effective(db).alert_window_days)
            email_agent.reminders(db, effective(db).alert_window_days, actor)
            # Retry only definite pre-acceptance failures. Unknown/SENDING jobs remain review-only.
            for pending in db.scalars(
                select(m.NotificationJob).where(
                    m.NotificationJob.state.in_(["PREPARED", "FAILED"]),
                    m.NotificationJob.attempts < 3,
                    m.NotificationJob.scheduled_at <= m.now(),
                )
            ).all():
                email_agent.send(db, pending.id, actor)
            job.state, job.error = "READY", None
            services.audit(db, actor, "scheduler.completed", job.id)
        except Exception as exc:
            db.rollback()
            job = db.get(m.SchedulerJob, job.id)
            job.state, job.error = "FAILED", type(exc).__name__
            job.next_run = m.now() + timedelta(minutes=min(job.attempts * 5, 60))
            services.audit(db, actor, "scheduler.failed", job.id, error_type=type(exc).__name__)
            log.error("scheduler failed", extra={"error_type": type(exc).__name__})
        db.commit()


def loop(stop: threading.Event):
    while not stop.wait(30):
        try:
            tick()
        except Exception as exc:
            log.error("scheduler unavailable", extra={"error_type": type(exc).__name__})
