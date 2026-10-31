"""Exercise real Qwen and the configured SMTP, with explicit self-email opt-in."""

import argparse
import json
import time
import uuid
from pathlib import Path

import httpx
from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument(
    "--real-email-to-approved-alert",
    action="store_true",
    help="Authorize one synthetic welcome to the configured, approved alert recipient only",
)
args = parser.parse_args()
cfg = dotenv_values(ROOT / ".env")
report = {
    "kind": "Real Qwen contract-to-onboarding journey",
    "manual_baseline_seconds": None,
    "time_saved_seconds": None,
    "inbox_delivery_confirmed": False,
}
state_path = ROOT / "runtime" / "journey-demo.json"
with httpx.Client(
    base_url="http://127.0.0.1:8000", headers={"X-Humain-Request": "1"}, timeout=300
) as client:
    client.post(
        "/api/auth/login", json={"username": "admin", "password": cfg["ADMIN_PASSWORD"]}
    ).raise_for_status()
    preferences = client.get("/api/settings/email").json()
    if preferences["smtp_mode"] == "real":
        if not args.real_email_to_approved_alert:
            raise SystemExit(
                "Real SMTP requires --real-email-to-approved-alert; no upload or send performed"
            )
        target = preferences["alert_recipient"]
        if target not in preferences["smtp_allowed_recipients"].split(","):
            raise SystemExit(
                "The configured alert address is not an approved recipient"
            )
    elif preferences["smtp_mode"] == "sandbox":
        target = "welcome@humain.test"
    else:
        raise SystemExit("Email is disabled")
    if state_path.exists():
        saved = json.loads(state_path.read_text())
        document_id = saved["document_id"]
    else:
        number = "JOURNEY-DEMO-" + uuid.uuid4().hex[:8]
        csv = (
            "employee_name,employee_number,nationality,occupation,start_date,end_date,email,salary,probation_days,work_location,synthetic\n"
            + f"Journey Demonstration,{number},Saudi,AI Engineer,2026-10-30,2027-10-29,{target},15000,60,Riyadh,true\n"
        )
        response = client.post(
            "/api/documents",
            files={"file": ("journey-demonstration.csv", csv.encode(), "text/csv")},
        )
        response.raise_for_status()
        document_id = response.json()["id"]
        state_path.write_text(json.dumps({"document_id": document_id}))
    conversation = client.post("/api/agent/conversations").json()
    started = time.perf_counter()
    response = client.post(
        "/api/agent/chat",
        json={
            "conversation_id": conversation["id"],
            "document_id": document_id,
            "message": "Use start_onboarding_journey to prepare onboarding from this synthetic contract and verify its outcome. No company policy has been selected. Send the authorized welcome email as part of the workflow. Do not send renewal reminders. Report remaining human work and simulated IT accurately.",
            "request_key": str(uuid.uuid4()),
        },
    )
    response.raise_for_status()
    report["agent_elapsed_seconds"] = round(time.perf_counter() - started, 3)
    conversation = client.get("/api/agent/conversations/" + conversation["id"]).json()
    report["conversation_id"] = conversation["id"]
    report["tools"] = [
        {"tool": t["tool"], "status": t["status"]} for t in conversation["tools"]
    ]
    runs = client.get("/api/journeys").json()["items"]
    run = next((j for j in runs if j["document_id"] == document_id), None)
    if not run:
        report["result"] = "No persisted journey; no completion claimed"
    else:
        report.update(
            {
                "journey_id": run["id"],
                "state": run["state"],
                "automation_setup_verified": run["automation_setup_verified"],
                "employee_ready": run["employee_ready"],
                "active_automation_ms": run["elapsed_ms"],
                "human_interventions": run["human_interventions"],
                "tasks_created": run["evidence"]["tasks_created"],
                "human_tasks_pending": run["evidence"]["human_tasks_pending"],
                "simulated_it_requests": run["evidence"]["it_requests_simulated"],
                "smtp_accepted": run["evidence"]["smtp_accepted"],
                "smtp_mode": preferences["smtp_mode"],
            }
        )
        before = sum(
            j["attempts"] for j in client.get("/api/communications").json()["jobs"]
        )
        response = client.post("/api/journeys/" + run["id"] + "/resume")
        response.raise_for_status()
        after = sum(
            j["attempts"] for j in client.get("/api/communications").json()["jobs"]
        )
        report["retry_new_smtp_attempts"] = after - before
(ROOT / "docs" / "JOURNEY_LIVE_EVALUATION.json").write_text(
    json.dumps(report, indent=2)
)
print(json.dumps(report, indent=2))
if not report.get("automation_setup_verified"):
    raise SystemExit(1)
