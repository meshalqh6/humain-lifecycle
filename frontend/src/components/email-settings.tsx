import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, Save, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { api, post } from "../services/api";
import { SectionTitle, Button, Loading, Failure, Badge } from "./ui";

type Preferences = {
  smtp_mode: string;
  smtp_host: string;
  smtp_port: number;
  smtp_from: string;
  smtp_username: string;
  alert_recipient: string;
  smtp_allowed_recipients: string;
  real_email_authorized: boolean;
  alert_window_days: number;
  password_configured: boolean;
};
export function EmailSettings() {
  const query = useQuery<Preferences, Error>({
    queryKey: ["email-settings"],
    queryFn: () => api("/settings/email"),
  });
  if (query.isPending) return <Loading />;
  if (query.error) return <Failure error={query.error} retry={query.refetch} />;
  return (
    <EmailSettingsForm key={JSON.stringify(query.data)} initial={query.data!} />
  );
}
function EmailSettingsForm({ initial }: { initial: Preferences }) {
  const [form, setForm] = useState(initial);
  const [password, setPassword] = useState("");
  const [clear, setClear] = useState(false);
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [diagnostic, setDiagnostic] = useState("");
  const client = useQueryClient();
  const change = (key: keyof Preferences, value: string | number | boolean) =>
    setForm((v) => ({ ...v, [key]: value }));
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { password_configured: _, ...values } = form;
      void _;
      await api("/settings/email", {
        method: "PUT",
        body: JSON.stringify({
          ...values,
          smtp_password: password || null,
          clear_password: clear,
        }),
      });
      setPassword("");
      setClear(false);
      await client.invalidateQueries();
      toast.success(
        "Email settings saved. Changes apply immediately; no email was sent.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel email-settings-panel">
      <SectionTitle title="Email settings" action={<Mail size={19} />} />
      <form onSubmit={save} className="email-settings-form">
        <div className="form-grid">
          <label>
            Delivery mode
            <select
              value={form.smtp_mode}
              onChange={(e) => {
                const mode = e.target.value;
                setForm((v) => ({
                  ...v,
                  smtp_mode: mode,
                  real_email_authorized: false,
                  ...(mode === "sandbox"
                    ? { smtp_host: "127.0.0.1", smtp_port: 1025 }
                    : {}),
                }));
              }}
            >
              <option value="sandbox">Sandbox — local test inbox</option>
              <option value="real">Real SMTP — STARTTLS</option>
              <option value="disabled">Disabled — no sending</option>
            </select>
          </label>
          <label>
            Alert window (days)
            <input
              type="number"
              min={1}
              max={365}
              required
              value={form.alert_window_days}
              onChange={(e) => change("alert_window_days", +e.target.value)}
            />
          </label>
          <label>
            SMTP server
            <input
              required
              value={form.smtp_host}
              placeholder="smtp.gmail.com"
              onChange={(e) => change("smtp_host", e.target.value)}
            />
          </label>
          <label>
            SMTP port
            <input
              type="number"
              required
              min={1}
              max={65535}
              value={form.smtp_port}
              onChange={(e) => change("smtp_port", +e.target.value)}
            />
          </label>
          <label>
            Sender email
            <input
              type="email"
              required
              value={form.smtp_from}
              placeholder="hr@example.com"
              onChange={(e) => change("smtp_from", e.target.value)}
            />
          </label>
          <label>
            SMTP username / Gmail address
            <input
              value={form.smtp_username}
              autoComplete="off"
              placeholder="Usually your sender email"
              onChange={(e) => change("smtp_username", e.target.value)}
            />
          </label>
          <label>
            SMTP app password
            <span className="password-input">
              <input
                type={visible ? "text" : "password"}
                value={password}
                autoComplete="new-password"
                placeholder={
                  initial.password_configured
                    ? "Password saved — leave blank to keep it"
                    : "Enter app password"
                }
                onChange={(e) => {
                  setPassword(e.target.value);
                  setClear(false);
                }}
              />
              <button
                className="icon-btn"
                type="button"
                aria-label={
                  visible ? "Hide SMTP password" : "Show SMTP password"
                }
                onClick={() => setVisible(!visible)}
              >
                {visible ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </span>
          </label>
          <label>
            Alert recipient email
            <input
              aria-label="Alert recipient email"
              type="email"
              value={form.alert_recipient}
              placeholder="renewals@humain.test"
              onChange={(e) => change("alert_recipient", e.target.value)}
            />
            <small>
              Renewal reminders go here. Leave blank to use each employee’s
              email.
            </small>
          </label>
          <label className="full">
            Additional approved recipients
            <input
              value={form.smtp_allowed_recipients}
              placeholder="welcome@humain.test, renewals@humain.test"
              onChange={(e) =>
                change("smtp_allowed_recipients", e.target.value)
              }
            />
            <small>
              Comma-separated addresses. The alert recipient above is approved
              when you save.
            </small>
          </label>
        </div>
        <div className="email-settings-options">
          <Badge tone={initial.password_configured ? "green" : "neutral"}>
            {initial.password_configured
              ? "SMTP password saved securely"
              : "No SMTP password saved"}
          </Badge>
          {initial.password_configured && (
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={clear}
                onChange={(e) => {
                  setClear(e.target.checked);
                  setPassword("");
                }}
              />
              Remove stored password
            </label>
          )}
        </div>
        {form.smtp_mode === "real" ? (
          <label className="checkbox-label authorization">
            <input
              type="checkbox"
              checked={form.real_email_authorized}
              onChange={(e) =>
                change("real_email_authorized", e.target.checked)
              }
            />
            I authorize real SMTP delivery of approved routine HR emails to the
            recipients configured here.
          </label>
        ) : (
          <p className="subtle">
            Sandbox uses 127.0.0.1:1025 and .test recipients. For a real inbox,
            select Real SMTP and configure your provider’s STARTTLS settings
            (usually port 587).
          </p>
        )}
        <p className="subtle">
          Welcome emails use the employee’s email. Changing settings does not
          resend or redirect existing email jobs. Already prepared messages
          retain their recorded recipient and may require review.
        </p>
        {error && (
          <p className="review-issue" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <Button type="submit" busy={busy}>
            <Save size={15} />
            Save email settings
          </Button>
        </div>
        <div className="journey-actions">
          <Button
            secondary
            busy={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const result = await post("/settings/email/test");
                setDiagnostic(
                  result.message +
                    (result.error_type ? " (" + result.error_type + ")" : ""),
                );
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Test saved connection
          </Button>
          {diagnostic && <p role="status">{diagnostic}</p>}
        </div>
      </form>
    </section>
  );
}
