# HUMAIN Lifecycle system check

Checked 30 October 2026. Final automated run: `scripts/test.ps1 -Browser`.

## Results

| Check | Result | Scope |
| --- | --- | --- |
| PostgreSQL backend tests | 81 passed | Contracts, validation, workflow recovery, idempotency, permissions, email policies, audit, archiving, Saudization and chat scope |
| Frontend unit tests | 3 passed | API client behavior |
| Browser tests | 17 passed | All sidebar pages, desktop/mobile layouts, employee creation/archive, profession drilldown, chat menus/archive/history, upload/onboarding, policy exceptions, tasks and settings persistence |
| Static checks and build | Passed | Ruff, ESLint, TypeScript/Vite build, Alembic schema check and Git whitespace check |
| Live Qwen scope checks | 9 passed | English/Arabic greetings, capabilities, unrelated questions, prompt override attempt, HR arithmetic and contextual follow-up |
| Live application API smoke check | 23 endpoints returned successfully | Health, records, workflows, communications, settings, audit and evaluation views |
| Application restart | Passed | PostgreSQL records remained available; corrected step order confirmed after restart |

The automated suites use the separate `humain_test` PostgreSQL database. Browser email tests use the sandbox transport; no additional real emails were sent during this system check. The test database service was stopped afterward. The live app remains running at http://127.0.0.1:5173.

## Findings corrected

- Onboarding steps were displayed by creation timestamp. Tied timestamps could show them in the wrong sequence. Display now follows the defined seven-step workflow, with a regression test for tied timestamps.
- Two browser expectations still described the previous workspace-card label and a metric footer the user had removed. Updated the checks to validate the current logo and requested UI.
- A repeated journey test could match an older employee with the same display name. Its synthetic policy and employee names now use a unique suffix.

## Actual email and onboarding evidence

The preceding visible walkthrough uploaded `demo/live-email-demo-75ab74.csv` and created **Live Email Demo 75ab74**, employee number `LIVE-20261030-75ab74`.

- One contract, one employee, five tasks and seven verified automation steps persisted.
- Welcome job `fdf16196-1065-41a5-a570-5cbb13777454` records **SMTP_ACCEPTED**, one attempt.
- The matching welcome message was independently found and opened in **meshalqh6@gmail.com**, with the correct synthetic employee name. Gmail message ID: `1a18d83f1fd2663c`; received about 18:53 Riyadh time.
- Gmail inbox receipt is independently verified for this message. The app's SMTP receipt alone does not establish inbox delivery for other messages.
- Three human HR tasks remain pending; two IT requests are explicitly simulated. **Verified automation setup does not mean completed employee onboarding.**

Evidence: Gmail inbox receipt (retained privately by the author), [onboarding](../submission/live-email-demo/onboarding.jpg), [SMTP receipt](../submission/live-email-demo/delivery.jpg), [live API snapshot](live-system-check.json), [backend results](backend-results.xml), [browser results](browser-results.json).

## Limits of this check

This validates the tested local workflows, not every possible input or production environment. The nine live model checks are a small functional sample, not a held-out accuracy benchmark. No new measured manual baseline, time-saving claim, production security assessment, real IT provisioning or official Qiwa approval is established by these results. Older messages addressed to unapproved `.test` recipients remain held for review as intended.

The backend suite emitted one dependency deprecation warning about Starlette's HTTPX test client; it did not fail a check.
