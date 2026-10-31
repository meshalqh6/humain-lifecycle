import httpx
from app.config import settings


class ModelUnavailable(RuntimeError):
    pass


def health():
    cfg = settings()
    try:
        with httpx.Client(timeout=3) as client:
            response = client.get(cfg.ollama_url + "/api/tags")
            response.raise_for_status()
            names = [m["name"] for m in response.json()["models"]]
            return {
                "connected": True,
                "ready": cfg.ollama_model in names,
                "model": cfg.ollama_model,
                "installed_models": names,
            }
    except (httpx.HTTPError, ValueError, KeyError):
        return {"connected": False, "ready": False, "model": cfg.ollama_model, "installed_models": []}


def chat(messages, tools=None, schema=None):
    cfg = settings()
    payload = {
        "model": cfg.ollama_model,
        "messages": messages,
        "stream": False,
        "think": False,
        "keep_alive": "5m",
        "options": {"temperature": 0, "num_ctx": 8192, "num_predict": 2200},
    }
    if tools:
        payload["tools"] = tools
    if schema:
        payload["format"] = schema
    # Only a connection-establishment failure is retried. No action is executed by the model itself.
    for attempt in range(2):
        try:
            with httpx.Client(timeout=cfg.ollama_timeout) as client:
                r = client.post(cfg.ollama_url + "/api/chat", json=payload)
                r.raise_for_status()
                return r.json()["message"]
        except httpx.ConnectError:
            if attempt == 0:
                continue
            raise ModelUnavailable("Ollama is unavailable. Start Ollama and retry.") from None
        except (httpx.HTTPError, ValueError, KeyError):
            raise ModelUnavailable("Qwen request failed or timed out. No model success was recorded.") from None


def stream(messages):
    cfg = settings()
    try:
        with httpx.Client(timeout=cfg.ollama_timeout) as client:
            with client.stream(
                "POST",
                cfg.ollama_url + "/api/chat",
                json={
                    "model": cfg.ollama_model,
                    "messages": messages,
                    "stream": True,
                    "think": False,
                    "options": {"temperature": 0, "num_ctx": 8192, "num_predict": 1000},
                },
            ) as response:
                response.raise_for_status()
                import json

                for line in response.iter_lines():
                    if line:
                        data = json.loads(line)
                        if data.get("error"):
                            raise ModelUnavailable("Model stream failed")
                        token = data.get("message", {}).get("content", "")
                        if token:
                            yield token
    except (httpx.HTTPError, ValueError):
        raise ModelUnavailable("Model stream interrupted. Verified tool results remain in the audit trail.") from None
