# Evidence sources and claim boundaries

| Slide | Primary repository evidence |
| --- | --- |
| 1 | `README.md`, `docs/HACKATHON_DEMO.md`, existing HUMAIN branding |
| 2 | `docs/WORKFLOWS.md`, implemented contract and onboarding responsibilities. Challenges are qualitative, with no invented cost or delay statistics. |
| 3 | `backend/app/agent.py`, `backend/app/journeys.py`, `backend/app/onboarding.py` |
| 4 | `backend/app/agent.py` tool registry, `documents.py`, `journeys.py`, `email_agent.py`. Capabilities are coordinated services and tools, not six independent LLMs. |
| 5 | `docs/ARCHITECTURE.md`, `backend/app/main.py`, `security.py`, `database/models.py`, `ollama.py`, Docker Compose configuration |
| 6 | Fresh local browser captures in `presentation_assets`: dashboard, employees, contracts, policies and chat. The visible policy is an inactive draft. |
| 7 | `backend/app/journeys.py` plan and policy gate, `onboarding.py`, `email_agent.py`. Policy checks require a selected activated policy. The recorded timed example used fact validation without an activated policy. |
| 8 | Latest recorded test run: 101 passed (81 backend, 3 frontend unit, 17 browser), 30 October 2026: `docs/SYSTEM_CHECK_2026-10-30.md`, `docs/backend-results.xml`, `docs/browser-results.json`. Separate single-run timing and outcomes: `docs/JOURNEY_LIVE_EVALUATION.json`. |
| 9 | `backend/app/documents.py`, `onboarding.py`, `journeys.py`, `docs/SECURITY.md`, `docs/HACKATHON_DEMO.md` |
| 10 | Actual journey evidence capture and `docs/JOURNEY_LIVE_EVALUATION.json`. The link opens the existing local app, not a published demo video. |

## Recorded demonstration

The saved journey is `4159d478-be6a-457b-bc5a-b80b2fb34ddb`. Its recorded agent latency is 37.036 seconds. Core workflow execution is 2074 milliseconds. It created five tasks, including three pending human HR tasks and two simulated IT requests. It records verified automation setup, employee readiness false, SMTP acceptance true and zero new SMTP attempts after retry.

This is one demonstration, not an average, a general success rate or an accuracy benchmark. The timed journey's inbox delivery is unconfirmed. A later, separately recorded Gmail delivery belongs to another demonstration and is not conflated with these timings. No time-saving percentage or general held-out extraction accuracy is claimed.

## Assets

The HUMAIN logo and HUMAIN Chat logo come from `frontend/public/branding/`. The white HUMAIN treatment preserves the original geometry and alpha mask, matching the existing dark UI treatment. The cover uses `BackGround1-logo.png`, an image-generated edit based on the user-supplied `BackGround1.jpg` and official wordmark reference. The original artwork remains in the assets. Product screenshots remain genuine application captures. Full captures accompany cropped versions. `asset_manifest.json` records the delivered assets and hashes.

All diagrams and explanations reflect a hackathon prototype. Human HR approvals remain necessary, IT provisioning is simulated, scanned PDF OCR is unavailable, and future improvements are identified as proposals.
