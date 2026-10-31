# Docker and local services

Prerequisites: Docker Desktop with WSL2 Linux engine, Compose plugin, sufficient disk space and ports 55432/55433/1025/8025 available. `docker info` must succeed. Setup reports a targeted error when Docker is missing or stopped. PostgreSQL uses the official `postgres:17-bookworm` major/OS tag, allowing security updates within major 17. Tested image digest/version are recorded by local Docker; pin a deployment digest during a production release process.

`docker compose up -d --wait postgres mailpit` creates the persistent `humain-lifecycle_postgres_data` named volume, starts the database and SMTP capture inbox, and waits for readiness. PostgreSQL receives generated credentials through environment substitution. The shell healthcheck expands its in-container POSTGRES_USER and POSTGRES_DB. No database password is hardcoded or written into source. Loopback bind prevents LAN access.

`docker compose ps` inspects status. `docker compose stop postgres` retains data. `docker compose up -d --wait postgres` restarts it. `docker compose restart postgres` tests a container restart. `scripts/verify_persistence.py` compares IDs and states before/after restart and writes PERSISTENCE_REPORT.json. It does not delete any volume.

`scripts/backup.ps1` runs pg_dump custom format in the container, then copies the binary file to ignored runtime/backups. To restore a chosen backup, first take another backup, stop the app, and follow pg_restore against a separately created database; do not blindly overwrite the live database. No automatic restore or volume deletion is performed.

`docker compose --profile test up -d --wait postgres-test` starts an isolated tmpfs test instance. Backend tests and Playwright reject database names other than humain_test. Test container data may be ephemeral; development data is not. `scripts/test.ps1` runs migrations, pytest, Ruff, lint, Vitest, TypeScript and production build, with optional Edge Playwright tests.
