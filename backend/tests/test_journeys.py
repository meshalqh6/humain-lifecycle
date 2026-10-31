from sqlalchemy import select, func
from fastapi import HTTPException
import pytest
from app import journeys, documents, onboarding
from app.database import models as m
from app.database.session import Session
from app.schemas import JourneyInput, CompanyPolicyInput, MeasurementInput, DecisionInput


def policy(db, actor, field="salary", operator="maximum", value="12000"):
    source = "Example company policy only. Total salary must be at most 12000 for this demonstration."
    return journeys.create_policy(
        db,
        CompanyPolicyInput(
            title="Example policy",
            source=source,
            rules=[{"field": field, "operator": operator, "value": value, "quote": source}],
        ),
        actor,
    )


def test_journey_verifies_evidence_and_deduplicates(db, actor, document, smtp):
    run = journeys.start(db, JourneyInput(document_id=document.id), actor)
    assert run["state"] == "VERIFIED"
    assert run["automation_setup_verified"]
    assert not run["employee_ready"]
    assert run["evidence"]["human_tasks_pending"] == 3
    assert run["evidence"]["it_requests_simulated"] == 2
    assert run["evidence"]["smtp_accepted"]
    assert not run["evidence"]["inbox_delivery_confirmed"]
    assert all(s["state"] == "verified" for s in run["plan"])
    assert run["measurement"] is None and run["time_difference_seconds"] is None
    assert run["human_interventions"] == 0
    second = journeys.start(db, JourneyInput(document_id=document.id), actor)
    assert second["id"] == run["id"] and second["attempts"] == 1
    assert len(smtp.sent) == 1
    with Session() as fresh:
        assert journeys.result(fresh, fresh.get(m.Journey, run["id"]))["automation_setup_verified"]


def test_policy_gate_blocks_all_entry_points_and_requires_activation(db, actor, document, smtp):
    p = policy(db, actor)
    with pytest.raises(HTTPException, match="Activate"):
        journeys.start(db, JourneyInput(document_id=document.id, policy_id=p["id"]), actor)
    db.rollback()
    journeys.activate_policy(db, p["id"], actor)
    run = journeys.start(db, JourneyInput(document_id=document.id, policy_id=p["id"]), actor)
    assert run["state"] == "AWAITING_REVIEW"
    assert run["findings"][0]["contract_value"] == "15000"
    assert run["findings"][0]["policy_quote"] == p["source"]
    assert not smtp.sent and not db.scalar(select(func.count()).select_from(m.Employee))
    with pytest.raises(HTTPException, match="unresolved"):
        onboarding.run(db, document.id, actor)
    db.rollback()
    resolved = journeys.accept_exception(
        db, run["id"], "HR approved an exception for this demonstration scenario", actor
    )
    assert resolved["state"] == "VERIFIED"
    assert resolved["human_interventions"] == 1
    assert len(smtp.sent) == 1
    assert resolved["plan"][1]["state"] == "exception_recorded"
    assert db.scalar(select(m.AuditEvent).where(m.AuditEvent.action == "journey.policy_exception")).detail["note"]
    with pytest.raises(HTTPException):
        journeys.start(db, JourneyInput(document_id=document.id), actor)


def test_missing_facts_review_resumes_one_action(client, document, db, actor, smtp):
    extraction = documents.extract(db, document.id, actor)
    fields = extraction["fields"]
    fields["email"] = None
    from app.schemas import ContractFields

    documents.review(db, document.id, ContractFields.model_validate(fields), actor)
    response = client.post("/api/journeys", json={"document_id": document.id})
    assert response.status_code == 200
    run = response.json()
    assert run["state"] == "AWAITING_REVIEW" and not smtp.sent
    fields["email"] = "welcome@humain.test"
    response = client.put("/api/journeys/" + run["id"] + "/review", json=fields)
    assert response.status_code == 200
    assert response.json()["journey"]["state"] == "VERIFIED"
    # Includes the earlier explicit source review used to create this test exception.
    assert response.json()["journey"]["human_interventions"] == 2
    assert len(smtp.sent) == 1
    assert client.get("/api/exceptions").json()["journeys"] == []


def test_policy_waiver_does_not_waive_new_facts_or_missing_fields(db, actor, document, smtp):
    p = policy(db, actor)
    journeys.activate_policy(db, p["id"], actor)
    run = journeys.start(db, JourneyInput(document_id=document.id, policy_id=p["id"]), actor)
    extraction = db.scalar(select(m.ContractExtraction))
    extraction.fields = {**extraction.fields, "salary": "18000"}
    db.commit()
    with pytest.raises(HTTPException, match="facts changed"):
        journeys.accept_exception(db, run["id"], "Allow previous salary exception for this scenario", actor)
    db.rollback()
    refreshed = journeys.run(db, run["id"], actor)
    assert refreshed["findings"][0]["contract_value"] == "18000"
    assert not smtp.sent


def test_extraction_failure_is_durable_and_resume_is_safe(db, actor, smtp):
    doc = documents.ingest(db, "invalid.csv", b"employee_name,start_date\nDemo,not-a-date\n", actor)
    run = journeys.start(db, JourneyInput(document_id=doc.id), actor)
    assert run["state"] == "FAILED" and run["error"]
    assert journeys.inbox(db)["journeys"][0]["id"] == run["id"]
    retry = journeys.run(db, run["id"], actor)
    assert retry["attempts"] == 2 and retry["human_interventions"] == 1
    assert not smtp.sent
    journey = db.get(m.Journey, run["id"])
    journey.state = "RUNNING"
    db.commit()
    with pytest.raises(HTTPException, match="running"):
        journeys.run(db, run["id"], actor)


def test_measurement_requires_verified_same_contract_and_preserves_negative_difference(db, actor, document, smtp):
    run = journeys.start(db, JourneyInput(document_id=document.id), actor)
    obj = db.get(m.Journey, run["id"])
    obj.elapsed_ms = 20000
    db.commit()
    result = journeys.measure(
        db,
        run["id"],
        MeasurementInput(
            manual_seconds=10,
            manual_interventions=4,
            notes="Measured the same contract with a stopwatch, including task preparation.",
        ),
        actor,
    )
    assert result["time_difference_seconds"] == -10
    assert result["measurement"]["manual_interventions"] == 4
    obj.state = "FAILED"
    db.commit()
    with pytest.raises(HTTPException):
        journeys.measure(
            db,
            run["id"],
            MeasurementInput(manual_seconds=20, manual_interventions=2, notes="Same timed scenario"),
            actor,
        )


def test_rule_validation_and_source_quote_integrity():
    with pytest.raises(ValueError, match="exact passage"):
        CompanyPolicyInput(
            title="Bad policy",
            source="A different approved policy source",
            rules=[{"field": "email", "operator": "required", "quote": "Made up quotation"}],
        )
    for value in ["NaN", "Infinity", "-1", "not numeric"]:
        with pytest.raises(ValueError):
            CompanyPolicyInput(
                title="Bad threshold",
                source="Salary threshold policy source",
                rules=[{"field": "salary", "operator": "maximum", "value": value, "quote": "Salary threshold"}],
            )
    with pytest.raises(ValueError):
        DecisionInput(note="ok")


def test_task_completion_is_real_internal_action_and_simulated_is_blocked(client, document, smtp):
    run = client.post("/api/journeys", json={"document_id": document.id}).json()
    tasks = run["tasks"]
    real = next(t for t in tasks if not t["simulated"])
    simulated = next(t for t in tasks if t["simulated"])
    assert client.post("/api/tasks/" + real["id"] + "/complete").status_code == 200
    assert client.post("/api/tasks/" + simulated["id"] + "/complete").status_code == 409
    fresh = client.get("/api/journeys/" + run["id"]).json()
    assert fresh["evidence"]["human_tasks_pending"] == 2
    assert not fresh["employee_ready"]


def test_connection_test_never_sends_and_sanitizes_failures(client, monkeypatch):
    class SMTP:
        def __init__(self, *args, **kwargs):
            pass

        def ehlo(self):
            pass

        def quit(self):
            pass

        def send_message(self, msg):
            raise AssertionError("Connection test must not send")

    monkeypatch.setattr("smtplib.SMTP", SMTP)
    result = client.post("/api/settings/email/test")
    assert result.status_code == 200 and result.json()["connected"]

    def fail(*args, **kwargs):
        raise OSError("sensitive server exception")

    monkeypatch.setattr("smtplib.SMTP", fail)
    result = client.post("/api/settings/email/test")
    assert not result.json()["connected"]
    assert "sensitive" not in result.text


def test_exception_rbac(client, db):
    from app.security import hash_password, session_token

    role = m.Role(name="journey-reader")
    db.add(role)
    db.flush()
    db.add(m.Permission(role_id=role.id, code="hr.read"))
    user = m.User(username="journey-viewer", password_hash=hash_password("test-password-only"), role_id=role.id)
    db.add(user)
    db.commit()
    client.cookies.clear()
    client.cookies.set("humain_session", session_token(user))
    assert client.get("/api/journeys").status_code == 200
    assert client.get("/api/exceptions").status_code == 403
    assert client.post("/api/policies", json={}).status_code == 403
    assert client.post("/api/settings/email/test").status_code == 403


def test_contract_evidence_is_quoted_from_actual_source(db, actor, document):
    quote = documents.field_evidence(document, "salary", "15000")
    assert quote["matches_reviewed_value"]
    assert quote["location"] == "Row 2 / salary"
    assert quote["quote"] == "15000"
    changed = documents.field_evidence(document, "salary", "20000")
    assert changed["quote"] == "15000" and not changed["matches_reviewed_value"]
    assert documents.field_evidence(document, "renewal_terms", None)["quote"] is None


def test_policy_quote_and_reviewed_fields_are_audited(db, actor, document, smtp):
    p = policy(db, actor)
    journeys.activate_policy(db, p["id"], actor)
    run = journeys.start(db, JourneyInput(document_id=document.id, policy_id=p["id"]), actor)
    event = db.scalar(select(m.AuditEvent).where(m.AuditEvent.action == "journey.policy_checked"))
    assert event.detail["findings"][0]["policy_quote"] == p["source"]
    from app.schemas import ContractFields

    fields = run["extraction"]["fields"]
    fields["salary"] = "11000"
    documents.review(db, document.id, ContractFields.model_validate(fields), actor)
    event = db.scalar(select(m.AuditEvent).where(m.AuditEvent.action == "contract.reviewed"))
    assert any(
        c["field"] == "salary" and c["before"] == "15000" and c["after"] == "11000" for c in event.detail["changes"]
    )
    result = journeys.run(db, run["id"], actor)
    assert result["state"] == "VERIFIED" and result["findings"] == []
