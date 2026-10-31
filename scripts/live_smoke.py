"""Real Qwen + PostgreSQL + SMTP demonstration. Synthetic sandbox only."""

import json
import sys
import time
import uuid
from pathlib import Path

import httpx
from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[1]
cfg = dotenv_values(ROOT / ".env")
if cfg.get("SMTP_MODE") != "sandbox":
    sys.exit("Live smoke requires sandbox SMTP; no external delivery permitted")
report = {"kind": "live local service evaluation", "scenarios": []}
with httpx.Client(
    base_url="http://127.0.0.1:8000", timeout=600, headers={"X-Humain-Request": "1"}
) as client:
    r = client.post(
        "/api/auth/login", json={"username": "admin", "password": cfg["ADMIN_PASSWORD"]}
    )
    r.raise_for_status()
    if client.get("/api/settings/email").json().get("smtp_mode") != "sandbox":
        sys.exit(
            "Live smoke requires the effective saved SMTP mode to be sandbox; no external delivery permitted"
        )
    health = client.get("/api/health/ollama").json()
    if not health.get("ready"):
        sys.exit("Configured model is unavailable; no success claimed")
    report["model"] = health["model"]
    # Each benchmark gets a new synthetic employee; a separate explicit retry measures deduplication.
    content = (
        (ROOT / "demo/qiwa-synthetic.csv")
        .read_bytes()
        .replace(b"DEMO-NEW-001", ("DEMO-SMOKE-" + uuid.uuid4().hex[:10]).encode())
    )
    doc = client.post(
        "/api/documents", files={"file": ("qiwa-synthetic.csv", content, "text/csv")}
    )
    doc.raise_for_status()
    document_id = doc.json()["id"]
    for name, message, attachment in [
        (
            "A",
            "Review this contract, verify the employee, complete onboarding, prepare HR tasks, and send the authorized welcome email.",
            document_id,
        ),
        (
            "B",
            "Find documents expiring within 30 days and send approved renewal reminders.",
            None,
        ),
    ]:
        conversation = client.post("/api/agent/conversations").json()
        started = time.perf_counter()
        response = client.post(
            "/api/agent/chat",
            json={
                "conversation_id": conversation["id"],
                "message": message,
                "document_id": attachment,
                "request_key": str(uuid.uuid4()),
            },
        )
        response.raise_for_status()
        saved = client.get("/api/agent/conversations/" + conversation["id"]).json()
        result = {
            "scenario": name,
            "elapsed_seconds": round(time.perf_counter() - started, 3),
            "conversation_id": conversation["id"],
            "workflow_states": [w["state"] for w in saved["workflows"]],
            "tools": [
                {"tool": t["tool"], "status": t["status"], "verified": t["verified"]}
                for t in saved["tools"]
            ],
            "assistant_response": saved["messages"][-1]["content"],
            "stream_done": "event: done" in response.text,
            "stream_error": "event: error" in response.text,
        }
        report["scenarios"].append(result)
        print(
            f"Scenario {name}: states={result['workflow_states']}, tools={result['tools']}, elapsed={result['elapsed_seconds']}s",
            flush=True,
        )
    before = client.get("/api/communications").json()
    count_before = sum(j["attempts"] for j in before["jobs"])
    repeated = client.post("/api/onboarding", json={"document_id": document_id})
    repeated.raise_for_status()
    second_reminders = client.post(
        "/api/communications/reminders/run", json={"days": 30, "kind": "all"}
    )
    second_reminders.raise_for_status()
    after = client.get("/api/communications").json()
    report["explicit_retry"] = {
        "onboarding_state": repeated.json()["state"],
        "new_smtp_attempts": sum(j["attempts"] for j in after["jobs"]) - count_before,
        "reminder_results": second_reminders.json(),
    }
    report["onboarding"] = client.get("/api/onboarding").json()
    report["communications"] = client.get("/api/communications").json()
    report["evaluation"] = client.get("/api/evaluation").json()
    report["mailpit_message_count"] = (
        httpx.get("http://127.0.0.1:8025/api/v1/messages").json().get("total")
    )
(ROOT / "docs/LIVE_EVALUATION.json").write_text(
    json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8"
)
print(
    "Actual results saved in docs/LIVE_EVALUATION.json. Inspect workflow and email states before claiming completion."
)
