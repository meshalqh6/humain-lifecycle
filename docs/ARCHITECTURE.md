# Architecture

React/TypeScript/Vite routes call `/api` through the Vite loopback proxy. TanStack Query owns server state; UI state is local and never an authoritative employee store. Tailwind and shared CSS tokens define the responsive UI. Radix Dialog supplies focus management and keyboard escape. HUMAIN Chat final model text streams as server-sent events; tool events precede the final response.

FastAPI uses Pydantic inputs with extra fields forbidden, synchronous SQLAlchemy 2 sessions, psycopg, a bounded connection pool and Alembic. Each HR service owns its transaction. Writes return after commit. Database errors return a failed response rather than a success banner. Unique constraints and PostgreSQL advisory locks protect employee numbers, document hashes, job identities and workflow creation. Documents are bytea; extraction/tool/audit metadata is JSONB. Core HR facts are normalized relational columns.

Qwen runs in host Ollama, with the exact installed tag configured in `.env`. Native tools are sent in the documented [Ollama tool calling format](https://docs.ollama.com/capabilities/tool-calling); PDF output uses a Pydantic [JSON schema format](https://docs.ollama.com/capabilities/structured-outputs). No model download is initiated. Tool planning and final streaming use separate bounded calls; there are at most 8 planning turns and 12 tool executions per request. Qwen cannot issue SQL, filesystem commands or arbitrary SMTP operations.

Deterministic workforce calculations live in `app.adapters.hr_rules` and are covered by regression tests for dates, expiry windows, nationality ratios, profession grouping and HUMAIN report formatting. No external runtime import, configuration migration or employee data copy occurs. See [HR rules](HR_RULES.md).

PostgreSQL 17 uses the [official Docker image](https://hub.docker.com/_/postgres), named volume and localhost mapping. Mailpit is a local SMTP capture server. A separate tmpfs PostgreSQL service holds all destructive test fixtures. Host FastAPI and Vite do not require container GPU support. A single local scheduler polls the durable job ledger every 30 seconds and schedules daily checks. It depends on the backend being alive; missed due runs are picked up on the next start.

The local topology is intentionally small: Windows Python + Node + Ollama, Docker PostgreSQL + Mailpit. There are no private Qiwa calls, production email sends by default, Redis or distributed queues.
