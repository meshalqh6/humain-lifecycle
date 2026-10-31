# Hackathon walkthrough

Start with scripts/start.ps1 and sign in with the generated local admin password. Confirm PostgreSQL/Ollama status under Integrations and open Mailpit at http://127.0.0.1:8025. Use synthetic data only. The app never imports external employee records automatically.

## Scenario A — an employee’s first day

1. Open Contracts. Upload demo/qiwa-synthetic.csv, a clearly synthetic Qiwa-style authorized export. It is not an official Qiwa document or approval.
2. Review the extracted fields and validation status. If this same document was already demonstrated, retries intentionally reuse its employee/workflow rather than creating another profile.
3. Choose Ask HUMAIN Chat in the library to attach the document, or use the paperclip in HUMAIN Chat.
4. Ask: “Review this contract, verify the employee, complete onboarding, prepare HR tasks, and send the authorized welcome email.”
5. Watch the tool timeline: extraction/validation → create_onboarding → committed workflow result. Open Onboarding to inspect all seven automation steps and five human/simulated tasks.
6. Open Employees to inspect the persisted profile and normalized contract. Open Communications to inspect the approved template job and SMTP_ACCEPTED receipt. Verify the message in Mailpit. Explain that acceptance is not confirmed delivery to an external inbox.
7. Open Audit Trail to inspect the actual object references. Refresh the browser or restart the app; records remain.

## Scenario B — routine renewals

Ask: “Find documents expiring within 30 days and send approved renewal reminders.” Qwen queries the database and invokes the approved reminder tool. The seeded first employee has a contract in the window; tests also cover Iqama and work-permit dates. Inspect job states, Mailpit and audit. Repeat the request and verify no extra SMTP attempt for the same employee/template/due date.

## Reproduce measurements

Run `.\.venv\Scripts\python.exe scripts/live_smoke.py` from project root. It creates a fresh synthetic contract identity, performs both real Qwen scenarios, explicitly retries onboarding/reminders, and saves observed results to docs/LIVE_EVALUATION.json. No external SMTP is allowed by that script. The JSON includes persisted messages, tool verification, workflow state, latency and Mailpit count. Mailpit count can include browser test messages; it is not an isolated delivery-rate metric.

Run `.\.venv\Scripts\python.exe scripts/verify_persistence.py` when no workflow is running to verify PostgreSQL survives a container restart. It preserves the volume. Run scripts/backup.ps1 to back up the database. See TEST_REPORT.md for recorded results.

## Manual baseline protocol (not yet timed by a human)

Use a new synthetic employee and a stopwatch. Read the same contract, record employee/contract details manually, create the five specified HR/IT request tasks, prepare the same approved welcome template, send to the sandbox and verify records/audit. Record start/end times, active human time, fields entered, corrections and interventions in demo/manual-baseline.csv. Repeat at least five times with matched contract fixtures. Compare medians with fresh successful automated runs, excluding reused/idempotent runs. Time saved = measured manual duration minus matched automated duration. Do not claim a time-saving percentage before this is populated.

Measure extraction accuracy with independently labeled field values across a representative PDF/XLSX/CSV set. Deterministic table mapping tests are not evidence of general PDF interpretation accuracy. Schema validity and successful tool calls do not establish legal correctness.


## Preferred objective-first demonstration

1. Open Journey workspace. Inspect the saved **Journey Demonstration** from the real Qwen run; its source is synthetic and its employee/contract/tasks are persisted.
2. Follow the six-step plan and Verified evidence. Show that VERIFIED covers automation setup, while three human tasks and two simulated IT requests remain. Gmail SMTP acceptance is recorded; confirm inbox arrival separately.
3. For a fresh sandbox demo, use a unique synthetic contract and select an explicitly activated fictional policy. Leave a required field missing. Exceptions should show the blocker with actual source/policy quotations and no employee/email side effects across the gate.
4. Review source facts and save: the same action resumes the objective. Record a justified policy exception only when authorized; changing facts invalidates the prior exception fingerprint.
5. Complete a human task in Tasks. Refresh to show persistence, and show that a simulated IT request cannot be marked as real provisioning.
6. Repeat a verified journey: no additional email attempt. Inspect the audit record and source fingerprint.
7. Record a manual baseline only after performing the same scoped steps with a stopwatch. The UI comparison excludes chat planning, waiting and completion of the human tasks; report full Qwen request latency separately.

The saved primary example was measured at 37.036 seconds including Qwen, with 2.074 seconds in workflow execution. It has no human baseline or claimed time-saving percentage. See JOURNEY_LIVE_EVALUATION.json. The new real-SMTP script requires an explicit opt-in flag and uses the configured approved alert address. The older live_smoke.py remains strictly sandbox-only and now checks the effective saved mode as well as environment defaults.
