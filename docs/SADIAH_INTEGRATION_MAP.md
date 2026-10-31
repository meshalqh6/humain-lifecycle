# Sadiah integration map

| Original function | Integration |
| --- | --- |
| _ensure_settings_file, load_settings, save_settings | Replaced by validated environment settings; original files remain untouched. No credentials migrated. |
| load_rows | Isolated pandas adapter for authorized XLSX import, restricted size/row count. |
| save_rows | Replaced by normalized transactional PostgreSQL employee/contract writes; export through API. |
| validate_columns | Preserved pure function for legacy header checks. |
| normalize_date | Preserved pure function; deterministic contract schema validation additionally rejects ambiguous dates. |
| find_expiring | Preserved pure function on database-to-DataFrame projection. Contract/Iqama/work permit columns match legacy schema. Calendar day explicitly Riyadh for new APIs. |
| is_saudi, compute_saudization | Preserved functions on normalized employee projection with explicit aliases. |
| build_email_body | Preserved aggregate report formatter; new individual reminders use approved templates. |
| send_email | Replaced by allowlisted SMTP outbox; sandbox default, real mode explicit, TLS/auth for external SMTP. |
| _alert_key | Preserved legacy identity for regression; new jobs use immutable employee ID, kind and due date. |
| _load_sent_alert_keys, _save_sent_alert_keys | Replaced by notification_jobs unique key and email_logs. No original JSON imported. |
| run_check_and_alert | Replaced by durable scheduler and service orchestration, transactional writes and auditable failures. |
| web_app.get_dataframe, compute_alerts | PostgreSQL queries + preserved deadline adapter. |
| web_app.style_rate, style_status | Semantic UI badges; no legal thresholds implied. |
| desktop_launcher._free_port, _exe_path, _task_exists, _register_daily_task, _ensure_daily_task | Separate PowerShell local service lifecycle + database scheduler ledger. No original task changed. |
| desktop_launcher.run_check_only, _wait_for_server, _start_streamlit, run_app, main | FastAPI/Vite startup health checks and worker CLI. |
| deadline_checker.main | New scheduler CLI, with persisted state and observable errors. |

Only synthetic employee records are used. An authorized legacy file can be uploaded explicitly later; it is never read automatically from the original APPDATA directory. Real provisioning, Qiwa signing, salary modification, termination and production access are outside the tool registry.
