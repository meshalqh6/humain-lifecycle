from sqlalchemy import select
from app.database import models as m
from app import agent, schemas


def test_chat_delete_hides_history_and_blocks_reuse_without_erasing_evidence(client, db):
    chat = client.post("/api/agent/conversations").json()
    message = m.AgentMessage(conversation_id=chat["id"], role="user", content="Synthetic history")
    flow = m.AgentWorkflow(conversation_id=chat["id"], state="COMPLETED", request_key="delete-test-flow")
    db.add_all([message, flow])
    db.commit()
    url = "/api/agent/conversations/" + chat["id"]
    assert client.delete(url).json() == {"deleted": True}
    assert chat["id"] not in [x["id"] for x in client.get("/api/agent/conversations").json()["items"]]
    assert client.get(url).status_code == 404
    data = {"conversation_id": chat["id"], "message": "Do not run", "request_key": "deleted-chat-request"}
    assert client.post("/api/agent/chat", json=data).status_code == 404
    assert "Chat has been deleted" in "".join(agent.run_chat(schemas.ChatInput(**data), chat["user_id"]))
    assert client.delete(url).json() == {"deleted": True}
    db.expire_all()
    assert db.get(m.AgentMessage, message.id) is not None
    assert db.get(m.AgentWorkflow, flow.id).state == "COMPLETED"
    events = db.scalars(select(m.AuditEvent).where(
        m.AuditEvent.action == "conversation.deleted", m.AuditEvent.object_id == chat["id"],
    )).all()
    assert len(events) == 1


def test_other_users_cannot_delete_chat(client, db, actor):
    other = m.User(username="private-chat-owner", password_hash="unused", role_id=actor.role_id)
    db.add(other)
    db.flush()
    chat = m.AgentConversation(user_id=other.id)
    db.add(chat)
    db.commit()
    assert client.delete("/api/agent/conversations/" + chat.id).status_code == 403
    db.refresh(chat)
    assert chat.deleted_at is None


def test_running_chat_must_finish_before_deletion(client, db):
    chat = client.post("/api/agent/conversations").json()
    db.add(m.AgentWorkflow(conversation_id=chat["id"], request_key="running-delete-test", state="RUNNING"))
    db.commit()
    assert client.delete("/api/agent/conversations/" + chat["id"]).status_code == 409
    assert client.get("/api/agent/conversations/" + chat["id"]).status_code == 200
