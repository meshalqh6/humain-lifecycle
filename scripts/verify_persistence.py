"""Restart the development PostgreSQL container and verify durable IDs and workflow states."""

import hashlib
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
from app.database import models as m
from app.database.session import Session, engine
from sqlalchemy import select


def snapshot():
    with Session() as db:
        return {
            model.__tablename__: [
                list(r)
                for r in db.execute(
                    (
                        select(model.id, model.state)
                        if hasattr(model, "state")
                        else select(model.id)
                    ).order_by(model.id)
                )
            ]
            for model in [
                m.Employee,
                m.Contract,
                m.OnboardingWorkflow,
                m.NotificationJob,
                m.AgentConversation,
            ]
        }


before = snapshot()
engine.dispose()
subprocess.run(["docker", "compose", "restart", "postgres"], cwd=ROOT, check=True)
subprocess.run(
    ["docker", "compose", "up", "-d", "--wait", "postgres"], cwd=ROOT, check=True
)
after = snapshot()
report = {
    "identical": before == after,
    "record_counts": {k: len(v) for k, v in after.items()},
    "before_sha256": hashlib.sha256(
        json.dumps(before, sort_keys=True).encode()
    ).hexdigest(),
    "after_sha256": hashlib.sha256(
        json.dumps(after, sort_keys=True).encode()
    ).hexdigest(),
    "volume_deleted": False,
}
(ROOT / "docs/PERSISTENCE_REPORT.json").write_text(json.dumps(report, indent=2))
print(json.dumps(report))
if not report["identical"]:
    sys.exit(1)
