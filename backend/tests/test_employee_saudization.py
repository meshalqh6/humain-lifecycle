from app.database import models as m


def test_saudization_aliases_scope_and_exact_profession_drilldown(client, db):
    for i, nationality in enumerate(["Saudi", " Saudi Arabian ", "KSA", "سعودي", "سعودية", "SA", "British"]):
        db.add(m.Employee(employee_number=f"SAUD-{i}", name=f"Synthetic {i}", nationality=nationality,
                          profession="Engineer", synthetic=True, status="onboarding" if i == 0 else "active", idempotency_key=f"saud-{i}"))
    db.add(m.Employee(employee_number="SENIOR", name="Synthetic Senior", nationality="Egyptian",
                      profession="Senior Engineer", synthetic=True, idempotency_key="saud-senior"))
    db.add(m.Employee(employee_number="INACTIVE", name="Synthetic Inactive", nationality="Saudi",
                      profession="Engineer", status="inactive", synthetic=True, idempotency_key="saud-inactive"))
    db.add(m.Employee(employee_number="ARCHIVED", name="Synthetic Archived", nationality="Saudi",
                      profession="Engineer", deleted_at=m.now(), synthetic=True, idempotency_key="saud-archived"))
    db.commit()
    result = client.get("/api/saudization").json()
    assert result["overall"] == {"total": 8, "saudi": 6, "non_saudi": 2, "rate": 75.0}
    group = next(g for g in result["by_profession"] if g["profession"] == "Engineer")
    assert group == {"profession": "Engineer", "total": 7, "saudi": 6, "non_saudi": 1, "rate": 85.7}
    detail = client.get("/api/employees?profession=Engineer&workforce_only=true&limit=2&offset=2").json()
    assert detail["total"] == group["total"]
    assert len(detail["items"]) == 2
    assert all(e["profession"] == "Engineer" and e["status"] != "inactive" for e in detail["items"])
    assert client.get("/api/employees?profession=Engineer").json()["total"] == 8


def test_empty_workforce_saudization(client):
    result = client.get("/api/saudization").json()
    assert result["overall"]["total"] == 0
    assert result["overall"]["rate"] == 0
    assert result["by_profession"] == []
