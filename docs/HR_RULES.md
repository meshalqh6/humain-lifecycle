# HR rules

`backend/app/adapters/hr_rules.py` provides deterministic calculations for dates, employment deadlines and workforce nationality ratios. The module originated from an authorized legacy reference; its current HUMAIN integration has no dependency on external application files, configuration or employee data.

| Function | Purpose |
| --- | --- |
| `validate_columns` | Check required columns before an authorized roster import. |
| `normalize_date` | Normalize supported date values and return no value for invalid or missing dates. |
| `find_expiring` | Include expired dates and deadlines through the inclusive configured window. |
| `is_saudi`, `compute_saudization` | Calculate descriptive workforce and profession ratios using explicit nationality aliases. |
| `build_email_body` | Format a HUMAIN Lifecycle deadline report, showing expired items before upcoming items. |
| `_alert_key` | Produce a stable reference key for a deadline record. |

The service layer supplies the Riyadh calendar date without changing shared function globals. Only active, non-archived employee records contribute to workforce views. Notification jobs use persisted employee IDs, template identity and due dates for duplicate prevention.

`backend/tests/test_hr_rules.py` covers missing columns, empty data, date normalization, inclusive deadline boundaries, unknown nationalities, profession grouping, report branding and deadline ordering. No external source directory is required to run these tests.

Roster uploads must be explicitly authorized. Samples use synthetic identities. Saudization values are descriptive ratios, and deadline reminders are operational signals; neither constitutes legal certification. Real IT provisioning and official contract approvals remain outside these rules.
