"""Strip environment secrets if a third-party test reporter embeds its configuration."""

from pathlib import Path
from dotenv import dotenv_values

root = Path(__file__).resolve().parents[1]
cfg = dotenv_values(root / ".env")
secret_keys = [
    "POSTGRES_PASSWORD",
    "TEST_DB_PASSWORD",
    "DATABASE_URL",
    "TEST_DATABASE_URL",
    "AUTH_SECRET",
    "ADMIN_PASSWORD",
    "SMTP_PASSWORD",
]
count = 0
for path in (root / "docs").glob("*"):
    if path.suffix not in {".json", ".xml", ".md"}:
        continue
    text = path.read_text(encoding="utf-8")
    original = text
    for key in secret_keys:
        value = cfg.get(key)
        if value and len(value) > 8:
            text = text.replace(value, "<redacted:" + key + ">")
    if text != original:
        path.write_text(text, encoding="utf-8")
        count += 1
print(f"Report secret check complete; {count} files sanitized. No secrets printed.")
