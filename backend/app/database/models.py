from datetime import date, datetime, timezone
from decimal import Decimal
from uuid import uuid4
from sqlalchemy import (
    String,
    Text,
    ForeignKey,
    DateTime,
    Date,
    Numeric,
    Integer,
    Boolean,
    LargeBinary,
    UniqueConstraint,
    CheckConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def now():
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class Record:
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, onupdate=now)


class Department(Record, Base):
    __tablename__ = "departments"
    name: Mapped[str] = mapped_column(String(120), unique=True)


class Role(Record, Base):
    __tablename__ = "roles"
    name: Mapped[str] = mapped_column(String(80), unique=True)


class Permission(Record, Base):
    __tablename__ = "permissions"
    role_id: Mapped[str] = mapped_column(ForeignKey("roles.id"))
    code: Mapped[str] = mapped_column(String(80))
    __table_args__ = (UniqueConstraint("role_id", "code"),)


class User(Record, Base):
    __tablename__ = "users"
    username: Mapped[str] = mapped_column(String(120), unique=True)
    password_hash: Mapped[str] = mapped_column(Text)
    role_id: Mapped[str] = mapped_column(ForeignKey("roles.id"))
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class Employee(Record, Base):
    __tablename__ = "employees"
    employee_number: Mapped[str] = mapped_column(String(80), unique=True)
    name: Mapped[str] = mapped_column(String(200), index=True)
    nationality: Mapped[str] = mapped_column(String(80))
    profession: Mapped[str] = mapped_column(String(160), default="Unspecified")
    email: Mapped[str | None] = mapped_column(String(254))
    department_id: Mapped[str | None] = mapped_column(ForeignKey("departments.id"), index=True)
    status: Mapped[str] = mapped_column(String(40), default="active")
    iqama_expiry: Mapped[date | None] = mapped_column(Date, index=True)
    work_permit_expiry: Mapped[date | None] = mapped_column(Date, index=True)
    synthetic: Mapped[bool] = mapped_column(Boolean, default=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    idempotency_key: Mapped[str] = mapped_column(String(160), unique=True)
    __table_args__ = (CheckConstraint("status IN ('active','onboarding','inactive')"),)


class ContractDocument(Record, Base):
    __tablename__ = "contract_documents"
    filename: Mapped[str] = mapped_column(String(255))
    sha256: Mapped[str] = mapped_column(String(64), unique=True)
    content_type: Mapped[str] = mapped_column(String(100))
    content: Mapped[bytes] = mapped_column(LargeBinary)
    uploaded_by: Mapped[str] = mapped_column(ForeignKey("users.id"))


class ContractExtraction(Record, Base):
    __tablename__ = "contract_extractions"
    document_id: Mapped[str] = mapped_column(ForeignKey("contract_documents.id"), unique=True)
    fields: Mapped[dict] = mapped_column(JSONB)
    method: Mapped[str] = mapped_column(String(80))
    model: Mapped[str | None] = mapped_column(String(100))


class DocumentValidationResult(Record, Base):
    __tablename__ = "document_validation_results"
    extraction_id: Mapped[str] = mapped_column(ForeignKey("contract_extractions.id"), unique=True)
    valid: Mapped[bool] = mapped_column(Boolean)
    issues: Mapped[list] = mapped_column(JSONB)


class Contract(Record, Base):
    __tablename__ = "contracts"
    employee_id: Mapped[str] = mapped_column(ForeignKey("employees.id"), index=True)
    document_id: Mapped[str | None] = mapped_column(ForeignKey("contract_documents.id"), unique=True)
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date] = mapped_column(Date, index=True)
    salary: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    employer: Mapped[str | None] = mapped_column(String(200))
    status: Mapped[str] = mapped_column(String(40), default="active")
    __table_args__ = (
        CheckConstraint("end_date >= start_date"),
        CheckConstraint("salary IS NULL OR salary >= 0"),
        UniqueConstraint("employee_id", "start_date", "end_date"),
    )


class OnboardingWorkflow(Record, Base):
    __tablename__ = "onboarding_workflows"
    employee_id: Mapped[str | None] = mapped_column(ForeignKey("employees.id"), unique=True)
    document_id: Mapped[str] = mapped_column(ForeignKey("contract_documents.id"), unique=True)
    state: Mapped[str] = mapped_column(String(40), default="CREATED", index=True)
    idempotency_key: Mapped[str] = mapped_column(String(160), unique=True)
    error: Mapped[str | None] = mapped_column(Text)
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    __table_args__ = (
        CheckConstraint(
            "state IN ('CREATED','DOCUMENT_RECEIVED','EXTRACTING','VALIDATING','READY','RUNNING','AWAITING_REVIEW','COMPLETED','FAILED','CANCELLED')"
        ),
    )


class OnboardingStep(Record, Base):
    __tablename__ = "onboarding_steps"
    workflow_id: Mapped[str] = mapped_column(ForeignKey("onboarding_workflows.id"), index=True)
    name: Mapped[str] = mapped_column(String(160))
    status: Mapped[str] = mapped_column(String(40), default="pending")
    result: Mapped[dict] = mapped_column(JSONB, default=dict)
    __table_args__ = (UniqueConstraint("workflow_id", "name"),)


class HRTask(Record, Base):
    __tablename__ = "hr_tasks"
    employee_id: Mapped[str] = mapped_column(ForeignKey("employees.id"), index=True)
    workflow_id: Mapped[str | None] = mapped_column(ForeignKey("onboarding_workflows.id"))
    title: Mapped[str] = mapped_column(String(200))
    status: Mapped[str] = mapped_column(String(30), default="pending")
    due_date: Mapped[date | None] = mapped_column(Date)
    simulated: Mapped[bool] = mapped_column(Boolean, default=False)
    idempotency_key: Mapped[str] = mapped_column(String(160), unique=True)


class ComplianceAlert(Record, Base):
    __tablename__ = "compliance_alerts"
    employee_id: Mapped[str] = mapped_column(ForeignKey("employees.id"), index=True)
    kind: Mapped[str] = mapped_column(String(40))
    due_date: Mapped[date] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(30), default="open")
    __table_args__ = (UniqueConstraint("employee_id", "kind", "due_date"),)


class SaudizationSnapshot(Record, Base):
    __tablename__ = "saudization_snapshots"
    total: Mapped[int] = mapped_column(Integer)
    saudi: Mapped[int] = mapped_column(Integer)
    rate: Mapped[Decimal] = mapped_column(Numeric(5, 1))
    professions: Mapped[list] = mapped_column(JSONB)
    __table_args__ = (CheckConstraint("saudi >= 0 AND saudi <= total"),)


class NotificationTemplate(Record, Base):
    __tablename__ = "notification_templates"
    code: Mapped[str] = mapped_column(String(80), unique=True)
    subject: Mapped[str] = mapped_column(String(200))
    body: Mapped[str] = mapped_column(Text)
    approved: Mapped[bool] = mapped_column(Boolean, default=False)


class NotificationJob(Record, Base):
    __tablename__ = "notification_jobs"
    employee_id: Mapped[str] = mapped_column(ForeignKey("employees.id"), index=True)
    template_id: Mapped[str] = mapped_column(ForeignKey("notification_templates.id"))
    recipient: Mapped[str] = mapped_column(String(254))
    subject: Mapped[str] = mapped_column(String(250))
    body: Mapped[str] = mapped_column(Text)
    state: Mapped[str] = mapped_column(String(40), default="PREPARED", index=True)
    scheduled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    idempotency_key: Mapped[str] = mapped_column(String(160), unique=True)
    __table_args__ = (
        CheckConstraint("state IN ('PREPARED','SENDING','SMTP_ACCEPTED','FAILED','UNKNOWN','AWAITING_REVIEW')"),
    )


class EmailLog(Record, Base):
    __tablename__ = "email_logs"
    job_id: Mapped[str] = mapped_column(ForeignKey("notification_jobs.id"), index=True)
    status: Mapped[str] = mapped_column(String(40))
    message_id: Mapped[str] = mapped_column(String(200))
    detail: Mapped[str | None] = mapped_column(Text)


class AgentConversation(Record, Base):
    __tablename__ = "agent_conversations"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    title: Mapped[str] = mapped_column(String(160), default="New conversation")
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class AgentMessage(Record, Base):
    __tablename__ = "agent_messages"
    conversation_id: Mapped[str] = mapped_column(ForeignKey("agent_conversations.id"), index=True)
    role: Mapped[str] = mapped_column(String(30))
    content: Mapped[str] = mapped_column(Text)
    request_key: Mapped[str | None] = mapped_column(String(160), unique=True)
    __table_args__ = (CheckConstraint("role IN ('user','assistant','error')"),)


class AgentWorkflow(Record, Base):
    __tablename__ = "agent_workflows"
    conversation_id: Mapped[str] = mapped_column(ForeignKey("agent_conversations.id"))
    state: Mapped[str] = mapped_column(String(40), default="RUNNING")
    request_key: Mapped[str] = mapped_column(String(160), unique=True)
    elapsed_ms: Mapped[int | None] = mapped_column(Integer)
    human_interventions: Mapped[int] = mapped_column(Integer, default=0)


class AgentToolExecution(Record, Base):
    __tablename__ = "agent_tool_executions"
    workflow_id: Mapped[str] = mapped_column(ForeignKey("agent_workflows.id"), index=True)
    tool: Mapped[str] = mapped_column(String(100))
    arguments: Mapped[dict] = mapped_column(JSONB)
    result: Mapped[dict] = mapped_column(JSONB, default=dict)
    status: Mapped[str] = mapped_column(String(40))
    verified: Mapped[bool] = mapped_column(Boolean, default=False)


class AgentWorkflowStep(Record, Base):
    __tablename__ = "agent_workflow_steps"
    workflow_id: Mapped[str] = mapped_column(ForeignKey("agent_workflows.id"), index=True)
    position: Mapped[int] = mapped_column(Integer)
    name: Mapped[str] = mapped_column(String(100))
    state: Mapped[str] = mapped_column(String(40))
    metadata_json: Mapped[dict] = mapped_column(JSONB, default=dict)
    __table_args__ = (UniqueConstraint("workflow_id", "position"),)


class ApprovalRequest(Record, Base):
    __tablename__ = "approval_requests"
    workflow_id: Mapped[str | None] = mapped_column(ForeignKey("onboarding_workflows.id"))
    requested_by: Mapped[str] = mapped_column(ForeignKey("users.id"))
    action: Mapped[str] = mapped_column(String(120))
    state: Mapped[str] = mapped_column(String(30), default="pending")
    detail: Mapped[dict] = mapped_column(JSONB)


class AuditEvent(Record, Base):
    __tablename__ = "audit_events"
    actor_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), index=True)
    action: Mapped[str] = mapped_column(String(120), index=True)
    object_id: Mapped[str | None] = mapped_column(String(160), index=True)
    detail: Mapped[dict] = mapped_column(JSONB, default=dict)


class SchedulerJob(Record, Base):
    __tablename__ = "scheduler_jobs"
    name: Mapped[str] = mapped_column(String(120), unique=True)
    next_run: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    last_run: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    state: Mapped[str] = mapped_column(String(30), default="READY")
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    error: Mapped[str | None] = mapped_column(Text)


class EmailConfiguration(Record, Base):
    __tablename__ = "application_email_settings"
    values: Mapped[dict] = mapped_column(JSONB)
    encrypted_password: Mapped[str | None] = mapped_column(Text)
    __table_args__ = (CheckConstraint("id = 'workspace'"),)


class CompanyPolicy(Record, Base):
    __tablename__ = "company_policies"
    title: Mapped[str] = mapped_column(String(160))
    source: Mapped[str] = mapped_column(Text)
    rules: Mapped[list] = mapped_column(JSONB)
    active: Mapped[bool] = mapped_column(Boolean, default=False)
    created_by: Mapped[str] = mapped_column(ForeignKey("users.id"))


class Journey(Record, Base):
    __tablename__ = "journeys"
    document_id: Mapped[str] = mapped_column(ForeignKey("contract_documents.id"), unique=True)
    policy_id: Mapped[str | None] = mapped_column(ForeignKey("company_policies.id"))
    requested_by: Mapped[str] = mapped_column(ForeignKey("users.id"))
    objective: Mapped[str] = mapped_column(String(500))
    state: Mapped[str] = mapped_column(String(30), default="READY", index=True)
    elapsed_ms: Mapped[int] = mapped_column(Integer, default=0)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    findings: Mapped[list] = mapped_column(JSONB, default=list)
    outcome: Mapped[dict] = mapped_column(JSONB, default=dict)
    error: Mapped[str | None] = mapped_column(Text)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    __table_args__ = (CheckConstraint("state IN ('READY','RUNNING','AWAITING_REVIEW','VERIFIED','FAILED')"),)


class JourneyMeasurement(Record, Base):
    __tablename__ = "journey_measurements"
    journey_id: Mapped[str] = mapped_column(ForeignKey("journeys.id"), unique=True)
    manual_seconds: Mapped[int] = mapped_column(Integer)
    manual_interventions: Mapped[int] = mapped_column(Integer)
    notes: Mapped[str] = mapped_column(Text)
    recorded_by: Mapped[str] = mapped_column(ForeignKey("users.id"))
    __table_args__ = (CheckConstraint("manual_seconds > 0 AND manual_interventions >= 0"),)
