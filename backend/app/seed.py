"""Idempotent synthetic-only seed."""

from datetime import timedelta
from sqlalchemy import select
from app.config import settings
from app.database import models as m
from app.database.session import Session
from app.security import hash_password
from app.services import today, audit

PERMISSIONS = ["hr.read", "hr.write", "document.write", "email.send", "audit.read", "settings.write", "approval.review"]


def bootstrap(db):
    role = db.scalar(select(m.Role).where(m.Role.name == "administrator"))
    if not role:
        role = m.Role(name="administrator")
        db.add(role)
        db.flush()
        for p in PERMISSIONS:
            db.add(m.Permission(role_id=role.id, code=p))
    user = db.scalar(select(m.User).where(m.User.username == "admin"))
    if not user:
        user = m.User(
            username="admin", password_hash=hash_password(settings().admin_password.get_secret_value()), role_id=role.id
        )
        db.add(user)
    db.commit()
    for code in ["welcome", "contract", "iqama", "work_permit"]:
        if not db.scalar(select(m.NotificationTemplate).where(m.NotificationTemplate.code == code)):
            db.add(
                m.NotificationTemplate(
                    code=code,
                    subject="Welcome to your new team" if code == "welcome" else "HR renewal reminder: {kind}",
                    body="Hello {name},\n\nYour onboarding tasks have been prepared. HR will verify identity and official Qiwa approval. IT provisioning is simulated in this demonstration.\n\nHUMAIN Lifecycle · Synthetic sandbox"
                    if code == "welcome"
                    else "Hello {name},\n\nOur records show your {kind} deadline is {due_date}. Please contact HR to arrange a review. This is a reminder, not a legal determination.\n\nHUMAIN Lifecycle · Synthetic sandbox",
                    approved=True,
                )
            )
    if not db.scalar(select(m.SchedulerJob).where(m.SchedulerJob.name == "renewal-monitor")):
        db.add(m.SchedulerJob(name="renewal-monitor", next_run=m.now() + timedelta(hours=24)))
    db.commit()
    return user


def seed(db):
    actor = bootstrap(db)
    departments = {}
    for name in ["Engineering", "People & Culture", "Operations", "Finance", "Product & Design"]:
        obj = db.scalar(select(m.Department).where(m.Department.name == name))
        if not obj:
            obj = m.Department(name=name)
            db.add(obj)
            db.flush()
        departments[name] = obj.id
    fixtures = [
        ("Amal Demo", "Saudi", "People Partner", "People & Culture"),
        ("Faisal Demo", "Saudi", "AI Engineer", "Engineering"),
        ("Noor Demo", "Saudi", "Product Designer", "Product & Design"),
        ("Omar Demo", "Egyptian", "AI Engineer", "Engineering"),
        ("Sara Demo", "Saudi", "Finance Analyst", "Finance"),
        ("Zain Demo", "Pakistani", "Operations Specialist", "Operations"),
        ("Lina Demo", "Saudi", "AI Engineer", "Engineering"),
        ("Rami Demo", "Jordanian", "Product Designer", "Product & Design"),
        ("Hana Demo", "Saudi", "People Partner", "People & Culture"),
        ("Yusuf Demo", "Saudi", "Operations Specialist", "Operations"),
        ("Adam Demo", "British", "Finance Analyst", "Finance"),
        ("Maha Demo", "Saudi", "AI Engineer", "Engineering"),
    ]
    for i, (name, nationality, profession, dep) in enumerate(fixtures):
        number = f"DEMO-{i + 1:03}"
        if db.scalar(select(m.Employee).where(m.Employee.employee_number == number)):
            continue
        emp = m.Employee(
            employee_number=number,
            name=name,
            nationality=nationality,
            profession=profession,
            email="renewals@humain.test",
            department_id=departments[dep],
            synthetic=True,
            idempotency_key=number,
            iqama_expiry=today() + timedelta(days=12 + i * 10) if nationality != "Saudi" else None,
            work_permit_expiry=today() + timedelta(days=18 + i * 5) if nationality != "Saudi" else None,
        )
        db.add(emp)
        db.flush()
        db.add(
            m.Contract(
                employee_id=emp.id,
                start_date=today() - timedelta(days=340),
                end_date=today() + timedelta(days=8 + i * 30),
                salary=12000 + i * 500,
                employer="Synthetic Enterprise",
            )
        )
        audit(db, actor, "demo.employee_seeded", emp.id, synthetic=True)
    db.commit()


if __name__ == "__main__":
    with Session() as db:
        seed(db)
    print("Synthetic demo seeded. No original employees imported.")
