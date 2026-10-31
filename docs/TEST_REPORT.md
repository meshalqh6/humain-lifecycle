# Verification report — 29 October 2026

Environment: Windows, Python 3.10, Node 24, Docker Desktop/Compose, PostgreSQL 17 official image, Edge Playwright, installed `qwen3.5:4b`. Exact Python and Node dependencies are locked. Tests use an isolated `humain_test` database on port 55433, never the development volume.

| Check | Observed result |
| --- | --- |
| Backend pytest | 38 passed; original SHA256 and AST preservation checks included |
| PostgreSQL migration | Upgrade to head succeeds; Alembic check finds no pending operations |
| Python Ruff | Pass |
| TypeScript / production build | Pass; chart and Markdown chunks split below 500 kB each |
| Frontend ESLint | Pass |
| Vitest transport unit tests | 3 passed |
| Edge Playwright | 9 passed; email settings save/reload without sending, full-width layout at 2560 × 1440, supplied logo loading and legacy assistant redirects, routes, directory creation/search/profile, contract intake/onboarding persistence, Arabic stream/trace/error, mobile viewport and API outage |
| Browser console | Navigation test checks both page exceptions and console.error; fixed invalid nested paragraph markup |
| Real Qwen scenario A | Fresh synthetic onboarding completed in 29.421 seconds including model/tool overhead |
| Real Qwen scenario B | Renewal reminder workflow completed in 6.814 seconds |
| Error recovery | Live Qwen recovered from one failed employee lookup, then completed onboarding; failed call is retained in its trace |
| Explicit repeated actions | Zero new SMTP attempts when onboarding and existing renewal jobs were retried |
| Actual SMTP | Mailpit accepts welcome and renewal messages; job states and server message count recorded. Inbox delivery to external employees is not claimed |
| Database restart | Exact pre/post hashes match across 14 employee IDs, 14 contracts, 2 onboarding workflows, 3 notification jobs and 6 conversations; volume retained |
| Backup | pg_dump custom-format backup successfully copied to ignored runtime/backups |
| Local Windows start/stop | Hidden services start, health checks pass; fixed virtual-environment child process cleanup and occupied-port detection. Full setup succeeded; graceful shutdown closed both application ports, duplicate startup was rejected and restart health passed |
| Original Sadiah | Every inventoried root file remains byte-identical; no original data/credentials imported |

Machine-readable evidence: backend-results.xml, browser-results.json, LIVE_EVALUATION.json PERSISTENCE_REPORT.json and WINDOWS_RUN_REPORT.json. Playwright screenshots live in screenshots/. Live counters include earlier real local smoke attempts; scenario timings refer to the latest fresh synthetic run, not a population-wide benchmark. One earlier successful cold onboarding took 70.599 seconds in the persisted agent ledger. Mailpit can also contain synthetic browser-test messages.

## Coverage details

Deterministic tests exercise date parsing and boundary windows, missing nationality/profession values, original report/alert keys, held-email policy review without bypassing uncertain SMTP states, JSON/tool validation, permissions, conversation ownership and persistence, streaming outcomes, model outage, employee CRUD/idempotency/search/pagination/archive, document hash suppression, CSV/XLSX extraction, mocked PDF schema interpretation with review gate, unsafe upload types, formula-as-text handling, roster preview/import/dedup/date failure, complete onboarding, database consistency across new sessions, SMTP failures/recovery, uncertain SMTP refusal to retry, recipient blocking, grounded reminder dates, duplicate suppression, compliance alert resolution, audit entries and scheduler persistence.

Browser transport simulation is labeled and deterministic; it does not count as the real model verification. Real Qwen and actual Mailpit are exercised separately by scripts/live_smoke.py, including final workflow states and explicit retries. Production SMTP and real IT/Qiwa operations were not tested or enabled.

## Defects found and resolved

PostgreSQL date-varchar comparison, copied-function test encoding, incorrect test table count, JSX closing brace, omitted persisted message content, sidebar overflow on short viewports, stale Windows child server after stop, UTC/local PID comparison, and invalid paragraph nesting were found through the checks and fixed. Final reports supersede earlier failed runs; failures were not represented as successful integrations.

One third-party Starlette TestClient deprecation warning remains: it recommends httpx2. The pinned httpx TestClient path passes all tests. This is not an integration failure.

## Evidence limits

No human stopwatch baseline has been collected. Time saved and intervention reduction are unmeasured and returned as null. General extraction accuracy is unmeasured; unit fixtures validate behavior but are not a representative PDF benchmark. A full WCAG/screen-reader assessment, production penetration test, external SMTP delivery verification and multi-process reliability review remain outside the tested local hackathon scope.

## HUMAIN branding refresh

The user-supplied transparent logo is used unchanged in sidebar, login, chat, assistant messages, hero and favicon. Colors now follow the supplied black/teal/turquoise/electric-lime references. HUMAIN Chat replaces WASL in the interface and model system identity. /wasl redirects to /chat without losing query parameters. Existing conversation and workflow records are retained. Desktop and mobile screenshots were refreshed.

## Floating surface redesign verification

A CSS-only surface refinement was applied across the platform using shared elevation tokens, rounded app/sidebar shells, layered cards, gradient highlights and raised controls. The full backend suite (33), frontend unit suite (3), production build, lint, migration consistency and browser suite (7) passed. Development screenshots were captured for every route, including Settings, Integrations, Employees, Contracts, Onboarding, Compliance, Communications, Analytics, Audit, Overview and Chat, with no page exceptions. Mobile navigation and composer visibility were checked at 390 × 844. Screenshots disable transitions to capture settled layouts. No backend business logic or database schema changed.

## Full-window layout verification

The app shell now meets all viewport edges and removes the centered content width cap. A new browser regression verifies sidebar origin and full viewport height, adjoining main shell, right-edge alignment and uncapped content width at 2560 × 1440. Mobile overflow/composer checks continue to pass. Latest checks: 33 backend tests, 3 frontend unit tests and 8 browser tests passed, plus production build, lint and migration consistency.

## Editable email settings verification

Migration cf80340d0d11 and the normalized metadata check pass. Five new PostgreSQL-backed tests cover persisted UI preferences, encrypted password storage and write-only responses, role enforcement, explicit real-SMTP authorization and credential requirements, global HR reminder routing versus employee welcome routing, no duplicate rerouting of existing receipts, and rosters without employee email. A new Edge test edits the alert recipient/window, saves, reloads and verifies persistence with no new SMTP log. Latest totals: 38 backend + 3 unit + 9 browser = 50 passed. External SMTP was configured only with synthetic credentials in the isolated test database; no real external message was sent. The actual sender/recipient credentials from the Sadiah reference screenshot were not imported.

## Journey workspace — 30 October 2026

The new end-to-end browser scenario exercises policy draft/activation, CSV intake, a held policy/missing-field exception with no email, source correction and automatic resume, persisted evidence, manual baseline fixture, an actual internal task completion, deduplicated retry and mobile width. The baseline used by this automated scenario is synthetic in the isolated test database, not a measured human result.

New PostgreSQL-backed tests cover source quotation integrity, changed-value warning, cross-entry-point policy gates, explicit activation, narrowly scoped policy exceptions, audit before/after corrections, durable extraction failures, running claims, measurement boundaries/negative differences, task completion versus simulated IT, connection-only SMTP diagnostics and role restrictions.

Real local Qwen selected start_onboarding_journey and completed a fresh synthetic primary-database scenario in 37.036 seconds including model/tool/stream overhead. Core workflow execution took 2.074 seconds. Five tasks were persisted (three pending human tasks and two simulated IT requests). Gmail authenticated and accepted the real welcome to the configured approved alert recipient. Inbox arrival remains unconfirmed. Explicit retry produced zero new SMTP attempts. Evidence: JOURNEY_LIVE_EVALUATION.json. No manual baseline, extraction accuracy or time-saving percentage is claimed.

Final journey verification: **50 backend + 3 frontend unit + 10 Edge browser tests = 63 passed**, plus Ruff, ESLint, TypeScript/production build and Alembic consistency. Desktop/mobile new-view captures show no page/console errors and no horizontal overflow. Report UTF-8 normalization and secret scan pass.


## Chat navigation refresh — 30 October 2026

Latest full checks: 51 PostgreSQL-backed backend tests, 3 frontend unit tests and 11 Edge browser tests (65 total), plus Ruff, ESLint, TypeScript/build and Alembic consistency. The new browser scenario covers history search, opening and reloading a saved conversation via its URL, New chat, sidebar collapse/expand, mobile selection/automatic close, turquoise icon, removal of the context panel/processing promise, composer visibility and no horizontal overflow. Existing Arabic streaming/trace handling continues to pass. Capture tooling now waits for the composer model indicator instead of the removed context panel. No backend or SMTP behavior changed.


## Shared workspace card verification

The global sidebar workspace card was verified on Overview, Chat and Journeys. Clicking it opens Settings; on mobile it also closes the application drawer without horizontal overflow. The HUMAIN Workspace title fits within the card. Latest checks: 51 backend, 3 unit and 12 browser tests (66 total), plus lint, build and migration consistency. No backend behavior changed.


## Inter typography and text clarity — 30 October 2026

All 12 application routes, the Journey tabs, login and the employee dialog were rendered and inspected at desktop/mobile sizes (30 captured views). Inter 400/500/600/700 load from the same local origin. No horizontal page overflow, text-opacity findings or detected text-contrast failures remain in this check. Axe cannot resolve many gradient backgrounds; the supplemental check composites all gradient stops conservatively and samples the rendered background under actual text ranges when whole-surface bounds are inconclusive. The two localized hero cases measured 12.87:1 and 11.37:1 at their actual positions. The report preserves axe incomplete cases and methodology; it does not claim a full WCAG assessment. Evidence: TYPOGRAPHY_REPORT.json and refreshed development screenshots.

Regression coverage verifies local Inter loading throughout the app, heading/control weight, unblurred dialogs, mobile composer visibility, all three selected Overview footer removals, the Analytics note removal and retained Baseline needed status. Latest full suite: 51 backend + 3 unit + 13 browser tests = 67 passing, plus build, lint and Alembic consistency. No business logic, data, SMTP settings or workflows changed.


After the final copy removals, the focused email-settings, Arabic keyboard/stream and global typography scenarios passed again (3/3). The same typography scenario now verifies that connection-card descriptions/metadata and the Sadiah subtitle are absent while four connection badges remain; it also checks the shortened welcome, missing keyboard hint, removed Analytics note and retained Baseline needed. All 30 desktop/mobile/dialog captures were rechecked with no detected contrast, opacity or horizontal-overflow findings. Font and SVG changes do not modify business records or SMTP behavior.
