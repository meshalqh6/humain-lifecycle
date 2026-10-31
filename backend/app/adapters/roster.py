"""CSV/XLSX roster validation and preview."""

import io
import hashlib
from datetime import date
import pandas as pd
from fastapi import HTTPException
from sqlalchemy import select
from app.adapters import hr_rules
from app.database import models as m
from app.schemas import EmployeeInput
from app.services import lock, audit


def parse(content, filename, synthetic):
    if len(content) > 8 * 1024 * 1024:
        raise HTTPException(413, "Roster exceeds 8 MB")
    try:
        if filename.lower().endswith(".csv"):
            frame = pd.read_csv(io.BytesIO(content), dtype=str, keep_default_na=False, nrows=1001)
        elif filename.lower().endswith(".xlsx"):
            import zipfile

            with zipfile.ZipFile(io.BytesIO(content)) as z:
                if sum(i.file_size for i in z.infolist()) > 30 * 1024 * 1024:
                    raise HTTPException(413, "Expanded workbook exceeds 30 MB")
            frame = pd.read_excel(io.BytesIO(content), dtype=str, keep_default_na=False, nrows=1001)
        else:
            raise HTTPException(415, "Roster import supports CSV and XLSX only")
    except (ValueError, OSError) as exc:
        raise HTTPException(422, "Could not read the roster") from exc
    if len(frame) > 1000 or frame.empty:
        raise HTTPException(422, "Roster must contain 1 to 1000 employees")
    required = ["Employee Name", "Iqama Number", "Nationality"]
    missing = [c for c in required if c not in frame.columns]
    if missing:
        raise HTTPException(422, "Required legacy headers missing: " + ", ".join(missing))
    records = []
    errors = []
    seen = set()
    for i, values in frame.iterrows():
        try:
            number = values["Iqama Number"].strip()
            if number in seen:
                raise ValueError("Duplicate employee number within this file")
            seen.add(number)
            normalized = {}
            for legacy, key in [
                ("Iqama Expiry Date", "iqama_expiry"),
                ("Work Permit Expiry", "work_permit_expiry"),
                ("Contract Start Date", "start_date"),
                ("Contract End Date", "end_date"),
            ]:
                raw = values.get(legacy, "")
                value = hr_rules.normalize_date(raw)
                if raw and value is None:
                    raise ValueError("Invalid date in " + legacy)
                normalized[key] = value
            employee = EmployeeInput(
                employee_number=number,
                name=values["Employee Name"],
                nationality=values["Nationality"],
                profession=values.get("Profession") or "Unspecified",
                email=values.get("Email") or None,
                iqama_expiry=normalized["iqama_expiry"],
                work_permit_expiry=normalized["work_permit_expiry"],
                synthetic=synthetic,
            )
            start, end = normalized["start_date"], normalized["end_date"]
            if (start is None) != (end is None) or (start and end < start):
                raise ValueError("Contract dates are incomplete or reversed")
            records.append(
                {
                    "employee": employee.model_dump(mode="json"),
                    "start_date": start.isoformat() if start else None,
                    "end_date": end.isoformat() if end else None,
                }
            )
        except ValueError:
            errors.append(
                {"row": int(i) + 2, "message": "Invalid, duplicate or missing required employee/date/email information"}
            )
    return {"records": records, "errors": errors, "count": len(frame), "sha256": hashlib.sha256(content).hexdigest()}


def apply(db, preview, actor):
    if preview["errors"]:
        raise HTTPException(422, "Resolve all roster validation issues before importing")
    lock(db, "roster:" + preview["sha256"])
    created = []
    skipped = []
    for record in preview["records"]:
        data = EmployeeInput.model_validate(record["employee"])
        lock(db, "employee:" + data.employee_number)
        existing = db.scalar(select(m.Employee).where(m.Employee.employee_number == data.employee_number))
        if existing:
            # A repeated file is safe; conflicting profiles require explicit human reconciliation.
            if existing.idempotency_key != "roster:" + preview["sha256"] + ":" + data.employee_number:
                raise HTTPException(
                    409, "An employee number already exists from another source; no roster changes were committed"
                )
            skipped.append(existing.id)
            continue
        employee = m.Employee(
            **data.model_dump(), idempotency_key="roster:" + preview["sha256"] + ":" + data.employee_number
        )
        db.add(employee)
        db.flush()
        if record["start_date"]:
            db.add(
                m.Contract(
                    employee_id=employee.id,
                    start_date=date.fromisoformat(record["start_date"]),
                    end_date=date.fromisoformat(record["end_date"]),
                )
            )
        created.append(employee.id)
        audit(db, actor, "employee.imported", employee.id, synthetic=data.synthetic, source_hash=preview["sha256"])
    db.commit()
    return {"created": len(created), "duplicates_prevented": len(skipped), "employee_ids": created + skipped}
