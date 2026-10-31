import ast
import hashlib
import json
from pathlib import Path
from datetime import date, timedelta
import pandas as pd
import pytest
from app.adapters import sadiah


def test_original_unchanged_and_function_source_parity():
    root = Path(__file__).resolve().parents[2]
    source = Path(r"C:\Users\mesha\Desktop\NTT DATA\Sadiah Agent")
    if not source.exists():
        pytest.skip("Original source is not present on this computer")
    for name, digest in json.loads((root / "docs/ORIGINAL_SADIAH_HASHES.json").read_text()).items():
        assert hashlib.sha256((source / name).read_bytes()).hexdigest() == digest
    original = {
        n.name: ast.dump(n, include_attributes=False)
        for n in ast.parse((source / "core.py").read_text(encoding="utf-8-sig")).body
        if isinstance(n, ast.FunctionDef)
    }
    adapter = ast.parse(Path(sadiah.__file__).read_text(encoding="utf-8"))
    for n in adapter.body:
        if isinstance(n, ast.FunctionDef):
            assert ast.dump(n, include_attributes=False) == original[n.name]


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
    assert sadiah.normalize_date(value) == expected


def test_inclusive_deadlines_and_expired():
    today = date.today()
    frame = pd.DataFrame([{"Name": "Synthetic", "End": today + timedelta(days=i)} for i in [-100, 0, 30, 31]])
    alerts = sadiah.find_expiring(
        frame, {"name_column": "Name", "date_columns_to_check": ["End"], "alert_window_days": 30}
    )
    assert [a["days_left"] for a in alerts] == [-100, 0, 30]
    assert [a["expired"] for a in alerts] == [True, False, False]


def test_saudization_professions_unknowns():
    frame = pd.DataFrame(
        {"Nationality": [" Saudi ", "Egyptian", None, "Ø³Ø¹ÙˆØ¯ÙŠ"], "Profession": ["AI", "AI", None, "HR"]}
    )
    result = sadiah.compute_saudization(frame, {"saudi_nationality_values": ["Saudi", "Ø³Ø¹ÙˆØ¯ÙŠ"]})
    assert result["overall"] == {"total": 4, "saudi": 2, "non_saudi": 2, "rate": 50.0}
    assert result["by_profession"][0]["profession"] == "HR"
    assert result["by_profession"][-1]["profession"] == "Unspecified"


def test_empty_and_missing_columns():
    assert sadiah.compute_saudization(None, {})["overall"] is None
    assert sadiah.compute_saudization(pd.DataFrame(columns=["Nationality"]), {})["overall"]["rate"] == 0
    assert sadiah.validate_columns(
        pd.DataFrame(columns=["Name"]), {"name_column": "Name", "date_columns_to_check": ["End"]}
    ) == ["End"]


def test_report_and_key():
    a = {"name": "Test", "field": "Iqama", "date": date(2026, 1, 1), "days_left": -1, "expired": True}
    assert sadiah._alert_key(a) == "Test|Iqama|2026-01-01"
    assert "ALREADY EXPIRED:" in sadiah.build_email_body([a], {"alert_window_days": 30})
    assert sadiah.build_email_body([], {}) is None
