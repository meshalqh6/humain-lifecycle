# Operations and configuration

Return to the [project overview](../README.md). Run commands from the repository root unless a working directory is specified. These details support the quick start in the README.

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

## Stop

```powershell
powershell -File scripts/stop.ps1
# Also stop PostgreSQL/Mailpit, preserving volumes:
powershell -File scripts/stop.ps1 -StopDatabase
```

Managed processes are matched by PID and creation time. The local Python runner first receives a private shutdown marker and drains in-flight requests for a bounded period. Windows shutdown falls back to terminating the owned process tree if needed; durable job recovery protects interrupted operations. Do not stop during a model/tool run unless interruption is intended.

## Email settings in the app

Open Settings → Email settings. Change Alert recipient email to route future contract, Iqama and work-permit reminders to one HR inbox, as in Sadiah. Leave it blank to use employee emails. Welcome emails still use the employee address. Save email settings commits the configuration to PostgreSQL and applies it immediately; it does not send mail or change existing job recipients.

The same form configures SMTP host, STARTTLS port (usually 587), sender email, username, password, alert window and additional approved addresses. Sandbox remains the default and accepts only .test recipients on localhost:1025. Real SMTP requires an explicit authorization checkbox, username and app password; provider credentials must be entered by you. Choosing Disabled stores configuration without enabling sends. Blank password retains the existing secret; Remove stored password clears it when delivery policy permits. No original Sadiah credentials or addresses are copied.

SMTP passwords are encrypted in PostgreSQL with Fernet and a key derived from the generated AUTH_SECRET. Preserve that local secret with backups; after rotating it, re-enter the SMTP password in the form. The API never returns the saved password. UI settings override initial SMTP environment defaults after the first save. Database and Ollama configuration remain in .env.

## Typography verification

Inter Variable is self-hosted through the pinned @fontsource-variable/inter package; no external font service is needed. Its OFL license is distributed in frontend/public/fonts/Inter-OFL.txt. With the local app running, execute `node scripts/verify-typography.mjs` from frontend to inspect every route, Journey tab, login, employee dialog and mobile layout. The read-only check writes docs/TYPOGRAPHY_REPORT.json and screenshots; it does not submit business forms or send email. Gradient backgrounds receive an additional rendered-background contrast check where conservative full-gradient bounds are inconclusive.
