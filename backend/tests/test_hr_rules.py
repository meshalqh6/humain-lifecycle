from datetime import date, timedelta
import pandas as pd
import pytest
from app.adapters import hr_rules


def test_humain_report_branding_and_deadline_order():
    today = date.today()
    alerts = [
        {"name": "Later Demo", "field": "Contract", "date": today + timedelta(days=9), "days_left": 9, "expired": False},
        {"name": "Expired Demo", "field": "Iqama", "date": today - timedelta(days=1), "days_left": -1, "expired": True},
        {"name": "Soon Demo", "field": "Work Permit", "date": today + timedelta(days=2), "days_left": 2, "expired": False},
    ]
    body = hr_rules.build_email_body(alerts, {"alert_window_days": 30})
    assert body.startswith(f"HUMAIN Lifecycle deadline report — {today.isoformat()}")
    assert body.index("ALREADY EXPIRED:") < body.index("Expiring within 30 days:")
    assert body.index("Soon Demo") < body.index("Later Demo")


@pytest.mark.parametrize(
    "value,expected",
    [
        ("", None),
        ("invalid", None),
        ("2026-10-29", date(2026, 10, 29)),
        (pd.NaT, None),
        (date(2026, 1, 1), date(2026, 1, 1)),
    ],
)
def test_date_regression(value, expected):
    assert hr_rules.normalize_date(value) == expected


def test_inclusive_deadlines_and_expired():
    today = date.today()
    frame = pd.DataFrame([{"Name": "Synthetic", "End": today + timedelta(days=i)} for i in [-100, 0, 30, 31]])
    alerts = hr_rules.find_expiring(
        frame, {"name_column": "Name", "date_columns_to_check": ["End"], "alert_window_days": 30}
    )
    assert [a["days_left"] for a in alerts] == [-100, 0, 30]
    assert [a["expired"] for a in alerts] == [True, False, False]


def test_saudization_professions_unknowns():
    frame = pd.DataFrame(
        {"Nationality": [" Saudi ", "Egyptian", None, "Ø³Ø¹ÙˆØ¯ÙŠ"], "Profession": ["AI", "AI", None, "HR"]}
    )
    result = hr_rules.compute_saudization(frame, {"saudi_nationality_values": ["Saudi", "Ø³Ø¹ÙˆØ¯ÙŠ"]})
    assert result["overall"] == {"total": 4, "saudi": 2, "non_saudi": 2, "rate": 50.0}
    assert result["by_profession"][0]["profession"] == "HR"
    assert result["by_profession"][-1]["profession"] == "Unspecified"


def test_empty_and_missing_columns():
    assert hr_rules.compute_saudization(None, {})["overall"] is None
    assert hr_rules.compute_saudization(pd.DataFrame(columns=["Nationality"]), {})["overall"]["rate"] == 0
    assert hr_rules.validate_columns(
        pd.DataFrame(columns=["Name"]), {"name_column": "Name", "date_columns_to_check": ["End"]}
    ) == ["End"]


def test_report_and_key():
    a = {"name": "Test", "field": "Iqama", "date": date(2026, 1, 1), "days_left": -1, "expired": True}
    assert hr_rules._alert_key(a) == "Test|Iqama|2026-01-01"
    assert "ALREADY EXPIRED:" in hr_rules.build_email_body([a], {"alert_window_days": 30})
    assert hr_rules.build_email_body([], {}) is None
