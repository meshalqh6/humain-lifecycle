import { HumainLogo } from "../components/humain-logo";
import { ChatActions } from "../components/chat-actions";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import {
  Sparkles,
  Plus,
  Send,
  Paperclip,
  Copy,
  Check,
  ArrowUpRight,
  ScanLine,
  FileText,
  X,
  RefreshCw,
  ChevronDown,
  PanelLeft,
  PanelLeftClose,
  Search,
  MessageSquare,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useData } from "../app";
import { api, post, parseSSE } from "../services/api";
import { Failure, Modal, Button } from "../components/ui";

const prompts = [
  [
    "Review a Qiwa contract",
    "Extract key details and flag what needs a closer look.",
    "Review the attached Qiwa contract and show validation issues.",
  ],
  [
    "Welcome someone new",
    "Bring contracts, HR tasks and the welcome email together.",
    "Review the attached contract, verify the employee, complete onboarding, prepare HR tasks, and send the authorized welcome email.",
  ],
  [
    "Stay ahead of renewals",
    "See the documents expiring within the next 30 days.",
    "Find documents expiring within 30 days.",
  ],
  [
    "Understand your workforce",
    "Explore your Saudization ratio and profession breakdown.",
    "Calculate our Saudization ratio and profession breakdown.",
  ],
];

export default function Wasl() {
  const [params, setParams] = useSearchParams();
  const [id, setId] = useState(params.get("conversation") || "");
  const [historyOpen, setHistoryOpen] = useState(
    () => window.innerWidth > 1000,
  );
  const [historySearch, setHistorySearch] = useState("");
  const [deleteChat, setDeleteChat] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [deletingChat, setDeletingChat] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [creatingChat, setCreatingChat] = useState(false);
  const [draft, setDraft] = useState("");
  const [pendingUser, setPendingUser] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [attachment, setAttachment] = useState<any>(
    params.get("document")
      ? { id: params.get("document"), filename: "Selected contract" }
      : null,
  );
  const [traces, setTraces] = useState<any[]>([]);
  const [copied, setCopied] = useState("");
  const [lastInput, setLastInput] = useState("");
  const scroll = useRef<HTMLDivElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const client = useQueryClient();
  const history = useData("/agent/conversations");
  const conversation = useData("/agent/conversations/" + id, !!id);
  const model = useData("/health/ollama");
  const messages =
    id && conversation.data?.id === id ? conversation.data.messages : [];
  const messageCount = messages.length;
  useEffect(() => {
    if (messageCount || busy || pendingUser) {
      scroll.current?.scrollTo({
        top: scroll.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [draft, status, messageCount, busy, pendingUser]);
  function selectConversation(conversationId: string) {
    if (busy || deletingChat) return;
    setId(conversationId);
    setParams({ conversation: conversationId }, { replace: true });
    setTraces([]);
    setError("");
    setDraft("");
    setPendingUser("");
    setStatus("");
    setInput("");
    setLastInput("");
    setAttachment(null);
    if (window.innerWidth <= 1000) setHistoryOpen(false);
  }
  async function start() {
    if (busy || creatingChat || deletingChat) return;
    setCreatingChat(true);
    try {
      const c = await post("/agent/conversations");
      selectConversation(c.id);
      setDraft("");
      setPendingUser("");
      setTraces([]);
      setError("");
      await client.invalidateQueries({ queryKey: ["/agent/conversations"] });
      return c.id;
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCreatingChat(false);
    }
  }
  async function attach(f: File) {
    const data = new FormData();
    data.append("file", f);
    try {
      const doc = await api("/documents", { method: "POST", body: data });
      setAttachment(doc);
      toast.success("Document attached and stored");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  async function send(text = input) {
    if (!text.trim() || busy || creatingChat || deletingChat) return;
    setBusy(true);
    setInput("");
    setError("");
    setDraft("");
    setPendingUser(text);
    setLastInput(text);
    setStatus("Connecting to HUMAIN Chat…");
    setTraces([]);
    let conversationId = id;
    try {
      if (!conversationId) {
        const c = await post("/agent/conversations");
        conversationId = c.id;
        setId(c.id);
        setParams(
          (current) => {
            const next = new URLSearchParams(current);
            next.set("conversation", c.id);
            return next;
          },
          { replace: true },
        );
      }
      const response = await fetch("/api/agent/chat", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "X-Humain-Request": "1",
        },
        body: JSON.stringify({
          conversation_id: conversationId,
          message: text,
          document_id: attachment?.id || null,
          request_key: crypto.randomUUID(),
        }),
      });
      if (!response.ok) {
        const r = await response.json();
        throw new Error(r.error?.message || "Unable to start the conversation");
      }
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finished = false;
      while (true) {
        const next = await reader.read();
        if (next.done) break;
        buffer += decoder.decode(next.value, { stream: true });
        let boundary;
        while ((boundary = buffer.indexOf("\n\n")) !== -1) {
          const entry = parseSSE(buffer.slice(0, boundary));
          buffer = buffer.slice(boundary + 2);
          if (!entry) continue;
          const { event, data } = entry;
          if (event === "token") setDraft((d) => d + data.text);
          if (event === "status") setStatus(data.message);
          if (event === "tool") {
            setStatus(data.tool.replaceAll("_", " "));
            setTraces((old) => {
              const found = old.findIndex(
                (t) => t.tool === data.tool && t.status === "validating",
              );
              return found >= 0
                ? old.map((t, i) => (i === found ? data : t))
                : [...old, data];
            });
          }
          if (event === "done") {
            finished = true;
            setStatus("Conversation saved");
          }
          if (event === "error") {
            finished = true;
            setError(data.message);
            setStatus("Action requires attention");
          }
        }
      }
      if (!finished)
        throw new Error(
          "The connection closed before a final outcome. Check conversation history and the audit trail before retrying.",
        );
      await client.invalidateQueries();
      setPendingUser("");
      setDraft("");
    } catch (e) {
      setError((e as Error).message);
      setStatus("Connection interrupted");
    } finally {
      setBusy(false);
    }
  }
  const allTraces = traces.length
    ? traces
    : id && conversation.data?.id === id
      ? conversation.data.tools
      : [];
  return (
    <div
      className={
        "wasl-workspace chat-layout " +
        (historyOpen ? "history-open" : "history-collapsed")
      }
    >
      <aside
        className="chat-history"
        id="chat-history-sidebar"
        aria-label="Chat sidebar"
        inert={!historyOpen}
      >
        <div className="chat-history-heading">
          <h2>Your chats</h2>
          <button
            className="icon-btn"
            type="button"
            aria-label="Close chat sidebar"
            onClick={() => setHistoryOpen(false)}
          >
            <PanelLeftClose size={18} />
          </button>
        </div>
        <button
          type="button"
          className="new-chat-button"
          disabled={busy || creatingChat}
          onClick={() => void start()}
        >
          <Plus size={18} />
          New chat
        </button>
        <label className="chat-history-search">
          <Search size={15} />
          <input
            aria-label="Search chats"
            placeholder="Search chats"
            value={historySearch}
            onChange={(e) => setHistorySearch(e.target.value)}
          />
        </label>
        <nav className="chat-history-list" aria-label="Conversation history">
          {history.isPending ? (
            <p className="chat-history-empty" role="status">
              Loading chats…
            </p>
          ) : history.error ? (
            <Failure error={history.error} retry={history.refetch} />
          ) : (
            (() => {
              const filtered = (history.data?.items || []).filter((c: any) =>
                c.title
                  .toLocaleLowerCase()
                  .includes(historySearch.toLocaleLowerCase()),
              );
              if (!filtered.length)
                return (
                  <p className="chat-history-empty">
                    {historySearch
                      ? "No matching chats"
                      : "Start your first conversation."}
                  </p>
                );
              const now = new Date();
              now.setHours(0, 0, 0, 0);
              return ["Today", "Previous 7 days", "Earlier"].map((group) => {
                const items = filtered.filter((c: any) => {
                  const age =
                    (now.getTime() - new Date(c.created_at).getTime()) /
                    86400000;
                  return (
                    (age <= 0
                      ? "Today"
                      : age < 7
                        ? "Previous 7 days"
                        : "Earlier") === group
                  );
                });
                return items.length ? (
                  <section key={group}>
                    <h3>{group}</h3>
                    {items.map((c: any) => (
                      <div key={c.id} className="chat-history-row">
                        <button
                          type="button"
                          disabled={busy || creatingChat || deletingChat}
                          className={id === c.id ? "selected" : ""}
                          aria-current={id === c.id ? "page" : undefined}
                          onClick={() => selectConversation(c.id)}
                          title={c.title}
                        >
                          <MessageSquare size={15} />
                          <span dir="auto">{c.title}</span>
                        </button>
                        <ChatActions
                          title={c.title}
                          disabled={busy || creatingChat || deletingChat}
                          onDelete={() =>
                            setDeleteChat({ id: c.id, title: c.title })
                          }
                        />
                      </div>
                    ))}
                  </section>
                ) : null;
              });
            })()
          )}
        </nav>
      </aside>
      <Modal
        open={!!deleteChat}
        title="Delete chat?"
        description="Remove this conversation from your chat history."
        onClose={() => {
          if (!deletingChat) setDeleteChat(null);
        }}
      >
        <p>
          Delete <strong>{deleteChat?.title}</strong>? This archives the chat.
          Employee records, contracts, journeys and audit evidence are
          preserved.
        </p>
        <div className="modal-actions">
          <Button
            secondary
            disabled={deletingChat}
            onClick={() => setDeleteChat(null)}
          >
            Cancel
          </Button>
          <button
            type="button"
            className="button danger"
            disabled={deletingChat}
            onClick={async () => {
              if (!deleteChat || deletingChat) return;
              const target = deleteChat.id;
              setDeletingChat(true);
              try {
                await api("/agent/conversations/" + target, {
                  method: "DELETE",
                });
                client.removeQueries({
                  queryKey: ["/agent/conversations/" + target],
                });
                if (id === target) {
                  setId("");
                  setParams({}, { replace: true });
                  setTraces([]);
                  setError("");
                  setDraft("");
                  setPendingUser("");
                  setStatus("");
                  setInput("");
                  setLastInput("");
                  setAttachment(null);
                }
                setDeleteChat(null);
                await client.invalidateQueries({
                  queryKey: ["/agent/conversations"],
                });
                toast.success("Chat deleted from history");
              } catch (e) {
                toast.error((e as Error).message);
              } finally {
                setDeletingChat(false);
              }
            }}
          >
            <Trash2 size={16} />
            {deletingChat ? "Deleting…" : "Confirm delete"}
          </button>
        </div>
      </Modal>
      {historyOpen && (
        <button
          type="button"
          className="chat-history-scrim"
          aria-label="Dismiss chat sidebar"
          onClick={() => setHistoryOpen(false)}
        />
      )}
      <section className="chat-main">
        <div className="chat-top">
          <div>
            <span className="wasl-symbol">
              <Sparkles size={20} />
            </span>
            <h1 className="chat-brand">
              <img
                src="/branding/humain-chat-logo.png"
                alt="HUMAIN CHAT"
                className="humain-chat-logo"
              />
            </h1>
          </div>
          <div className="chat-controls">
            <button
              className="icon-btn"
              type="button"
              onClick={() => setHistoryOpen((v) => !v)}
              aria-label={
                historyOpen ? "Hide chat sidebar" : "Show chat sidebar"
              }
              aria-expanded={historyOpen}
              aria-controls="chat-history-sidebar"
            >
              {historyOpen ? (
                <PanelLeftClose size={20} />
              ) : (
                <PanelLeft size={20} />
              )}
            </button>
          </div>
        </div>
        <div className="chat-scroll" ref={scroll}>
          {!messages.length && !pendingUser ? (
            <div className="chat-welcome">
              <div className="wasl-glyph">
                <HumainLogo />
                <span />
              </div>
              <span className="eyebrow">
                YOUR PEOPLE OPERATIONS, CONNECTED.
              </span>
              <h2>
                A little intelligence.
                <br />
                <em>A lot more possibility.</em>
              </h2>
              <p>
                Welcome to HUMAIN Chat.
                <br />
                What can we move forward today?
              </p>
              <div className="prompt-grid">
                {prompts.map(([title, desc, prompt], i) => (
                  <button key={title} onClick={() => setInput(prompt)}>
                    <span className="prompt-number">0{i + 1}</span>
                    <h3>
                      {title}
                      <ArrowUpRight size={16} />
                    </h3>
                    <p>{desc}</p>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="messages">
              {messages.map((m: any) => (
                <div className={"message " + m.role} key={m.id}>
                  <span className="message-avatar">
                    {m.role === "user" ? "HR" : <HumainLogo />}
                  </span>
                  <div className="message-body">
                    <div className="message-meta">
                      <strong>
                        {m.role === "user" ? "You" : "HUMAIN Chat"}
                      </strong>
                      <time>
                        {new Date(m.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </time>
                    </div>
                    <div dir="auto">
                      <ReactMarkdown>{m.content}</ReactMarkdown>
                    </div>
                    {m.role === "assistant" && (
                      <button
                        className="copy-btn"
                        aria-label="Copy response"
                        onClick={async () => {
                          await navigator.clipboard.writeText(m.content);
                          setCopied(m.id);
                          setTimeout(() => setCopied(""), 1500);
                        }}
                      >
                        {copied === m.id ? (
                          <Check size={13} />
                        ) : (
                          <Copy size={13} />
                        )}{" "}
                        {copied === m.id ? "Copied" : "Copy"}
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {pendingUser && (
                <div className="message user">
                  <span className="message-avatar">HR</span>
                  <div className="message-body">
                    <div className="message-meta">
                      <strong>You</strong>
                      <span>Now</span>
                    </div>
                    <p dir="auto">{pendingUser}</p>
                  </div>
                </div>
              )}
              {(draft || busy) && (
                <div className="message assistant">
                  <span className="message-avatar">
                    <HumainLogo />
                  </span>
                  <div className="message-body">
                    <div className="message-meta">
                      <strong>HUMAIN Chat</strong>
                      <span>{busy ? "Working" : "Now"}</span>
                    </div>
                    {draft ? (
                      <div dir="auto">
                        <ReactMarkdown>{draft}</ReactMarkdown>
                      </div>
                    ) : (
                      <div className="thinking">
                        <span />
                        <span />
                        <span />
                        {status}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          {(allTraces.length > 0 || (id && status)) && (
            <details className="chat-activity" open={busy || !!error}>
              <summary>
                <ScanLine size={15} />
                <strong>Activity</strong>
                <span>{allTraces.length} actions</span>
                <ChevronDown size={14} />
              </summary>
              {allTraces.length ? (
                allTraces.map((t: any, i: number) => (
                  <details className="trace" key={t.id || i}>
                    <summary>
                      <span
                        className={
                          "trace-dot " +
                          (t.status === "success"
                            ? "done"
                            : t.status === "failed"
                              ? "failed"
                              : "")
                        }
                      >
                        <Check size={11} />
                      </span>
                      <div>
                        <strong>{t.tool.replaceAll("_", " ")}</strong>
                        <small>
                          {t.verified
                            ? "Policy checked · result committed"
                            : t.status}
                        </small>
                      </div>
                      <ChevronDown size={12} />
                    </summary>
                    <pre>
                      {JSON.stringify(t.result || t.arguments, null, 2)}
                    </pre>
                    {t.id && <code>Audit reference {t.id.slice(0, 8)}</code>}
                  </details>
                ))
              ) : (
                <div className="execution-empty">
                  <ScanLine size={25} />
                  <p>A clear view of every step.</p>
                  <span>
                    Tool calls, policy checks and verification results appear
                    here as HUMAIN Chat works.
                  </span>
                </div>
              )}
              {status && (
                <p className="execution-status" role="status">
                  {status}
                </p>
              )}
            </details>
          )}
          {error && (
            <div className="chat-error" role="alert">
              <strong>HUMAIN Chat needs your attention</strong>
              <p>{error}</p>
              {lastInput && (
                <button
                  className="text-button"
                  disabled={busy || creatingChat}
                  onClick={() => send(lastInput)}
                >
                  <RefreshCw size={14} />
                  Retry as a new request
                </button>
              )}
            </div>
          )}
          {id && conversation.error && !busy && (
            <Failure error={conversation.error} />
          )}
        </div>
        <div className="composer-wrap">
          {attachment && (
            <div className="attached-file">
              <FileText size={15} />
              <span>{attachment.filename}</span>
              <span className="mono">{attachment.id.slice(0, 8)}</span>
              <button
                className="icon-btn"
                aria-label="Remove attachment"
                onClick={() => setAttachment(null)}
              >
                <X size={14} />
              </button>
            </div>
          )}
          <form
            className="composer"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <textarea
              aria-label="Message HUMAIN Chat"
              placeholder="Message HUMAIN Chat… ابدأ المحادثة"
              value={input}
              disabled={busy || creatingChat}
              dir="auto"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
            />
            <div className="composer-bottom">
              <div>
                <button
                  className="icon-btn"
                  type="button"
                  disabled={busy || creatingChat}
                  aria-label="Attach contract"
                  onClick={() => file.current?.click()}
                >
                  <Paperclip size={18} />
                </button>
                <span>
                  <span
                    className={model.data?.ready ? "live-dot" : "offline-dot"}
                  />
                  {model.data?.model || "Checking model"}
                </span>
              </div>
              <button
                className="send-btn"
                type="submit"
                aria-label="Send message"
                disabled={busy || creatingChat || !input.trim()}
              >
                <Send size={17} />
              </button>
            </div>
          </form>
          <input
            ref={file}
            hidden
            type="file"
            accept=".pdf,.csv,.xlsx"
            onChange={(e) => {
              if (e.target.files?.[0]) void attach(e.target.files[0]);
              e.target.value = "";
            }}
          />
          <p className="composer-note">
            HUMAIN Chat can make mistakes. Review contract details and important
            decisions.
          </p>
        </div>
      </section>
    </div>
  );
}
