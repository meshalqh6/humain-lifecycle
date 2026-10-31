from pathlib import Path
from functools import lru_cache
from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ROOT / ".env", extra="ignore")
    database_url: SecretStr
    auth_secret: SecretStr
    admin_password: SecretStr
    ollama_url: str = "http://127.0.0.1:11434"
    ollama_model: str = "qwen3.5:4b"
    ollama_timeout: int = 180
    smtp_mode: str = "sandbox"
    smtp_host: str = "127.0.0.1"
    smtp_port: int = 1025
    smtp_username: str = ""
    smtp_password: SecretStr = SecretStr("")
    smtp_from: str = "hr@humain.test"
    smtp_allowed_recipients: str = "welcome@humain.test,renewals@humain.test"
    real_email_authorized: bool = False
    alert_window_days: int = 30
    alert_recipient: str = ""
    scheduler_enabled: bool = True

    @property
    def recipients(self):
        return {v.strip().lower() for v in self.smtp_allowed_recipients.split(",") if v.strip()}


@lru_cache
def settings():
    return Settings()
