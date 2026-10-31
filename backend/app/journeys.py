"""Durable contract-to-onboarding objectives, evidence, policy exceptions and measurements."""

import hashlib
import json
import time
from decimal import Decimal
from fastapi import HTTPException
from sqlalchemy import select, func
from app import documents, onboarding, services
from app.database import models as m

PLAN = [
    "Read contract",
    "Check facts and company policy",
    "Create employee and contract",
    "Prepare HR tasks and IT requests",
    "Send authorized welcome",
    "Verify persisted outcomes",
]


def fingerprint(findings):
    return hashlib.sha256(json.dumps(findings, sort_keys=True, default=str).encode()).hexdigest()


def compare(fields, policy):
    findings = []
    for index, rule in enumerate(policy.rules):
        actual = fields.get(rule["field"])
        missing = actual is None or str(actual).strip() == ""
        op = rule["operator"]
        if missing:
            reason = "Contract information is missing; review the source"
        elif op == "required":
            continue
        elif op == "equals":
            if str(actual).casefold().strip() == rule["value"].casefold().strip():
                continue
            reason = "Contract value differs from company policy"
        else:
            number, expected = Decimal(str(actual)), Decimal(rule["value"])
            if (op == "maximum" and number <= expected) or (op == "minimum" and number >= expected):
                continue
            reason = "Contract value is outside the company policy threshold"
        findings.append(
            {
                "rule": index + 1,
                "field": rule["field"],
                "message": reason,
                "contract_value": actual,
                "policy_quote": rule["quote"],
                "operator": op,
                "expected": rule["value"],
                "policy_id": policy.id,
                "policy_title": policy.title,
                "suggestion": "Confirm or correct the source fact, or record an authorized policy exception. No contract terms are changed automatically.",
            }
        )
    return findings


def policy_gate(db, document_id, fields):
    journey = db.scalar(select(m.Journey).where(m.Journey.document_id == document_id))
    if not journey or not journey.policy_id:
        return
    policy = services.get(db, m.CompanyPolicy, journey.policy_id)
    findings = compare(fields, policy)
    if findings and not db.scalar(
        select(m.AuditEvent.id).where(
            m.AuditEvent.action == "journey.policy_exception",
            m.AuditEvent.object_id == journey.id,
            m.AuditEvent.detail["fingerprint"].astext == fingerprint(findings),
        )
    ):
        raise HTTPException(
            409, "This contract has unresolved company policy findings. Resolve its journey exception first."
        )


def create_policy(db, data, actor):
    policy = m.CompanyPolicy(
        title=data.title, source=data.source, rules=[r.model_dump() for r in data.rules], created_by=actor.id
    )
    db.add(policy)
    db.flush()
    services.audit(db, actor, "policy.drafted", policy.id)
    db.commit()
    return services.row(policy)


def activate_policy(db, policy_id, actor, active=True):
    policy = services.get(db, m.CompanyPolicy, policy_id)
    policy.active = active
    services.audit(db, actor, "policy.activated" if policy.active else "policy.deactivated", policy.id)
    db.commit()
    return services.row(policy)


def start(db, data, actor):
    services.get(db, m.ContractDocument, data.document_id)
    services.lock(db, "journey:" + data.document_id)
    journey = db.scalar(select(m.Journey).where(m.Journey.document_id == data.document_id))
    if journey:
        if journey.policy_id != data.policy_id:
            raise HTTPException(
                409, "This document already has a journey with a different policy. Keep its original policy version."
            )
        db.commit()
        return run(db, journey.id, actor)
    if data.policy_id:
        policy = services.get(db, m.CompanyPolicy, data.policy_id)
        if not policy.active:
            raise HTTPException(409, "Activate this company policy before using it")
    journey = m.Journey(
        document_id=data.document_id, policy_id=data.policy_id, requested_by=actor.id, objective=data.objective
    )
    db.add(journey)
    db.flush()
    services.audit(db, actor, "journey.created", journey.id, document_id=data.document_id)
    db.commit()
    return run(db, journey.id, actor)


def run(db, journey_id, actor, human_resume=True):
    journey = db.scalar(select(m.Journey).where(m.Journey.id == journey_id).with_for_update())
    if not journey:
        raise HTTPException(404, "Journey not found")
    if journey.state == "RUNNING":
        raise HTTPException(409, "This journey is running. Follow its progress instead of starting another attempt.")
    if journey.state == "VERIFIED":
        db.commit()
        return result(db, journey)
    if journey.attempts and human_resume:
        services.audit(db, actor, "journey.resumed", journey.id)
    journey.state, journey.error = "RUNNING", None
    journey.attempts += 1
    db.commit()
    started = time.perf_counter()
    try:
        extraction = documents.extract(db, journey.document_id, actor)
        policy = db.get(m.CompanyPolicy, journey.policy_id) if journey.policy_id else None
        journey.findings = compare(extraction["fields"], policy) if policy else []
        services.audit(
            db, actor, "journey.policy_checked", journey.id, policy_id=journey.policy_id, findings=journey.findings
        )
        if journey.findings:
            decision = db.scalar(
                select(m.AuditEvent).where(
                    m.AuditEvent.action == "journey.policy_exception",
                    m.AuditEvent.object_id == journey.id,
                    m.AuditEvent.detail["fingerprint"].astext == fingerprint(journey.findings),
                )
            )
        else:
            decision = None
        if journey.findings and not decision:
            journey.state = "AWAITING_REVIEW"
            journey.error = "Company policy findings require a source correction or an authorized exception"
            # Still extract/validate the contract. No employee or email is created across this gate.
        else:
            outcome = onboarding.run(db, journey.document_id, actor)
            journey.outcome = {"workflow_id": outcome["id"]}
            journey.state = "VERIFIED" if outcome["state"] == "COMPLETED" else outcome["state"]
            journey.error = outcome["error"]
            if journey.state == "VERIFIED":
                journey.verified_at = m.now()
        services.audit(db, actor, "journey." + journey.state.lower(), journey.id)
    except Exception as exc:
        db.rollback()
        journey = services.get(db, m.Journey, journey_id)
        journey.state = "FAILED"
        journey.error = (
            exc.detail
            if isinstance(exc, HTTPException) and isinstance(exc.detail, str)
            else "The operation stopped safely. Inspect the source or connection and resume."
        )
        services.audit(db, actor, "journey.failed", journey.id, error_type=type(exc).__name__)
    journey.elapsed_ms += round((time.perf_counter() - started) * 1000)
    db.commit()
    return result(db, journey)


def accept_exception(db, journey_id, note, actor):
    journey = db.scalar(select(m.Journey).where(m.Journey.id == journey_id).with_for_update())
    if not journey:
        raise HTTPException(404, "Journey not found")
    if journey.state != "AWAITING_REVIEW" or not journey.findings:
        raise HTTPException(409, "There are no current company policy findings to accept")
    extraction = db.scalar(select(m.ContractExtraction).where(m.ContractExtraction.document_id == journey.document_id))
    policy = services.get(db, m.CompanyPolicy, journey.policy_id)
    current = compare(extraction.fields, policy)
    if current != journey.findings:
        raise HTTPException(409, "Contract facts changed; resume to refresh the findings before recording an exception")
    services.audit(db, actor, "journey.policy_exception", journey.id, note=note, fingerprint=fingerprint(current))
    db.commit()
    return run(db, journey_id, actor, human_resume=False)


def result(db, journey):
    doc = services.get(db, m.ContractDocument, journey.document_id)
    extraction = db.scalar(select(m.ContractExtraction).where(m.ContractExtraction.document_id == doc.id))
    flow = db.scalar(select(m.OnboardingWorkflow).where(m.OnboardingWorkflow.document_id == doc.id))
    tasks = (
        db.scalars(select(m.HRTask).where(m.HRTask.workflow_id == flow.id).order_by(m.HRTask.created_at)).all()
        if flow
        else []
    )
    contract = db.scalar(select(m.Contract).where(m.Contract.document_id == doc.id))
    jobs = (
        db.scalars(
            select(m.NotificationJob)
            .join(m.NotificationTemplate)
            .where(m.NotificationJob.employee_id == flow.employee_id, m.NotificationTemplate.code == "welcome")
        ).all()
        if flow and flow.employee_id
        else []
    )
    validation = documents.extraction_result(db, extraction) if extraction else None
    accepted = bool(jobs) and all(j.state == "SMTP_ACCEPTED" for j in jobs)
    pending = sum(t.status != "completed" and not t.simulated for t in tasks)
    evidence = {
        "employee_id": flow.employee_id if flow else None,
        "contract_id": contract.id if contract else None,
        "tasks_created": len(tasks),
        "human_tasks_pending": pending,
        "it_requests_simulated": sum(t.simulated for t in tasks),
        "smtp_accepted": accepted,
        "inbox_delivery_confirmed": False,
        "email_jobs": [services.row(j) for j in jobs],
    }
    stages = [
        bool(extraction),
        bool(validation and validation["valid"]),
        bool(contract and flow and flow.employee_id),
        len(tasks) == 5,
        accepted,
        bool(contract and len(tasks) == 5 and accepted),
    ]
    trace = [
        {
            "name": "Validate contract facts (no company policy selected)"
            if i == 1 and not journey.policy_id
            else name,
            "state": "verified"
            if stages[i]
            else "needs_attention"
            if journey.state in {"FAILED", "AWAITING_REVIEW"} and not all(stages[: i + 1])
            else "pending",
        }
        for i, name in enumerate(PLAN)
    ]
    if journey.findings:
        trace[1]["state"] = (
            "exception_recorded"
            if db.scalar(
                select(m.AuditEvent.id).where(
                    m.AuditEvent.action == "journey.policy_exception",
                    m.AuditEvent.object_id == journey.id,
                    m.AuditEvent.detail["fingerprint"].astext == fingerprint(journey.findings),
                )
            )
            else "needs_attention"
        )
    measurement = db.scalar(select(m.JourneyMeasurement).where(m.JourneyMeasurement.journey_id == journey.id))
    interventions = db.scalar(
        select(func.count())
        .select_from(m.AuditEvent)
        .where(
            (
                (m.AuditEvent.object_id == journey.id)
                & m.AuditEvent.action.in_(["journey.resumed", "journey.policy_exception"])
            )
            | ((m.AuditEvent.object_id == journey.document_id) & (m.AuditEvent.action == "contract.reviewed"))
        )
    )
    saving = (
        round(measurement.manual_seconds - journey.elapsed_ms / 1000, 2)
        if measurement and journey.state == "VERIFIED"
        else None
    )
    return {
        **services.row(journey),
        "filename": doc.filename,
        "policy_findings_with_sources": [
            {**finding, "contract_source": documents.field_evidence(doc, finding["field"], finding["contract_value"])}
            for finding in journey.findings
        ],
        "source_sha256": doc.sha256,
        "extraction": validation,
        "plan": trace,
        "evidence": evidence,
        "tasks": [services.row(t) for t in tasks],
        "automation_setup_verified": bool(all(stages) and journey.state == "VERIFIED"),
        "employee_ready": bool(journey.state == "VERIFIED" and not pending and not any(t.simulated for t in tasks)),
        "human_interventions": interventions,
        "measurement": services.row(measurement) if measurement else None,
        "time_difference_seconds": saving,
        "measurement_scope": "Workflow execution across attempts; excludes chat/model planning, human wait and completion of manual HR tasks. Manual baseline must cover the same preparation steps and is user-reported.",
    }


def measure(db, journey_id, data, actor):
    journey = services.get(db, m.Journey, journey_id)
    if journey.state != "VERIFIED":
        raise HTTPException(409, "Measure the comparison after automation setup is verified")
    services.lock(db, "measure:" + journey_id)
    measurement = db.scalar(select(m.JourneyMeasurement).where(m.JourneyMeasurement.journey_id == journey_id))
    if not measurement:
        measurement = m.JourneyMeasurement(journey_id=journey_id, recorded_by=actor.id, **data.model_dump())
        db.add(measurement)
    else:
        for key, value in data.model_dump().items():
            setattr(measurement, key, value)
        measurement.recorded_by = actor.id
    services.audit(db, actor, "journey.baseline_recorded", journey.id, **data.model_dump())
    db.commit()
    return result(db, journey)


def inbox(db):
    journeys = db.scalars(
        select(m.Journey).where(m.Journey.state.in_(["AWAITING_REVIEW", "FAILED"])).order_by(m.Journey.created_at)
    ).all()
    workflow_ids = set(db.scalars(select(m.Journey.document_id)))
    legacy = db.scalars(
        select(m.OnboardingWorkflow).where(m.OnboardingWorkflow.state.in_(["AWAITING_REVIEW", "FAILED"]))
    ).all()
    jobs = db.scalars(
        select(m.NotificationJob).where(
            m.NotificationJob.state.in_(["AWAITING_REVIEW", "FAILED", "UNKNOWN", "SENDING"])
        )
    ).all()
    return {
        "journeys": [result(db, j) for j in journeys],
        "onboarding": [services.row(w) for w in legacy if w.document_id not in workflow_ids],
        "email": [services.row(j) for j in jobs],
    }
