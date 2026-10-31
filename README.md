# HUMAIN Lifecycle

**People, connected. Powered by HUMAIN Chat.**

A working local employee lifecycle application for the Autonomous Enterprise challenge: React + TypeScript, FastAPI, PostgreSQL 17 in Docker, local Qwen through Ollama, and an authorized SMTP outbox. This is an independent hackathon project with HUMAIN-inspired styling, not an official HUMAIN product.

## Quick start on Windows

Install Python 3.10+, Node.js 22+, Docker Desktop (WSL2 Linux containers), and Ollama. Docker Desktop must be running. See [Docker’s Windows installation guide](https://docs.docker.com/desktop/setup/install/windows-install/). The inspected laptop already had Docker and `qwen3.5:4b` installed; setup never downloads a model automatically.

From this project directory:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/setup.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start.ps1
```

Open [the application](http://127.0.0.1:5173). Sign in as `admin` using `ADMIN_PASSWORD` from the generated, ignored `.env`. Do not share or commit that file. API documentation: [FastAPI OpenAPI](http://127.0.0.1:8000/docs). Local inbox: [Mailpit](http://127.0.0.1:8025).

Setup generates strong database/test/auth/admin secrets, starts PostgreSQL and Mailpit, installs dependencies, applies Alembic migrations, and seeds 12 synthetic employees. Repeating it preserves existing configuration and deduplicates seed records. `requirements.lock.txt` and `package-lock.json` capture the tested environment. Default ports: PostgreSQL 55432, isolated test PostgreSQL 55433, SMTP 1025, inbox 8025, API 8000, frontend 5173. Port conflicts produce an error; configure `.env` and matching DATABASE_URL if a database port changes.

## What works

* Database-backed employee creation, lookup, search, editing and soft archive APIs, with directory and profile UI. Previewed legacy CSV/XLSX roster imports use actual audited Sadiah date functions.
* One-contract PDF/CSV/XLSX intake, source-byte persistence and SHA256 deduplication, structured extraction, missing/contradictory/date validation, review form, and source downloads.
* Onboarding creates a durable employee and contract, five HR/IT request tasks, an approved welcome email, verified workflow steps and audit records. IT requests are explicitly simulated; human HR tasks remain pending after automation completes.
* Contract, Iqama and work-permit deadline calculations include expired records and inclusive upcoming windows. Saudi nationality and profession ratios reuse Sadiah’s audited functions.
* HUMAIN Chat has a dedicated three-column chat workspace, English/Arabic message direction, Markdown, attachment upload, persistent conversations, streamed final text, tool trace, copy, retry and model status. Native Qwen tool calls pass strict schemas and database permissions.
* Approved templates, recipient allowlist, persistent notification jobs, SMTP receipts, failure handling and duplicate suppression. Sandbox mode restricts SMTP to loopback:1025 and `.test` recipients.
* Audited scheduler checks run while the backend runs; job state survives restarts. Interrupted sends require review. Analytics display actual database counts and latency, with unmeasured impact values left blank.

## Configuration

`.env.example` documents all keys. Setup creates `.env` only if absent; it never copies original Sadiah settings or employees. Change `OLLAMA_MODEL` to an installed local Qwen tag from `ollama list`. Health verifies the exact tag. Ollama runs on Windows, not in a GPU Docker container. Context is capped at 8192 tokens, one request loop is bounded, and the model is retained for five minutes. Credentials stay server-side.

External SMTP requires `SMTP_MODE=real`, explicit `REAL_EMAIL_AUTHORIZED=true`, a configured username/password, STARTTLS-compatible server, and an exact approved recipient list. Keep the default sandbox until independently authorized. Revoke template approval or recipients to block future sends. SMTP acceptance does not prove inbox delivery.

## Run components separately

```powershell
docker compose up -d --wait postgres mailpit
cd backend
..\.venv\Scripts\python.exe -m alembic upgrade head
..\.venv\Scripts\python.exe -m app.seed
..\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
# In another PowerShell, from frontend:
npm.cmd ci
npm.cmd run dev
```

No SQLite, Redis or Kubernetes is used. Development services bind to loopback. Production deployment, cloud identity, secret vaults and real HR integrations require a separate deployment review.

## Database operations

```powershell
docker compose ps                                      # health
docker compose stop postgres                           # preserve data
docker compose up -d --wait postgres                    # start
# From backend:
..\.venv\Scripts\python.exe -m alembic current          # migration version
..\.venv\Scripts\python.exe -m alembic upgrade head
..\.venv\Scripts\python.exe -m alembic check
# From project root:
powershell -File scripts/backup.ps1
.\.venv\Scripts\python.exe scripts/verify_persistence.py
# Optional explicit synthetic-only reset (deletes synthetic profiles):
.\.venv\Scripts\python.exe scripts/reset_synthetic.py --confirm RESET_SYNTHETIC
```

Never run `docker compose down -v`: it removes the persistent volume. Backups go under ignored `runtime/backups`. Reset preserves non-synthetic records, documents and audit events. An existing contract document whose synthetic profile was reset can be onboarded again; use a new conversation for a fresh agent request.

## Tests and demo

```powershell
powershell -File scripts/test.ps1 -Browser
# Real model + sandbox SMTP evaluation (creates synthetic demo records):
.\.venv\Scripts\python.exe scripts/live_smoke.py
```

Backend tests refuse to run unless the isolated URL names `humain_test`. The test container uses tmpfs; it never shares the development volume. Browser tests start a separate API on 8001 and frontend on 5180 against the test database. Edge must be installed. Deterministic backend tests mock Ollama and SMTP; live evaluation uses the installed Qwen and actual Mailpit. See [test report](docs/TEST_REPORT.md), [live measurements](docs/LIVE_EVALUATION.json) and [demo walkthrough](docs/HACKATHON_DEMO.md).

## Stop

```powershell
powershell -File scripts/stop.ps1
# Also stop PostgreSQL/Mailpit, preserving volumes:
powershell -File scripts/stop.ps1 -StopDatabase
```

Managed processes are matched by PID and creation time. The local Python runner first receives a private shutdown marker and drains in-flight requests for a bounded period. Windows shutdown falls back to terminating the owned process tree if needed; durable job recovery protects interrupted operations. Do not stop during a model/tool run unless interruption is intended.

## Limits that matter

Text-based PDFs use Qwen; scanned PDFs need an external OCR step and are rejected clearly. Every PDF interpretation requires human review against its source. CSV/XLSX one-row contracts use deterministic field mapping rather than model inference. No private Qiwa API, legal Nitaqat certification, official contract approval, real IT provisioning or inbox-delivery guarantee is provided. SMTP cannot provide transactional exactly-once delivery: uncertain outcomes are held for review, never blindly resent. Multi-process deployment is not supported by the local startup recovery scheme. RBAC is implemented and tested; user/role provisioning currently requires administration through the database rather than a user-management UI. Human time savings and general extraction accuracy are not claimed without a measured baseline and representative labeled data.

The original Sadiah source remains unchanged. See its [read-only audit](docs/ORIGINAL_SADIAH_AUDIT.md) and [integration map](docs/SADIAH_INTEGRATION_MAP.md).

## Email settings in the app

Open Settings → Email settings. Change Alert recipient email to route future contract, Iqama and work-permit reminders to one HR inbox, as in Sadiah. Leave it blank to use employee emails. Welcome emails still use the employee address. Save email settings commits the configuration to PostgreSQL and applies it immediately; it does not send mail or change existing job recipients.

The same form configures SMTP host, STARTTLS port (usually 587), sender email, username, password, alert window and additional approved addresses. Sandbox remains the default and accepts only .test recipients on localhost:1025. Real SMTP requires an explicit authorization checkbox, username and app password; provider credentials must be entered by you. Choosing Disabled stores configuration without enabling sends. Blank password retains the existing secret; Remove stored password clears it when delivery policy permits. No original Sadiah credentials or addresses are copied.

SMTP passwords are encrypted in PostgreSQL with Fernet and a key derived from the generated AUTH_SECRET. Preserve that local secret with backups; after rotating it, re-enter the SMTP password in the form. The API never returns the saved password. UI settings override initial SMTP environment defaults after the first save. Database and Ollama configuration remain in .env.


## Journey workspace

Open http://127.0.0.1:5173/journeys. Upload one authorized contract, enter the objective and optionally select an activated company policy. The app executes the authorized onboarding preparation, shows its persisted plan/evidence and routes blockers to Exceptions. Review source facts to save and resume in one action. Tasks provides a paginated internal HR board; simulated IT requests are visibly separate and cannot be marked as real provisioning.

Company policies supports pasted or uploaded TXT source and checks with exact supporting quotations. Load fictional sample produces a draft only. Save a new version when policies change; an authorized administrator must activate each version before use. This is scoped company-field validation, not legal advice or comprehensive clause interpretation. Policy exceptions require a reason and remain auditable.

A verified journey can record an actual manual baseline using a stopwatch or measured seconds, action count and notes. The comparison clearly labels workflow-only timing; it excludes chat planning and remaining human work. The primary demo intentionally has no fabricated manual baseline.

Settings > Email settings > Test saved connection verifies the saved connection/authentication without sending. The real Qwen demo script `scripts/journey_smoke.py` requires `--real-email-to-approved-alert` before a real SMTP run. It sends one synthetic welcome to the configured approved alert address, persists its source in ignored runtime state for deduplicated reruns, and writes sanitized evidence to docs/JOURNEY_LIVE_EVALUATION.json. SMTP acceptance is not inbox confirmation.


## Typography verification

Inter Variable is self-hosted through the pinned @fontsource-variable/inter package; no external font service is needed. Its OFL license is distributed in frontend/public/fonts/Inter-OFL.txt. With the local app running, execute `node scripts/verify-typography.mjs` from frontend to inspect every route, Journey tab, login, employee dialog and mobile layout. The read-only check writes docs/TYPOGRAPHY_REPORT.json and screenshots; it does not submit business forms or send email. Gradient backgrounds receive an additional rendered-background contrast check where conservative full-gradient bounds are inconclusive.


## Hackathon submission and recorded validation

The submission folder contains the ten-slide presentation (PDF and editable PPTX), a one-page problem brief, a three-page solution brief, and synthetic test fixtures. The latest recorded check on 30 October 2026 passed 101 automated tests: 81 backend, 3 frontend unit, and 17 browser tests. See [the system check](docs/SYSTEM_CHECK_2026-10-30.md) for scope and limitations. These are recorded results, not a new test run of this publication copy.

Only synthetic employee examples are supplied. Runtime databases, uploads, credentials, mailbox screenshots, and local Git history are excluded. Setup generates fresh local credentials. The locally audited original-source parity test skips when the original Sadiah files are unavailable; other adapter tests remain available.
