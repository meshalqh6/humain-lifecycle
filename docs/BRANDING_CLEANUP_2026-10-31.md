# Branding and comment cleanup — 31 October 2026

The current application, source paths, tests and text documentation now use HUMAIN naming throughout. The deterministic adapter is `app.adapters.hr_rules`; roster imports and services use that module. Deadline report headings use HUMAIN Lifecycle. The roster help lists its actual supported date headers.

Removed redundant editorial comments and obsolete reference-audit documents. Comments explaining permissions, transaction behavior and ambiguous email retries remain. Replaced an external-source parity check with a portable regression for HUMAIN report branding and deadline ordering. The authorized external reference source was not modified.

Validation after these changes:

- 81 backend tests passed, including the renamed HR rules tests.
- 3 frontend unit tests passed.
- 17 browser tests passed, including all sidebar routes and core workflows.
- Ruff, ESLint, TypeScript, production build and Alembic consistency checks passed.
- The local app restarted successfully; all 23 checked API endpoints and the frontend returned HTTP 200. PostgreSQL and Qwen health checks passed.
- Main workspace counts remained 17 employees, 18 contracts, 7 documents, 30 tasks and 3 journeys. SMTP attempts remained 14; this cleanup requested no external email.

Tests used the isolated PostgreSQL test database and sandbox delivery settings. Recorded test results are in `backend-results.xml` and `browser-results.json`. This cleanup removes the legacy name from the current tree; previous Git commits remain unchanged.
