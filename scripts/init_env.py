"""Create local-only secrets. Never print them or rewrite an existing .env."""

import secrets
from pathlib import Path

root = Path(__file__).resolve().parents[1]
target = root / ".env"
if not target.exists():
    password, test_password = secrets.token_hex(24), secrets.token_hex(24)
    content = (root / ".env.example").read_text()
    replacements = {
        "POSTGRES_PASSWORD": password,
        "DATABASE_URL": f"postgresql+psycopg://humain_app:{password}@127.0.0.1:55432/humain_lifecycle",
        "TEST_DB_PASSWORD": test_password,
        "TEST_DATABASE_URL": f"postgresql+psycopg://humain_test:{test_password}@127.0.0.1:55433/humain_test",
        "AUTH_SECRET": secrets.token_hex(48),
        "ADMIN_PASSWORD": secrets.token_urlsafe(24),
    }
    target.write_text(
        "\n".join(
            f"{k}={replacements.get(k, v)}"
            for line in content.splitlines()
            if "=" in line
            for k, v in [line.split("=", 1)]
        )
        + "\n"
    )
    print(
        "Created ignored local .env with generated secrets. Admin username: admin. Password: ADMIN_PASSWORD in .env."
    )
else:
    print("Existing local .env preserved.")
