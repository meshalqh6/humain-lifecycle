"""Validated public API shapes. Secret and raw document columns are never public fields."""

from datetime import date, datetime
from decimal import Decimal
from typing import Generic, TypeVar, Any
from pydantic import BaseModel, Field, ConfigDict


class Output(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class RecordOut(Output):
    id: str
    created_at: datetime
    updated_at: datetime


class EmployeeOut(RecordOut):
    employee_number: str
    name: str
    nationality: str
    profession: str
    email: str | None
    department_id: str | None
    status: str
    iqama_expiry: date | None
    work_permit_expiry: date | None
    synthetic: bool
    deleted_at: datetime | None


class ContractOut(RecordOut):
    employee_id: str
    document_id: str | None
    start_date: date
    end_date: date
    salary: Decimal | None
    employer: str | None
    status: str


class DocumentOut(RecordOut):
    filename: str
    sha256: str
    content_type: str
    uploaded_by: str


T = TypeVar("T")


class PageOut(Output, Generic[T]):
    items: list[T]
    total: int = Field(ge=0)
    offset: int = Field(ge=0)
    limit: int = Field(ge=1)


class MessageOut(RecordOut):
    conversation_id: str
    role: str
    content: str
    request_key: str | None


class ConversationOut(RecordOut):
    user_id: str
    title: str
    messages: list[MessageOut]
    workflows: list[dict[str, Any]]
    tools: list[dict[str, Any]]


class HealthOut(Output):
    status: str
    service: str


class DatabaseHealthOut(Output):
    connected: bool
    version: str
    migration: str


class OllamaHealthOut(Output):
    connected: bool
    ready: bool
    model: str
    installed_models: list[str]
