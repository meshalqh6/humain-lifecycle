import os
from pathlib import Path
import subprocess
import sys
import pytest
from dotenv import dotenv_values

# Override BEFORE importing any application module. Never fall back to the development database.
ROOT = Path(__file__).resolve().parents[2]
config = dotenv_values(ROOT / ".env")
test_url = os.environ.get("TEST_DATABASE_URL") or config.get("TEST_DATABASE_URL")
if not test_url or test_url.rsplit("/", 1)[-1] != "humain_test":
    raise RuntimeError("Tests require a separate database named humain_test; development fallback is forbidden")
os.environ["DATABASE_URL"] = test_url
os.environ["SCHEDULER_ENABLED"] = "false"

from sqlalchemy import text  # noqa: E402
from app.database.session import engine, Session  # noqa: E402
from app.database.models import Base  # noqa: E402
from app.main import app  # noqa: E402
from app.seed import bootstrap  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def migrate():
    with engine.connect() as conn:
        assert conn.scalar(text("SELECT current_database()")) == "humain_test"
    subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"], cwd=ROOT / "backend", check=True, capture_output=True
    )


@pytest.fixture(autouse=True)
def clean(migrate):
    with engine.begin() as conn:
        tables = ", ".join('"' + t.name + '"' for t in Base.metadata.sorted_tables)
        conn.execute(text("TRUNCATE " + tables + " CASCADE"))
    with Session() as db:
        bootstrap(db)


@pytest.fixture
def db():
    with Session() as session:
        yield session


@pytest.fixture
def actor(db):
    from sqlalchemy import select
    from app.database.models import User

    return db.scalar(select(User).where(User.username == "admin"))


@pytest.fixture
def client():
    from app.config import settings

    with TestClient(app, headers={"X-Humain-Request": "1"}) as c:
        result = c.post(
            "/api/auth/login", json={"username": "admin", "password": settings().admin_password.get_secret_value()}
        )
        assert result.status_code == 200
        yield c


@pytest.fixture
def smtp(monkeypatch):
    class SMTP:
        sent = []

        def __init__(self, *args, **kwargs):
            pass

        def send_message(self, msg):
            self.sent.append(msg)
            return {}

        def quit(self):
            pass

    monkeypatch.setattr("app.email_agent.smtplib.SMTP", SMTP)
    return SMTP


@pytest.fixture
def contract_csv():
    return b"employee_name,employee_number,nationality,occupation,start_date,end_date,email,salary,synthetic\nTest Demo,TEST-001,Saudi,AI Engineer,2026-01-01,2027-12-31,welcome@humain.test,15000,true\n"


@pytest.fixture
def document(db, actor, contract_csv):
    from app.documents import ingest

    return ingest(db, "test.csv", contract_csv, actor)
