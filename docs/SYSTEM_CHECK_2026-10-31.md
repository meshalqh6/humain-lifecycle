# HUMAIN Lifecycle pre-demo system check

Checked 31 October 2026 (Asia/Riyadh). Command: `scripts/test.ps1 -Browser`.

## Results

| Check | Result |
| --- | --- |
| PostgreSQL backend tests | 81 passed in 29.12 seconds |
| Frontend unit tests | 3 passed |
| Browser workflow tests | 17 passed in 45.3 seconds |
| Total automated suite | 101 passed; no failures |
| Ruff, ESLint, TypeScript and production build | Passed |
| Alembic schema check | Passed; no new upgrade operations detected |
| Local scope/routing checks | 9 passed; local Qwen used where the router requires classification |
| Main application API smoke checks | 23 endpoints returned HTTP 200 |
| Running main app | Frontend HTTP 200, PostgreSQL 17 connected, Qwen3.5:4b ready |

## Synthetic workflow coverage

The existing suites exercised employee creation, search and archiving; profession Saudization and workforce drilldown; document intake and validation; onboarding persistence; selected company-policy exceptions and review/resume; task evidence; sandbox email; duplicate prevention; permissions and audit; chat history, menus and archiving; Arabic chat rendering; mobile layout; API outage recovery; and email settings persistence.

The nine scope checks covered standalone arithmetic, unrelated weather and trivia, Arabic requests, attempted scope override, HR arithmetic, profession follow-up, greetings and capabilities. These checks call the scope router directly and do not execute business tools or send email. They are a small functional sample, not a held-out accuracy benchmark.

## Isolation and demo state

- Automated writes used the separate `humain_test` PostgreSQL service, test API on port 8001 and test UI on port 5180.
- The runner used sandbox SMTP configuration; deterministic backend checks mock SMTP and model calls where appropriate.
- Main application counts were unchanged before and after: 17 employees, 18 contracts, 7 documents, 30 tasks and 3 journeys.
- Main SMTP attempt total remained 14. This check caused no new main-workspace SMTP attempts or external messages.
- Normal authentication generated audit login records. No demo employee, contract or journey was added to the main workspace.
- The isolated test database service was stopped after verification. The main app remains available at http://127.0.0.1:5173/.

## Evidence and limits

Detailed automated evidence: `docs/backend-results.xml` and `docs/browser-results.json`. Local logs and the before/after API summaries are retained under ignored `runtime/pre-demo-*` files.

The backend emitted one dependency deprecation warning; it did not fail a check. This run establishes the tested workflows, not every possible contract or production deployment. New real Gmail delivery, full employee onboarding, official Qiwa approvals, real IT provisioning, extraction accuracy and human time savings were not established by this check.
