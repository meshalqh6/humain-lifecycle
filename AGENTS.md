# HUMAIN Lifecycle

Original Sadiah source is read-only. Never import its configuration, employees, credentials or writable state. Only synthetic fixtures may be seeded. PostgreSQL 17 is the authoritative database; never substitute SQLite. Ollama stays on the host. External email remains disabled unless configured and explicitly authorized. Commit no secrets or uploads. Run pytest, frontend checks/build, and PostgreSQL integration tests after changes. Never remove Docker volumes. Report SMTP acceptance separately from delivery. Do not invent test or impact metrics.
