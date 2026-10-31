from datetime import date
from decimal import Decimal
from typing import Literal
from pydantic import SecretStr, BaseModel, ConfigDict, Field, field_validator, model_validator


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class Login(Input):
    username: str = Field(max_length=120)
    password: str = Field(max_length=200)


class EmployeeInput(Input):
    employee_number: str = Field(min_length=1, max_length=80)
    name: str = Field(min_length=2, max_length=200)
    nationality: str = Field(min_length=2, max_length=80)
    profession: str = Field(default="Unspecified", max_length=160)
    email: str | None = Field(default=None, max_length=254)
    department_id: str | None = None
    iqama_expiry: date | None = None
    work_permit_expiry: date | None = None
    status: Literal["active", "onboarding", "inactive"] = "active"
    synthetic: bool = False

    @field_validator("email")
    @classmethod
    def valid_email(cls, value):
        if value and (value.count("@") != 1 or any(c.isspace() for c in value) or "\r" in value or "\n" in value):
            raise ValueError("Invalid email address")
        return value.lower() if value else None


class ContractFields(Input):
    employee_name: str | None = None
    employee_number: str | None = None
    nationality: str | None = None
    job_title: str | None = None
    occupation: str | None = None
    employment_type: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    salary: Decimal | None = Field(default=None, ge=0)
    basic_salary: Decimal | None = Field(default=None, ge=0)
    allowances: Decimal | None = Field(default=None, ge=0)
    probation_days: int | None = Field(default=None, ge=0)
    work_location: str | None = None
    employer: str | None = None
    contract_status: str | None = None
    renewal_terms: str | None = None
    email: str | None = None
    iqama_expiry: date | None = None
    work_permit_expiry: date | None = None
    synthetic: bool = False
    warnings: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def length_limits(self):
        for value in self.model_dump().values():
            if isinstance(value, str) and len(value) > 2000:
                raise ValueError("Extracted field exceeds 2000 characters")
        return self


class OnboardInput(Input):
    document_id: str


class TaskInput(Input):
    employee_id: str
    title: str = Field(min_length=2, max_length=200)
    due_date: date | None = None


class ChatInput(Input):
    conversation_id: str
    message: str = Field(min_length=1, max_length=8000)
    document_id: str | None = None
    request_key: str = Field(min_length=8, max_length=100)


class EmailInput(Input):
    employee_id: str
    template_code: Literal["welcome", "contract", "iqama", "work_permit"]
    due_date: date | None = None


class PolicyInput(Input):
    alert_window_days: int = Field(ge=1, le=365)


class EmailSettingsInput(Input):
    smtp_mode: Literal["sandbox", "real", "disabled"] = "sandbox"
    smtp_host: str = Field(min_length=1, max_length=253, pattern=r"^[a-zA-Z0-9][a-zA-Z0-9.-]*$")
    smtp_port: int = Field(ge=1, le=65535)
    smtp_from: str = Field(max_length=254)
    smtp_username: str = Field(default="", max_length=254)
    smtp_password: SecretStr | None = Field(default=None, max_length=1024)
    clear_password: bool = False
    alert_recipient: str = Field(default="", max_length=254)
    smtp_allowed_recipients: str = Field(default="", max_length=4000)
    real_email_authorized: bool = False
    alert_window_days: int = Field(default=30, ge=1, le=365)

    @field_validator("smtp_from", "alert_recipient")
    @classmethod
    def email_address(cls, value):
        import re

        if value and not re.fullmatch(r"[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+", value):
            raise ValueError("Enter a valid email address")
        return value.lower()

    @field_validator("smtp_allowed_recipients")
    @classmethod
    def recipient_list(cls, value):
        values = [cls.email_address(v.strip()) for v in value.split(",") if v.strip()]
        return ",".join(dict.fromkeys(values))

    @model_validator(mode="after")
    def delivery_policy(self):
        if not self.smtp_from:
            raise ValueError("Sender email is required")
        if self.smtp_mode == "sandbox" and (self.smtp_host not in {"localhost", "127.0.0.1"} or self.smtp_port != 1025):
            raise ValueError("Sandbox uses localhost:1025. Choose real SMTP for an external server.")
        if self.smtp_mode == "real" and not self.real_email_authorized:
            raise ValueError("Explicitly authorize real SMTP delivery before enabling it")
        if self.smtp_mode == "real" and (not self.smtp_username or self.smtp_port == 465):
            raise ValueError(
                "Real SMTP requires a username and a STARTTLS port, usually 587 (implicit TLS 465 is unsupported)"
            )
        if self.smtp_mode != "real" and self.real_email_authorized:
            raise ValueError("Real SMTP authorization only applies in real mode")
        if self.smtp_password and self.clear_password:
            raise ValueError("Enter a new password or clear the stored password, not both")
        if self.smtp_mode == "sandbox" and any(
            not v.endswith(".test") for v in [self.alert_recipient, *self.smtp_allowed_recipients.split(",")] if v
        ):
            raise ValueError("Sandbox recipients must use .test addresses")
        return self


class ObjectInput(Input):
    id: str


class SearchInput(Input):
    query: str = Field(default="", max_length=100)


class DeadlineInput(Input):
    days: int = Field(default=30, ge=0, le=365)
    kind: Literal["all", "contract", "iqama", "work_permit"] = "all"


class EmptyInput(Input):
    pass


class PolicyRule(Input):
    field: Literal[
        "salary",
        "probation_days",
        "employment_type",
        "work_location",
        "renewal_terms",
        "email",
        "start_date",
        "end_date",
    ]
    operator: Literal["required", "maximum", "minimum", "equals"]
    value: str = Field(default="", max_length=250)
    quote: str = Field(min_length=5, max_length=1000)

    @model_validator(mode="after")
    def numeric_rule(self):
        if self.operator in {"maximum", "minimum"}:
            if self.field not in {"salary", "probation_days"}:
                raise ValueError("Numeric comparisons only support salary or probation days")
            from decimal import Decimal, InvalidOperation

            try:
                value = Decimal(self.value)
                if not value.is_finite() or value < 0:
                    raise ValueError("Use a finite nonnegative number")
            except InvalidOperation:
                raise ValueError("Enter a numeric comparison value") from None
        if self.operator == "equals" and not self.value.strip():
            raise ValueError("Enter the expected value")
        return self


class CompanyPolicyInput(Input):
    title: str = Field(min_length=3, max_length=160)
    source: str = Field(min_length=10, max_length=30000)
    rules: list[PolicyRule] = Field(min_length=1, max_length=30)

    @model_validator(mode="after")
    def source_citations(self):
        if any(rule.quote not in self.source for rule in self.rules):
            raise ValueError("Every rule must quote an exact passage from the policy source")
        return self


class JourneyInput(Input):
    document_id: str
    policy_id: str | None = None
    objective: str = Field(
        default="Prepare onboarding from this contract and verify the result", min_length=5, max_length=500
    )


class DecisionInput(Input):
    note: str = Field(min_length=10, max_length=2000)


class MeasurementInput(Input):
    manual_seconds: int = Field(gt=0, le=604800)
    manual_interventions: int = Field(ge=0, le=10000)
    notes: str = Field(min_length=10, max_length=2000)


class PolicyActivationInput(Input):
    active: bool
