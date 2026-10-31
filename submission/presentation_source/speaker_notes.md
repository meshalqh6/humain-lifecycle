# Speaker notes

## Slide 1

HUMAIN Lifecycle is an existing local hackathon prototype. Its goal is to prepare onboarding from an incoming authorized contract and verify the resulting records. Final HR decisions remain with people. All product examples in this deck use synthetic employee data.

Sources: README.md; docs/HACKATHON_DEMO.md; docs/UI_DESIGN_SYSTEM.md

## Slide 2

This slide describes the business process targeted by the prototype. These are qualitative workflow challenges, not survey findings or measured cost estimates. The project connects intake, policy checks, HR task preparation, communications and evidence in one workflow.

Sources: docs/WORKFLOWS.md; backend/app/onboarding.py; backend/app/journeys.py

## Slide 3

HUMAIN Chat interprets the user objective and invokes registered typed tools. Python owns permission checks, policy gates and durable side effects. Verification checks persisted records. Automation setup can be verified while three human HR tasks remain pending and IT requests remain simulated.

Sources: backend/app/agent.py; backend/app/journeys.py; backend/app/onboarding.py; docs/JOURNEY_LIVE_EVALUATION.json

## Slide 4

The registry includes extract_contract, validate_contract, start_onboarding_journey, get_company_policies, create_onboarding, get_expiring_documents, send_authorized_email and get_audit_history. Contract table parsing and policy comparisons use deterministic code where appropriate. This is one locally hosted model coordinating tools, not six independent LLM agents.

Sources: backend/app/agent.py REGISTRY; backend/app/documents.py; backend/app/journeys.py; backend/app/email_agent.py

## Slide 5

Vite proxies local /api requests to FastAPI. The backend validates typed requests, checks permissions, orchestrates tool calls and owns transactions. PostgreSQL 17 is authoritative and uses a persistent named Docker volume. Ollama runs on the Windows host. Email uses either Mailpit sandbox capture or explicitly configured and authorized SMTP. Qwen has no arbitrary SQL, shell or SMTP credential access. The independent test database uses a separate Docker service.

Sources: docs/ARCHITECTURE.md; backend/app/main.py; backend/app/security.py; backend/app/database/models.py; backend/app/ollama.py; docker-compose.yml

## Slide 6

All five screenshots were captured from the running local application for this deck on 31 October 2026 Riyadh time. The employee data is synthetic. Policy management shows an existing inactive draft, not an approved corporate policy. Cropped thumbnails preserve the original UI pixels. The source folder includes the full captures. Counts represent the capture moment and may change as the app runs.

Sources: submission/presentation_assets/dashboard.png; submission/presentation_assets/employees.png; submission/presentation_assets/contracts.png; submission/presentation_assets/policies.png; submission/presentation_assets/chat.png

## Slide 7

The diagram groups responsibilities rather than prescribing the exact sequence of LLM calls. The objective is persisted in a journey. Policy validation applies only when the user selects an activated policy. The recorded 37.036-second example used contract fact validation without an activated policy. Unresolved policy findings block creation and communication until an authorized review or recorded exception resolves them. HR remains responsible for official Qiwa approval. IT tasks are simulated requests only.

Sources: backend/app/journeys.py PLAN and policy_gate; backend/app/onboarding.py; backend/app/email_agent.py; docs/JOURNEY_LIVE_EVALUATION.json; tmp/pdfs/journey.json

## Slide 8

The 67-test milestone is explicitly reported in docs/TEST_REPORT.md. The newer full check in docs/SYSTEM_CHECK_2026-10-30.md records 101 passing tests and is supported by backend-results.xml and browser-results.json. The single saved primary-database journey records 37.036 seconds total, 2074 milliseconds core workflow execution, five tasks, three pending human HR tasks, two simulated IT requests, verified automation setup and SMTP acceptance. An explicit retry produced no new SMTP attempts. The timings are not averages or a benchmark, and there is no measured human baseline. Inbox delivery is unconfirmed for this historical journey. A separate later demo has independently confirmed Gmail receipt, but that is not attributed to this timed example.

Sources: docs/TEST_REPORT.md; docs/JOURNEY_LIVE_EVALUATION.json; docs/SYSTEM_CHECK_2026-10-30.md; docs/backend-results.xml; docs/browser-results.json

## Slide 9

Business value here is the implemented ability to coordinate preparation, enforce policy and authorization, avoid duplicate effects and expose evidence. No quantified savings or official compliance outcome is claimed. PDF extraction currently depends on extractable document text and has no scanned-document OCR. IT provisioning is simulated. Future OCR, external task/IT connectors, broader unseen test sets and measured manual baselines are proposals, not implemented features. This is a local hackathon prototype rather than a production-ready service.

Sources: backend/app/documents.py; backend/app/journeys.py; backend/app/onboarding.py; docs/SECURITY.md; docs/HACKATHON_DEMO.md

## Slide 10

The evidence panel faithfully recreates the original Verified evidence layout as sharp editable text, with the same labels, actual record IDs, results, warning and full source fingerprint. It is a transcription, not a screenshot. The original screenshot and underlying recorded values remain in presentation_assets. SMTP acceptance does not establish inbox delivery for this timed example. Human approvals and real IT provisioning remain separate. The Contract intake link opens the local app.

Sources: docs/JOURNEY_LIVE_EVALUATION.json; submission/presentation_assets/recorded-journey-evidence.json; submission/presentation_assets/journey-evidence.png