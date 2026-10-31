import pytest
from sqlalchemy import select
from fastapi import HTTPException
from app import agent, ollama
from app.database import models as m
from app.security import authorize, hash_password, session_token


def test_auth_and_csrf(client):
    assert client.get("/api/health/database").json()["connected"]
    client.cookies.clear()
    assert client.get("/api/employees").status_code == 401
    assert client.post("/api/agent/conversations", headers={"X-Humain-Request": "0"}).status_code == 403


def test_employee_crud_pagination_and_audit(client):
    data = {"employee_number": "API-1", "name": "API Demo", "nationality": "Saudi", "synthetic": True}
    response = client.post("/api/employees", json=data, headers={"Idempotency-Key": "api-test-1"})
    assert response.status_code == 200, response.text
    id = response.json()["id"]
    assert client.post("/api/employees", json=data, headers={"Idempotency-Key": "api-test-1"}).json()["id"] == id
    assert client.get("/api/employees?q=API&limit=1").json()["total"] == 1
    assert client.get("/api/employees?limit=999").status_code == 422
    assert client.put("/api/employees/" + id, json={**data, "profession": "Engineer"}).status_code == 200
    assert client.get("/api/employees/" + id).json()["profession"] == "Engineer"
    assert client.delete("/api/employees/" + id).status_code == 200
    assert client.get("/api/employees").json()["total"] == 0
    assert client.get("/api/audit?q=employee").json()["total"] == 3


def test_permissions_and_prohibited_tools(db, actor):
    role = m.Role(name="viewer")
    db.add(role)
    db.flush()
    viewer = m.User(username="viewer", role_id=role.id, password_hash=hash_password("synthetic-password"))
    db.add(viewer)
    db.commit()
    with pytest.raises(HTTPException):
        authorize(db, viewer, "hr.write")
    with pytest.raises(HTTPException):
        agent.execute(db, actor, "terminate_employee", {"id": "x"}, "k")
    with pytest.raises(ValueError):
        agent.execute(db, actor, "get_expiring_documents", {"days": 999, "execute": "rm"}, "k")


def test_conversation_isolation(client, db):
    role = db.scalar(select(m.Role))
    other = m.User(username="other", role_id=role.id, password_hash=hash_password("synthetic"))
    db.add(other)
    db.flush()
    c = m.AgentConversation(user_id=other.id, title="Private")
    db.add(c)
    db.commit()
    assert client.get("/api/agent/conversations/" + c.id).status_code == 403
    assert (
        client.post(
            "/api/agent/chat",
            json={"conversation_id": c.id, "message": "Read private history", "request_key": "private-123"},
        ).status_code
        == 403
    )
    assert session_token(other)


@pytest.mark.parametrize("message", ["hi", "what you can do", "مرحبا", "Show the saved employee status"])
def test_no_tool_reply_preserves_latest_request_and_attachment_is_only_context(client, db, document, monkeypatch, message):
    c = client.post("/api/agent/conversations").json()
    db.add(m.AgentMessage(conversation_id=c["id"], role="assistant", content="No tools were used to verify the Qiwa contract."))
    db.commit()
    def plan(messages, tools=None, schema=None):
        if schema:
            return {"content": '{"decision":"allow"}'}
        assert messages[-1] == {"role": "user", "content": message}
        assert any(x["role"] == "system" and document.id in x["content"] for x in messages)
        return {"role": "assistant", "content": "Draft response"}
    def stream(messages):
        assert messages[-1] == {"role": "user", "content": message}
        assert not any("Now give a concise grounded final response" in x["content"] for x in messages)
        assert "respond naturally without a tool disclaimer" in messages[1]["content"]
        assert "do not invent results or claim completion" in messages[1]["content"]
        assert "Draft response" not in [x["content"] for x in messages]
        yield "Natural reply" if message != "Show the saved employee status" else "Employee status remains unverified."
    monkeypatch.setattr(ollama, "chat", plan)
    monkeypatch.setattr(ollama, "stream", stream)
    response = client.post("/api/agent/chat", json={
        "conversation_id": c["id"], "message": message, "document_id": document.id,
        "request_key": "conversation-help-1",
    })
    assert "event: done" in response.text
    assert "event: tool" not in response.text
    assert "event: error" not in response.text
    assert db.scalar(select(m.Employee)) is None
    assert db.scalar(select(m.NotificationJob)) is None


def test_agent_native_tools_stream_and_idempotency(client, monkeypatch):
    calls = iter(
        [
            {
                "role": "assistant",
                "content": "",
                "tool_calls": [{"function": {"name": "calculate_saudization", "arguments": {}}}],
            },
            {"role": "assistant", "content": "Ready"},
        ]
    )
    monkeypatch.setattr(ollama, "chat", lambda *a, **k: {"content": '{"decision":"allow"}'} if k.get("schema") else next(calls))
    monkeypatch.setattr(ollama, "stream", lambda *a, **k: iter(["Saudi workforce: ", "0 employees."]))
    c = client.post("/api/agent/conversations").json()
    data = {"conversation_id": c["id"], "message": "Calculate Saudization", "request_key": "agent-test-1"}
    result = client.post("/api/agent/chat", json=data)
    assert "event: token" in result.text
    assert "event: tool" in result.text
    assert "event: done" in result.text
    saved = client.get("/api/agent/conversations/" + c["id"]).json()
    assert len(saved["messages"]) == 2
    assert saved["messages"][-1]["content"] == "Saudi workforce: 0 employees."
    assert saved["tools"][0]["verified"]
    assert saved["workflows"][0]["state"] == "COMPLETED"
    assert "Request already recorded" in client.post("/api/agent/chat", json=data).text


def test_agent_model_outage_persists_failure(client, monkeypatch):
    def fail(*a, **k):
        raise ollama.ModelUnavailable("Ollama is unavailable")

    monkeypatch.setattr(ollama, "chat", fail)
    c = client.post("/api/agent/conversations").json()
    result = client.post(
        "/api/agent/chat", json={"conversation_id": c["id"], "message": "Hello", "request_key": "outage-test"}
    )
    assert "event: error" in result.text
    saved = client.get("/api/agent/conversations/" + c["id"]).json()
    assert saved["workflows"][0]["state"] == "FAILED"
    assert saved["messages"][-1]["role"] == "error"


def test_ollama_health_handles_outage(monkeypatch):
    import httpx

    def fail(*a, **k):
        raise httpx.ConnectError("offline")

    monkeypatch.setattr(httpx.Client, "get", fail)
    assert ollama.health()["ready"] is False
