# Original Sadiah audit — 29 October 2026

Read-only inspection of `C:/Users/mesha/Desktop/NTT DATA/Sadiah Agent`; source archive `C:/Users/mesha/Desktop/NTT DATA/SadiahAgent_source.zip` also inventoried. The original application was not executed. No employee rows, stored settings values, recipient addresses, or credentials were copied. Only workbook headers were inspected. No pre-existing HUMAIN UI references were found in the target workspace.

## Observed pipelines

* `core.py`: pandas Excel load/save, configured header validation, forgiving date normalization; loops over configured deadline columns. Expired dates are always included; future dates use an inclusive configurable window. Dates use the host's calendar day.
* `Qiwa_Sample.xlsx` headers: Employee Name, Iqama Number, Nationality, Contract Start Date, Contract End Date, Iqama Expiry Date, Work Permit Expiry, Status, Profession. No rows inspected or migrated.
* `compute_saudization`: case-insensitive configured Saudi nationality aliases, unknown nationality counted as non-Saudi; one decimal rounding; profession grouping includes missing professions as Unspecified; descending ratio ordering. This is a descriptive ratio, not a legal Nitaqat determination.
* `build_email_body`: expired section followed by upcoming deadlines sorted by days remaining. `send_email`: SMTP STARTTLS, login, then one aggregate plain-text HR report to the configured recipient. No inbox delivery verification.
* Deduplication: `name|field|ISO-date` stored in `%APPDATA%/SadiahAgent/sent_alerts.json`; keys pruned when deadlines leave the active list. `force=True` bypasses suppression. This file is not transactional and is unsafe for concurrent workers; new service uses unique durable jobs and refuses blind retry after uncertain SMTP acceptance.
* UI (`web_app.py`): Streamlit Dashboard, Employees, Alerts & Actions, Settings. Excel upload replaces current data, configured headers checked; editable employee table supports search, additions and confirmed deletion. Manual send uses force=True. Profession color thresholds 20/40 are visual conventions, not verified regulatory rules.
* Persistence: per-user settings, current_upload.xlsx, sent_alerts.json under APPDATA; bundled defaults copied on first run. UI reads stored workbook first, configured path second.
* `deadline_checker.py`: invokes run_check_and_alert. `desktop_launcher.py`: PyInstaller/pywebview launcher, local Streamlit server, daily 09:00 `SadiahAgentDeadlineCheck` task only when frozen. Background failures are swallowed. Source-mode VBS uses an older absolute path. No scheduler retry ledger or durable workflows.
* Dependencies in requirements.txt: streamlit, pandas, openpyxl, unpinned. Packaging also uses pywebview, PyInstaller and Inno Setup. No source tests discovered at project root; archive contains core.py, web_app.py, deadline_checker.py, settings.json, requirements.txt and run.bat.

## Configuration keys (values intentionally excluded)

excel_file_path, date_columns_to_check, name_column, nationality_column, profession_column, saudi_nationality_values, alert_window_days, smtp_server, smtp_port, sender_email, sender_password, recipient_email.

## Preservation

Source and root-file SHA256 hashes are recorded in ORIGINAL_SADIAH_HASHES.json. Recheck them after development. Reusable pure functions are extracted with Python AST into a separate adapter; their source is unchanged. Original side-effecting entry points are never imported. Synthetic-only regression fixtures preserve boundary dates, unknown values, missing columns, ratios, profession grouping, report formatting, and alert keys. PostgreSQL strengthens concurrency and idempotency; forced duplicate sending is deliberately not exposed to the agent.
