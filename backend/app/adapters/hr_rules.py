"""Deterministic date, deadline and workforce calculations."""

from datetime import date, datetime
import pandas as pd


def validate_columns(df, settings):
    """Returns a list of configured column names (from Settings) that are
    missing from the uploaded file. Empty list means the file looks usable."""
    required = [settings["name_column"], *settings["date_columns_to_check"]]
    return [col for col in required if col not in df.columns]


def normalize_date(value):
    if pd.isna(value):
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    parsed = pd.to_datetime(value, errors="coerce")
    if pd.isna(parsed):
        return None
    return parsed.date()


def find_expiring(df, settings):
    today = date.today()
    alerts = []
    name_column = settings["name_column"]
    date_columns = settings["date_columns_to_check"]
    window = settings["alert_window_days"]

    for _, row in df.iterrows():
        name = row.get(name_column, "Unknown")
        for col in date_columns:
            if col not in row:
                continue
            due = normalize_date(row[col])
            if due is None:
                continue
            days_left = (due - today).days
            if days_left < 0:
                alerts.append({"name": name, "field": col, "date": due, "days_left": days_left, "expired": True})
            elif days_left <= window:
                alerts.append({"name": name, "field": col, "date": due, "days_left": days_left, "expired": False})

    return alerts


def is_saudi(nationality, settings):
    if pd.isna(nationality):
        return False
    saudi_values = {v.strip().lower() for v in settings.get("saudi_nationality_values", ["Saudi"])}
    return str(nationality).strip().lower() in saudi_values


def compute_saudization(df, settings):
    """Returns overall Saudization rate and a per-profession breakdown."""
    nationality_col = settings.get("nationality_column", "Nationality")
    profession_col = settings.get("profession_column", "Profession")

    if df is None or nationality_col not in df.columns:
        return {"overall": None, "by_profession": []}

    saudi_mask = df[nationality_col].apply(lambda n: is_saudi(n, settings))
    total = len(df)
    saudi_count = int(saudi_mask.sum())
    overall = {
        "total": total,
        "saudi": saudi_count,
        "non_saudi": total - saudi_count,
        "rate": round((saudi_count / total * 100), 1) if total else 0.0,
    }

    by_profession = []
    if profession_col in df.columns:
        grouped = df.assign(_is_saudi=saudi_mask).groupby(profession_col, dropna=False)
        for profession, group in grouped:
            group_total = len(group)
            group_saudi = int(group["_is_saudi"].sum())
            by_profession.append(
                {
                    "profession": profession if pd.notna(profession) else "Unspecified",
                    "total": group_total,
                    "saudi": group_saudi,
                    "non_saudi": group_total - group_saudi,
                    "rate": round((group_saudi / group_total * 100), 1) if group_total else 0.0,
                }
            )
        by_profession.sort(key=lambda r: r["rate"], reverse=True)

    return {"overall": overall, "by_profession": by_profession}


def build_email_body(alerts, settings):
    if not alerts:
        return None

    lines = [f"HUMAIN Lifecycle deadline report — {date.today().isoformat()}", ""]
    expired = [a for a in alerts if a.get("expired")]
    upcoming = sorted([a for a in alerts if not a.get("expired")], key=lambda a: a["days_left"])

    if expired:
        lines.append("ALREADY EXPIRED:")
        for a in expired:
            lines.append(f"  - {a['name']}: {a['field']} expired on {a['date']} ({-a['days_left']} days ago)")
        lines.append("")

    if upcoming:
        lines.append(f"Expiring within {settings['alert_window_days']} days:")
        for a in upcoming:
            lines.append(f"  - {a['name']}: {a['field']} due {a['date']} ({a['days_left']} days left)")

    return "\n".join(lines)


def _alert_key(alert):
    return f"{alert['name']}|{alert['field']}|{alert['date'].isoformat()}"
