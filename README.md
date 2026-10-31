# HUMAIN Lifecycle

Turn an employment contract into verified onboarding preparation.

HUMAIN Lifecycle is a working enterprise HR prototype for Challenge 3: Autonomous Enterprise. HUMAIN Chat understands an HR objective, coordinates authorized tools, saves the resulting records and verifies what actually happened. People retain responsibility for HR approvals and consequential decisions.

Start with the [demo walkthrough](docs/HACKATHON_DEMO.md), inspect the [latest test results](docs/SYSTEM_CHECK_2026-10-31.md), or open the [presentation PDF](submission/HUMAIN_Lifecycle_Presentation.pdf).

## The problem

An incoming employment contract creates work across document review, company policy checks, employee records, HR tasks, IT coordination and communications. HUMAIN Lifecycle carries the context through those steps and makes progress, exceptions and execution evidence visible in one workspace.

## How it works

1. **Upload a contract.** Accept one supported text-based PDF, Excel or CSV document; retain its source bytes and fingerprint.
2. **Describe the objective.** Ask HUMAIN Chat in English or Arabic to prepare onboarding and verify the outcome.
3. **Validate and review.** Check required facts, inconsistencies and duplicates. Apply a selected administrator-activated company policy; pause for missing information, PDF review or policy exceptions.
4. **Prepare onboarding.** Create employee and contract records, three human HR tasks and two explicitly simulated IT requests.
5. **Communicate within authorization.** Use approved templates and recipients, with a durable outbox, SMTP receipts and duplicate-prevention controls.
6. **Verify the outcome.** Inspect saved records, workflow steps, tasks and the audit trail. Human tasks remain pending until completed by people.

Additional views provide deadline monitoring for contracts, Iqama and work permits, employee search and archiving, and descriptive Saudization ratios with profession-level drilldown.

## Recorded results

| Evidence | Recorded outcome |
| --- | --- |
| [Automated suite, 31 October 2026](docs/SYSTEM_CHECK_2026-10-31.md) | **101 passed:** 81 backend, 3 frontend unit and 17 browser tests |
| Build and static checks | Ruff, ESLint, TypeScript, production build and Alembic schema checks passed |
| Additional functional checks | 9 scope/routing checks passed; 23 live application API endpoints returned HTTP 200 |
| [One recorded contract-to-onboarding run](docs/JOURNEY_LIVE_EVALUATION.json) | 37.036 seconds for the full agent request; 2.074 seconds for core workflow execution |
| Persisted workflow outcome | 5 tasks: 3 pending human HR tasks and 2 simulated IT requests |
| Email execution in that run | SMTP accepted; zero additional SMTP attempts when the verified workflow was repeated |

The timings describe one demonstration, not an average or a held-out benchmark. SMTP acceptance alone does not confirm inbox delivery. Verified automation setup does not mean employee onboarding is complete. No measured human time savings or general PDF extraction accuracy is claimed.

## Architecture

The React and TypeScript interface calls FastAPI, which enforces permissions and coordinates host-local Ollama inference, PostgreSQL 17 persistence, and authorized SMTP or Mailpit delivery.

One locally hosted language model coordinates specialized backend capabilities: contract intelligence, company policy validation, onboarding preparation, deadline monitoring and communications. Typed tools enforce permissions; PostgreSQL stores records, durable workflow state, outbox jobs and audit evidence. See the [architecture](docs/ARCHITECTURE.md) and [security notes](docs/SECURITY.md).

## Run locally on Windows

### Prerequisites

- Python 3.10+ and Node.js 22+; the recorded workstation uses Python 3.10.11 and Node.js 24.12.0.
- Docker Desktop running with WSL2 Linux containers.
- Ollama installed and running on the host.
- Microsoft Edge for the optional browser test suite.

### Install and start

```powershell
git clone https://github.com/meshalqh6/humain-lifecycle.git
cd humain-lifecycle

# Download the local model explicitly; setup does not download models.
ollama pull qwen3.5:4b

powershell -NoProfile -ExecutionPolicy Bypass -File scripts/setup.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start.ps1
```

Open [HUMAIN Lifecycle](http://127.0.0.1:5173). Sign in as `admin` using `ADMIN_PASSWORD` from the generated local `.env` file. Setup generates credentials, installs dependencies, applies migrations and seeds 12 fictional employees. Repeating setup preserves the existing configuration and deduplicates the seed records.

| Local service | Address |
| --- | --- |
| Application | http://127.0.0.1:5173 |
| API documentation | http://127.0.0.1:8000/docs |
| Mailpit sandbox inbox | http://127.0.0.1:8025 |

Fresh setup defaults to sandbox email, using loopback SMTP and `.test` recipients. Real email requires explicit configuration and authorization in Settings. Keep `.env` and uploaded business documents out of Git. See the [operations guide](docs/OPERATIONS.md) for configuration, ports, email settings, backups and shutdown.

## Try the demo

1. Open **Journey workspace** and upload [the synthetic contract](demo/qiwa-synthetic.csv).
2. Enter: `Prepare onboarding from this contract and verify the result. Report the remaining human work and simulated IT requests.`
3. Follow the plan, then inspect the employee record, five tasks, sandbox welcome receipt and audit evidence.
4. Repeat the verified workflow and inspect its duplicate-prevention behavior.

For a company-policy scenario, create and activate an explicitly fictional policy before selecting it. The [full walkthrough](docs/HACKATHON_DEMO.md) includes exception review, resume and manual-baseline guidance. Existing document fingerprints intentionally reuse prior outcomes; use a fresh synthetic identity for a new recorded scenario.

## Run the checks

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test.ps1 -Browser
```

Tests use the separate `humain_test` PostgreSQL database, API port 8001 and UI port 5180. Deterministic backend tests mock model and SMTP behavior where appropriate; browser email scenarios use the sandbox. The original-source parity check skips on computers without the original Sadiah files. Recorded results describe the tested author environment.

The [latest report](docs/SYSTEM_CHECK_2026-10-31.md) links to the backend and browser results. Earlier milestones remain in the [historical test report](docs/TEST_REPORT.md).

## Scope and limitations

- Text-based PDFs require review against their source; scanned PDF OCR is unavailable. CSV/XLSX mapping is deterministic.
- Company policy checks cover configured structured requirements. Official Qiwa approval and legal compliance certification remain outside the implementation.
- IT provisioning is simulated. Identity verification, document collection and orientation require human completion.
- The local prototype needs further deployment engineering, broader held-out evaluation and measured manual baselines before production use or quantified impact claims.

This is an independent hackathon project with HUMAIN-inspired branding. It is not an official HUMAIN product. The original Sadiah application and private data remain separate; the [integration map](docs/SADIAH_INTEGRATION_MAP.md) documents the audited adapter.

## Documentation and submission

- [Presentation PDF](submission/HUMAIN_Lifecycle_Presentation.pdf) and [editable PowerPoint](submission/HUMAIN_Lifecycle_Presentation.pptx)
- [Problem brief](submission/HUMAIN_Lifecycle_Problem.pdf) and [solution brief](submission/HUMAIN_Lifecycle_Solution.pdf)
- [Synthetic test pack](submission/HUMAIN_Lifecycle_Test_Pack.zip)
- [Architecture](docs/ARCHITECTURE.md), [workflows](docs/WORKFLOWS.md), [database design](docs/DATABASE_DESIGN.md) and [security](docs/SECURITY.md)
- [Operations and configuration](docs/OPERATIONS.md) and [demo walkthrough](docs/HACKATHON_DEMO.md)

Only synthetic employee examples are supplied. Runtime databases, credentials, private mailbox screenshots and local upload state are excluded from this repository.
