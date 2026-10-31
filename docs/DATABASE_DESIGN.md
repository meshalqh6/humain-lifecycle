# Database design

29 application tables plus `alembic_version`. All models have UUID-string keys and indexed UTC timestamps. API dates use ISO Gregorian values. The deadline adapter selects the Riyadh calendar date explicitly. Date-only data is not converted to local midnight timestamps.

| Area | Tables and relationships |
| --- | --- |
| Organization | departments → employees; employees have a unique employee_number and creation idempotency key, optional department, soft-delete timestamp, nationality/profession and document deadlines |
| Contracts | employees → contracts; contract_documents → contract_extractions → document_validation_results; contract document SHA256 and extraction-per-document are unique; contract date range and nonnegative salary checked |
| Onboarding | document → onboarding_workflows (unique); employee → workflow (unique); workflow → onboarding_steps and hr_tasks; task keys deduplicate repeated setup |
| Compliance | employees → compliance_alerts unique on employee/kind/date; saudization_snapshots store normalized total/saudi/rate and profession JSONB |
| Email | notification_templates → notification_jobs → email_logs; job identity is employee UUID/template code/due date or welcome-once |
| Agent | users → agent_conversations → agent_messages and agent_workflows; workflows → agent_workflow_steps and agent_tool_executions; request keys are unique and scoped to user |
| Security | roles → permissions and users; permissions unique by role/code; approval_requests record review gates; audit_events record actor, action, object and structured detail |
| Scheduling | scheduler_jobs have unique names, due/last-run timestamps, persisted state and retry counters |

Core employee and contract data never lives solely in JSONB. Extraction retains uncertain fields and source linkage without overwriting authoritative profiles. Document bytes are retained in PostgreSQL; no upload path traversal is possible. FKs default to restricting unsafe deletion. Reset explicitly walks only synthetic employee dependents and preserves audit records.

`backend/alembic/versions/decfa9dfa3a8_initial_normalized_hr_and_durable_agent_.py` is a concrete initial DDL migration, not an application-start create_all substitute. Autogeneration check verifies metadata consistency. Test startup applies the same migration to the isolated database. Production migrations are never rolled back by tests.

Transactions use the database isolation default READ COMMITTED, row locks for SMTP and scheduler claims, and transaction-scoped advisory locks for idempotent inserts. SMTP occurs between separate committed outbox state transitions. A crash after the claim leaves SENDING, recovered as UNKNOWN on restart; an uncertain external send cannot be inferred from database state. Audit is append-only through the application API. It is not cryptographically immutable against the database owner.

Migration cf80340d0d11 adds singleton application_email_settings: validated UI email preferences in JSONB, authenticated ciphertext in encrypted_password, timestamps and a singleton check constraint. No employee or notification history is rewritten by this migration.


Migration 5dd768d6fe7e adds immutable versioned company_policies, one durable journey per source document, and one editable measured manual baseline per journey in journey_measurements. Policies retain source text and validated exact quotations. Activation, findings, source corrections, exceptions and baseline edits are audited. Journey RUNNING claims are row-locked and committed before work; interrupted journeys become FAILED at single-host startup. Original employee, contract, task and SMTP deduplication constraints remain authoritative.
