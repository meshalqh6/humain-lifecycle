# Durable workflows

## Contract → onboarding

1. Authorized upload is committed with filename, SHA256 and raw bytes. Identical bytes return the existing document.
2. CSV/XLSX maps explicit columns without guessing. Text PDFs use local Qwen schema output and require human review. Missing fields, invalid/reversed dates, salary contradictions and uncertainty block routine onboarding.
3. A unique document workflow persists. Invalid extraction becomes AWAITING_REVIEW with an approval request; no employee or welcome email is created.
4. Validated input is checked against the authoritative employee number under a PostgreSQL lock. A conflicting profile requires review.
5. Employee, normalized contract and five tasks commit together. Three HR tasks stay pending; two IT requests are explicitly simulated.
6. Approved welcome outbox job is committed, then claimed before SMTP. The receipt is committed separately. A verified employee, contract and five tasks plus SMTP acceptance complete the automation setup.
7. State, step outcomes and audit are durable. An explicit retry reuses the document, employee, task and email identities. It does not create another welcome message.

Supported workflow states: CREATED, DOCUMENT_RECEIVED, EXTRACTING, VALIDATING, READY, RUNNING, AWAITING_REVIEW, COMPLETED, FAILED, CANCELLED. The schema admits these states; synchronous extraction currently commits directly to DOCUMENT_RECEIVED/AWAITING_REVIEW/RUNNING rather than presenting artificial progress through every intermediate label. Cancellation is restricted to unfinished workflows through the API. COMPLETED means automation setup, not final human employment approval.

## Renewal monitoring

Deadlines are derived from employees and active contracts using the tested inclusive-window rules. A scan persists or resolves alerts. Approved reminders are keyed by employee/kind/due date, prepared from approved templates, and checked against the actual due date and exact allowlist. SMTP execution records status and stable message ID. Repeating the same query returns the accepted receipt and records duplicate suppression in its outcome. Renewed due dates create a new notification identity.

The scheduler runs every 30 seconds while FastAPI is alive; its daily job is serialized by row lock. Pre-acceptance failures may retry up to three times. Uncertain SENDING/UNKNOWN outcomes never auto-retry. The local startup recovery marks interrupted model workflows failed and interrupted sends unknown. Multi-process startup would require leases/heartbeats and is outside this single-host demo.

## HUMAIN Chat

User message → persisted request identity → Qwen planning → strict tool argument validation → role permission check → HR service → committed result → trace/audit → model interpretation → streamed final response → persisted assistant message. Tool data is data, not authority. The UI exposes tool outcomes independently of the model’s wording. Missing Ollama produces an explicit failed conversation message; no canned assistant response replaces it.

## Approval handling

Extraction review is available in Contracts and requires approval.review; a successful source review resolves the associated review request. Unauthorized email recipients remain held until an administrator explicitly changes the allowlist/configuration and chooses Recheck authorization. That action revalidates the current recipient, employee and template under approval.review + email.send before preparing the job again. It cannot release an UNKNOWN/SENDING SMTP outcome. A pending job never grants itself permission. This demo does not have a general approval administration UI or a tool for approving contract terms.


## Contract-to-onboarding journeys

Journey workspace accepts a new or persisted contract and an objective. The durable plan is: read source, validate facts and selected company policy, create records, prepare tasks, send an authorized welcome, verify evidence. PDF interpretations retain their existing human source-review gate. Model errors and invalid files produce a durable FAILED journey with a resume action. Schema issues, duplicate employee identities, policy findings and email problems enter the exception inbox. Other journeys remain independent.

Company policies are manually defined deterministic checks against extracted fields, not general legal clause analysis. Upload/paste TXT source, define required/minimum/maximum/exact-value checks, and quote exact policy passages. Saves are drafts; activation requires settings.write and approval.review. Policy versions are immutable; deactivation stops selection for new journeys and preserves existing pinned versions. Source citations quote actual original CSV/XLSX cells or PDF text and explicitly flag edited values that differ. Findings retain policy quotation, actual field value, source location and recommended review action.

A policy exception requires approval.review plus the routine workflow permissions and a reason. Its fingerprint covers the current findings, so it does not waive changed facts. The policy gate also protects legacy onboarding API/tool entry points for contracts attached to a policy-controlled journey. Source corrections record before/after fields. A successful source review resumes the journey in the same action. Existing uncertain SMTP outcomes remain blocked, and simulated IT tasks cannot be attested as provisioned accounts.

VERIFIED means automation setup: employee/contract persisted, five tasks present, welcome SMTP accepted. The UI separately shows pending human tasks, simulated requests and unconfirmed inbox arrival. Internal HR task completion is a human attestation, audited and visible on reload. It is not an external IT-system integration.

Measured comparisons record a user-reported stopwatch/manual baseline for the same contract, action count and scope notes. Workflow execution time excludes chat/model planning, waiting and execution of the remaining human tasks. Live evaluation separately reports full Qwen request elapsed time. No population accuracy, savings or intervention-reduction claim is inferred from fixtures. Negative differences are retained.
