import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import {
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Upload,
  FileCheck2,
  Clock3,
} from "lucide-react";
import { toast } from "sonner";
import { api, post } from "../services/api";
import {
  Badge,
  Button,
  Empty,
  Failure,
  Loading,
  Modal,
  SectionTitle,
} from "../components/ui";

type Tab = "Journeys" | "Exceptions" | "Tasks" | "Company policies";
const fields = [
  "salary",
  "probation_days",
  "employment_type",
  "work_location",
  "renewal_terms",
  "email",
  "start_date",
  "end_date",
];
const label = (value: string) => value.replaceAll("_", " ");
const sampleSource =
  "Demonstration policy only. These are fictional company preferences, not legal requirements.\nEvery contract must specify a work location.\nThe probation period must be no more than 90 days.";
const blankRule = () => ({
  field: "work_location",
  operator: "required",
  value: "",
  quote: "",
});
function Status({ value }: { value: string }) {
  return (
    <Badge
      tone={
        ["VERIFIED", "verified", "completed"].includes(value)
          ? "green"
          : ["FAILED", "UNKNOWN"].includes(value)
            ? "red"
            : "amber"
      }
    >
      {label(value).toLowerCase()}
    </Badge>
  );
}
export default function Journeys() {
  const client = useQueryClient();
  const [tab, setTab] = useState<Tab>("Journeys");
  const [searchParams, setSearchParams] = useSearchParams();
  const selected = searchParams.get("journey") || "";
  const setSelected = (id: string) =>
    setSearchParams({ journey: id }, { replace: true });
  const [taskOffset, setTaskOffset] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [objective, setObjective] = useState(
    "Prepare onboarding from this contract and verify the result",
  );
  const [policy, setPolicy] = useState("");
  const [documentId, setDocumentId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [review, setReview] = useState<any>(null);
  const [decision, setDecision] = useState(false);
  const [measurement, setMeasurement] = useState(false);
  const [baselineStarted, setBaselineStarted] = useState<number | null>(null);
  const [stopwatchSeconds, setStopwatchSeconds] = useState<number | null>(null);
  const list = useQuery({
    queryKey: ["/journeys"],
    queryFn: () => api("/journeys"),
    refetchInterval: busy ? 2000 : 10000,
  });
  const policies = useQuery({
    queryKey: ["/policies"],
    queryFn: () => api("/policies"),
  });
  const docs = useQuery({
    queryKey: ["/documents?limit=100"],
    queryFn: () => api("/documents?limit=100"),
  });
  const exceptions = useQuery({
    queryKey: ["/exceptions"],
    queryFn: () => api("/exceptions"),
    refetchInterval: 10000,
  });
  const tasks = useQuery({
    queryKey: ["/tasks?limit=100&offset=" + taskOffset],
    queryFn: () => api("/tasks?limit=100&offset=" + taskOffset),
  });
  const detail = useQuery({
    queryKey: ["/journeys/" + selected],
    queryFn: () => api("/journeys/" + selected),
    enabled: !!selected,
    refetchInterval: busy ? 1500 : 5000,
  });
  const journey = detail.data;
  async function act(fn: () => Promise<any>) {
    setBusy(true);
    setError("");
    try {
      const value = await fn();
      await client.invalidateQueries();
      return value;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setBusy(false);
    }
  }
  async function start(event: React.FormEvent) {
    event.preventDefault();
    await act(async () => {
      let id = documentId;
      if (file) {
        const body = new FormData();
        body.append("file", file);
        id = (await api("/documents", { method: "POST", body })).id;
      }
      if (!id) throw Error("Choose a contract first");
      const run = await post("/journeys", {
        document_id: id,
        policy_id: policy || null,
        objective,
      });
      setSelected(run.id);
      setFile(null);
      setDocumentId(id);
      toast.success(
        run.state === "VERIFIED"
          ? "Automation setup verified"
          : "Journey saved. Review its next step.",
      );
    });
  }
  function openJourney(id: string) {
    setSelected(id);
    setTab("Journeys");
  }
  const waiting =
    (exceptions.data?.journeys.length || 0) +
    (exceptions.data?.onboarding.length || 0) +
    (exceptions.data?.email.length || 0);
  return (
    <div className="journey-workspace">
      <div className="page-head">
        <div>
          <p className="eyebrow">AUTONOMOUS PEOPLE OPERATIONS</p>
          <h1>One objective. A verified outcome.</h1>
          <p>
            Give HUMAIN a contract. Follow the work. Step in where your judgment
            matters.
          </p>
        </div>
        <Badge tone="green">Evidence at every step</Badge>
      </div>
      <div
        className="journey-tabs"
        role="tablist"
        aria-label="Journey workspace views"
      >
        {(["Journeys", "Exceptions", "Tasks", "Company policies"] as Tab[]).map(
          (t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
            >
              {t}
              {t === "Exceptions" && waiting > 0 && <span>{waiting}</span>}
            </button>
          ),
        )}
      </div>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {tab === "Journeys" && (
        <>
          <section className="panel journey-intake">
            <SectionTitle
              title="Start a contract-to-onboarding journey"
              subtitle="Creates employee records, internal HR tasks, simulated IT requests and an authorized welcome email. PDF facts and policy exceptions require review."
              action={<Sparkles size={20} />}
            />
            <form onSubmit={start} className="journey-form">
              <label className="full">
                Objective
                <input
                  aria-label="Journey objective"
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                  required
                  minLength={5}
                  maxLength={500}
                />
              </label>
              <label>
                Company policy
                <select
                  aria-label="Journey company policy"
                  value={policy}
                  onChange={(e) => setPolicy(e.target.value)}
                >
                  <option value="">Validate contract facts only</option>
                  {policies.data?.items
                    .filter((p: any) => p.active)
                    .map((p: any) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                </select>
                <small>
                  Optional. Only policies activated by an administrator are
                  available.
                </small>
              </label>
              <label>
                Existing contract
                <select
                  aria-label="Existing journey contract"
                  value={documentId}
                  onChange={(e) => {
                    setDocumentId(e.target.value);
                    setFile(null);
                  }}
                >
                  <option value="">Choose a saved document</option>
                  {docs.data?.items.map((d: any) => (
                    <option key={d.id} value={d.id}>
                      {d.filename}
                    </option>
                  ))}
                </select>
              </label>
              <label className="journey-file">
                <Upload size={18} /> Or upload a contract
                <input
                  aria-label="Upload journey contract"
                  type="file"
                  accept=".csv,.xlsx,.pdf"
                  disabled={busy}
                  onChange={(e) => {
                    setFile(e.target.files?.[0] || null);
                    setDocumentId("");
                  }}
                />
                <small>
                  {file?.name ||
                    "PDF, XLSX or CSV · 8 MB maximum · one contract"}
                </small>
              </label>
              <Button type="submit" busy={busy} disabled={!file && !documentId}>
                Start journey <ArrowRight size={16} />
              </Button>
            </form>
          </section>
          <div className="journey-columns">
            <section className="panel">
              <SectionTitle
                title="Your journeys"
                subtitle="Durable objectives, ready to resume."
              />
              {list.isPending ? (
                <Loading />
              ) : list.error ? (
                <Failure error={list.error} />
              ) : !list.data.items.length ? (
                <Empty title="Your first outcome starts here">
                  Upload a contract above to begin.
                </Empty>
              ) : (
                <div className="journey-list">
                  {list.data.items.map((j: any) => (
                    <button
                      className={selected === j.id ? "selected" : ""}
                      key={j.id}
                      onClick={() => setSelected(j.id)}
                    >
                      <FileCheck2 size={19} />
                      <span>
                        <strong>
                          {j.extraction?.fields.employee_name || j.filename}
                        </strong>
                        <small>{j.objective}</small>
                      </span>
                      <Status value={j.state} />
                    </button>
                  ))}
                </div>
              )}
            </section>
            <section className="panel journey-detail" aria-live="polite">
              {!selected ? (
                <Empty title="A clear view of every step">
                  Select a journey to see its plan and evidence.
                </Empty>
              ) : detail.isPending ? (
                <Loading />
              ) : detail.error ? (
                <Failure error={detail.error} />
              ) : (
                journey && (
                  <>
                    <SectionTitle
                      title={
                        journey.extraction?.fields.employee_name ||
                        journey.filename
                      }
                      subtitle={journey.objective}
                      action={<Status value={journey.state} />}
                    />
                    <div className="journey-stats">
                      <div>
                        <Clock3 size={16} />
                        <strong>
                          {(journey.elapsed_ms / 1000).toFixed(1)}s
                        </strong>
                        <small>Workflow execution</small>
                      </div>
                      <div>
                        <strong>{journey.human_interventions}</strong>
                        <small>Review / resume actions</small>
                      </div>
                      <div>
                        <strong>{journey.attempts}</strong>
                        <small>Execution attempts</small>
                      </div>
                    </div>
                    <ol className="journey-plan">
                      {journey.plan.map((step: any, i: number) => (
                        <li key={step.name} className={step.state}>
                          <span>
                            {step.state === "verified" ? (
                              <CheckCircle2 size={18} />
                            ) : (
                              i + 1
                            )}
                          </span>
                          <div>
                            <strong>{step.name}</strong>
                            <small>{label(step.state)}</small>
                          </div>
                        </li>
                      ))}
                    </ol>
                    {journey.error && (
                      <div className="journey-attention">
                        <AlertCircle size={18} />
                        <p>{journey.error}</p>
                      </div>
                    )}
                    {journey.extraction?.issues.map((issue: any, i: number) => (
                      <p className="review-issue" key={i}>
                        {label(issue.field)}: {issue.message}
                      </p>
                    ))}
                    {journey.policy_findings_with_sources.map(
                      (finding: any, i: number) => (
                        <div className="policy-finding" key={i}>
                          <strong>
                            {label(finding.field)}: {finding.message}
                          </strong>
                          <p>
                            Contract value:{" "}
                            {String(finding.contract_value ?? "Not found")}
                          </p>
                          <small>
                            Original contract:{" "}
                            {finding.contract_source.location}
                          </small>
                          {finding.contract_source.quote && (
                            <blockquote>
                              {finding.contract_source.quote}
                            </blockquote>
                          )}
                          {!finding.contract_source.matches_reviewed_value && (
                            <p>
                              Compare the original source: the reviewed value is
                              missing or differs.
                            </p>
                          )}
                          <small>Company policy passage</small>
                          <blockquote>{finding.policy_quote}</blockquote>
                          <small>
                            {finding.policy_title} · Rule {finding.rule}
                          </small>
                          <p>{finding.suggestion}</p>
                        </div>
                      ),
                    )}
                    <div className="journey-actions">
                      <a
                        className="text-button"
                        href={
                          "/api/documents/" + journey.document_id + "/download"
                        }
                      >
                        Download original contract
                      </a>
                      <Link
                        className="text-button"
                        to={"/chat?document=" + journey.document_id}
                      >
                        Ask HUMAIN Chat
                      </Link>
                      {journey.state !== "VERIFIED" &&
                        journey.state !== "RUNNING" && (
                          <>
                            <Button
                              secondary
                              busy={busy}
                              onClick={() =>
                                void act(() =>
                                  post("/journeys/" + journey.id + "/resume"),
                                )
                              }
                            >
                              Resume journey
                            </Button>
                            {journey.extraction &&
                              !journey.evidence.contract_id && (
                                <Button
                                  secondary
                                  onClick={() => setReview(journey.extraction)}
                                >
                                  Review source facts
                                </Button>
                              )}
                            {journey.findings.length > 0 &&
                              journey.state === "AWAITING_REVIEW" && (
                                <Button
                                  secondary
                                  onClick={() => setDecision(true)}
                                >
                                  Record policy exception
                                </Button>
                              )}
                          </>
                        )}
                    </div>
                    <div className="journey-evidence">
                      <h3>Verified evidence</h3>
                      <dl>
                        <dt>Employee record</dt>
                        <dd>{journey.evidence.employee_id || "Not created"}</dd>
                        <dt>Contract record</dt>
                        <dd>{journey.evidence.contract_id || "Not created"}</dd>
                        <dt>Internal tasks created</dt>
                        <dd>{journey.evidence.tasks_created}</dd>
                        <dt>Human tasks remaining</dt>
                        <dd>{journey.evidence.human_tasks_pending}</dd>
                        <dt>IT requests</dt>
                        <dd>
                          {journey.evidence.it_requests_simulated} simulated ·
                          no accounts provisioned
                        </dd>
                        <dt>Welcome email</dt>
                        <dd>
                          {journey.evidence.smtp_accepted
                            ? "SMTP accepted · inbox unverified"
                            : journey.evidence.email_jobs[0]?.state ||
                              "Not sent"}
                        </dd>
                        <dt>Automation setup</dt>
                        <dd>
                          {journey.automation_setup_verified
                            ? "Verified"
                            : "Not yet verified"}
                        </dd>
                      </dl>
                      <p>
                        Automation setup does not mean the employee is ready.
                        Human checks and real IT provisioning remain separate.
                      </p>
                      <small>Source fingerprint: {journey.source_sha256}</small>
                    </div>
                    {journey.state === "VERIFIED" && (
                      <div className="journey-measurement">
                        <h3>Measure the same scenario</h3>
                        <p>{journey.measurement_scope}</p>
                        {journey.measurement ? (
                          <>
                            <strong>
                              {journey.time_difference_seconds}s difference
                            </strong>
                            <p>
                              Manual: {journey.measurement.manual_seconds}s /{" "}
                              {journey.measurement.manual_interventions}{" "}
                              actions. Automation:{" "}
                              {(journey.elapsed_ms / 1000).toFixed(1)}s /{" "}
                              {journey.human_interventions} review or resume
                              actions.
                            </p>
                            <small>{journey.measurement.notes}</small>
                          </>
                        ) : (
                          <p>
                            No manual baseline recorded. No time savings
                            claimed.
                          </p>
                        )}
                        <Button
                          secondary
                          onClick={() => {
                            setBaselineStarted(null);
                            setStopwatchSeconds(null);
                            setMeasurement(true);
                          }}
                        >
                          Record measured manual baseline
                        </Button>
                      </div>
                    )}
                  </>
                )
              )}
            </section>
          </div>
        </>
      )}
      {tab === "Exceptions" && (
        <section className="panel">
          <SectionTitle
            title="Exception inbox"
            subtitle="Resolve each blocker while independent journeys continue. Failed or uncertain email is never treated as delivered."
          />
          {exceptions.error ? (
            <Failure error={exceptions.error} />
          ) : exceptions.isPending ? (
            <Loading />
          ) : (
            <div className="exception-list">
              {!waiting && <Empty title="No exceptions need your attention" />}
              {exceptions.data.journeys.map((j: any) => (
                <article key={j.id}>
                  <AlertCircle size={20} />
                  <div>
                    <strong>
                      {j.extraction?.fields.employee_name || j.filename}
                    </strong>
                    <p>{j.error}</p>
                  </div>
                  <Button secondary onClick={() => openJourney(j.id)}>
                    Resolve journey
                  </Button>
                </article>
              ))}
              {exceptions.data.onboarding.map((w: any) => (
                <article key={w.id}>
                  <div>
                    <strong>Onboarding needs review</strong>
                    <p>{w.error}</p>
                  </div>
                  <Link className="text-button" to="/onboarding">
                    Open onboarding
                  </Link>
                </article>
              ))}
              {exceptions.data.email.map((j: any) => (
                <article key={j.id}>
                  <MailState state={j.state} />
                  <div>
                    <strong>{j.recipient}</strong>
                    <p>{j.subject}</p>
                  </div>
                  <Link className="text-button" to="/communications">
                    Review email
                  </Link>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
      {tab === "Tasks" && (
        <section className="panel">
          <SectionTitle
            title="Internal HR task board"
            subtitle="These tasks are persisted in HUMAIN. Completing a human task records your attestation; simulated IT requests cannot be completed as real accounts."
          />
          {tasks.error ? (
            <Failure error={tasks.error} />
          ) : tasks.isPending ? (
            <Loading />
          ) : !tasks.data.items.length ? (
            <Empty title="Tasks appear when onboarding is prepared" />
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Task</th>
                    <th>Due</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.data.items.map((t: any) => (
                    <tr key={t.id}>
                      <td>
                        <strong>{t.title}</strong>
                        <small className="task-reference">
                          Employee {t.employee_id}
                        </small>
                      </td>
                      <td>{t.due_date || "Unscheduled"}</td>
                      <td>
                        {t.simulated ? (
                          <Badge>Simulated request</Badge>
                        ) : (
                          <Status value={t.status} />
                        )}
                      </td>
                      <td>
                        {!t.simulated && t.status !== "completed" && (
                          <Button
                            secondary
                            busy={busy}
                            onClick={() =>
                              void act(() =>
                                post("/tasks/" + t.id + "/complete"),
                              )
                            }
                          >
                            Mark completed
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {(tasks.data?.total || 0) > 100 && (
            <p className="journey-footnote">
              Showing {taskOffset + 1} to{" "}
              {Math.min(taskOffset + 100, tasks.data.total)} of{" "}
              {tasks.data.total} tasks.
              <Button
                secondary
                disabled={taskOffset === 0}
                onClick={() => setTaskOffset((v) => Math.max(0, v - 100))}
              >
                Previous tasks
              </Button>
              <Button
                secondary
                disabled={taskOffset + 100 >= tasks.data.total}
                onClick={() => setTaskOffset((v) => v + 100)}
              >
                Next tasks
              </Button>
            </p>
          )}
        </section>
      )}
      {tab === "Company policies" &&
        (policies.isPending ? (
          <Loading />
        ) : policies.error ? (
          <Failure error={policies.error} retry={policies.refetch} />
        ) : (
          <PolicyBuilder
            policies={policies.data?.items || []}
            act={act}
            busy={busy}
          />
        ))}
      <Modal
        open={!!review}
        onClose={() => setReview(null)}
        title="Review contract facts"
        description="Compare the original contract, correct missing facts and confirm the extracted values. Saving resumes this journey automatically."
      >
        {review && (
          <form
            className="form-grid"
            onSubmit={async (e) => {
              e.preventDefault();
              const entries = Object.fromEntries(new FormData(e.currentTarget));
              const values = {
                ...review.fields,
                ...Object.fromEntries(
                  Object.entries(entries).map(([k, v]) => [
                    k,
                    v === "" ? null : v,
                  ]),
                ),
              };
              const ok = await act(async () => {
                const saved = await api("/journeys/" + selected + "/review", {
                  method: "PUT",
                  body: JSON.stringify(values),
                });
                if (saved.review.valid) {
                  setReview(null);
                } else setReview(saved.review);
              });
              void ok;
            }}
          >
            {error && (
              <p className="review-issue full" role="alert">
                {error}
              </p>
            )}
            {review.issues.map((issue: any, i: number) => (
              <p className="review-issue full" key={i}>
                {label(issue.field)}: {issue.message}
              </p>
            ))}
            {Object.entries(review.fields)
              .filter(([k]) => !["warnings", "synthetic"].includes(k))
              .map(([key, value]) => (
                <label key={key}>
                  {label(key)}
                  <input
                    name={key}
                    defaultValue={String(value ?? "")}
                    type={
                      key.includes("date") || key.includes("expiry")
                        ? "date"
                        : key.includes("salary") ||
                            key === "allowances" ||
                            key === "probation_days"
                          ? "number"
                          : "text"
                    }
                    step="any"
                  />
                </label>
              ))}
            <div className="full">
              <Button type="submit" busy={busy}>
                Save facts and resume
              </Button>
            </div>
          </form>
        )}
      </Modal>
      <Modal
        open={decision}
        onClose={() => setDecision(false)}
        title="Record a company policy exception"
        description="This authorizes an exception to the displayed company rules only. Missing facts still block onboarding. Contract terms and official approvals are unchanged."
      >
        {error && (
          <p className="review-issue" role="alert">
            {error}
          </p>
        )}
        <form
          className="form-grid"
          onSubmit={async (e) => {
            e.preventDefault();
            const note = new FormData(e.currentTarget).get("note");
            const value = await act(() =>
              post("/journeys/" + selected + "/exception", { note }),
            );
            if (value) setDecision(false);
          }}
        >
          <label className="full">
            Reason and authority
            <textarea name="note" required minLength={10} maxLength={2000} />
          </label>
          <Button type="submit" busy={busy}>
            Record exception and resume
          </Button>
        </form>
      </Modal>
      <Modal
        open={measurement}
        onClose={() => setMeasurement(false)}
        title="Record a measured manual baseline"
        description="Perform the same preparation tasks manually using this contract. Record actual time and actions; do not estimate results."
      >
        <div className="journey-actions">
          <Button
            secondary
            disabled={baselineStarted !== null}
            onClick={() => {
              setBaselineStarted(Date.now());
              setStopwatchSeconds(null);
            }}
          >
            Start manual stopwatch
          </Button>
          <Button
            secondary
            disabled={baselineStarted === null}
            onClick={() => {
              setStopwatchSeconds(
                Math.max(1, Math.round((Date.now() - baselineStarted!) / 1000)),
              );
              setBaselineStarted(null);
            }}
          >
            Stop stopwatch
          </Button>
          {stopwatchSeconds !== null && (
            <span>{stopwatchSeconds}s recorded</span>
          )}
        </div>
        <form
          className="form-grid"
          onSubmit={async (e) => {
            e.preventDefault();
            const data = Object.fromEntries(new FormData(e.currentTarget));
            const value = await act(() =>
              api("/journeys/" + selected + "/measurement", {
                method: "PUT",
                body: JSON.stringify({
                  ...data,
                  manual_seconds: Number(data.manual_seconds),
                  manual_interventions: Number(data.manual_interventions),
                }),
              }),
            );
            if (value) setMeasurement(false);
          }}
        >
          <label>
            Manual duration (seconds)
            <input
              key={stopwatchSeconds}
              name="manual_seconds"
              type="number"
              min={1}
              max={604800}
              defaultValue={
                stopwatchSeconds || journey?.measurement?.manual_seconds || ""
              }
              required
            />
          </label>
          <label>
            Manual actions / interventions
            <input
              name="manual_interventions"
              type="number"
              min={0}
              max={10000}
              required
              defaultValue={journey?.measurement?.manual_interventions ?? ""}
            />
          </label>
          <label className="full">
            What you timed and observed
            <textarea
              name="notes"
              minLength={10}
              maxLength={2000}
              required
              defaultValue={journey?.measurement?.notes || ""}
            />
          </label>
          <Button type="submit" busy={busy}>
            Save measured comparison
          </Button>
        </form>
      </Modal>
    </div>
  );
}
function MailState({ state }: { state: string }) {
  return <Status value={state} />;
}
function PolicyBuilder({
  policies,
  act,
  busy,
}: {
  policies: any[];
  act: (fn: () => Promise<any>) => Promise<any>;
  busy: boolean;
}) {
  const [title, setTitle] = useState("");
  const [source, setSource] = useState("");
  const [rules, setRules] = useState([blankRule()]);
  return (
    <div className="journey-columns">
      <section className="panel policy-builder">
        <SectionTitle
          title="Build a company policy"
          subtitle="Paste or upload approved policy text, then define checks tied to exact source passages. Save a draft first; activate it explicitly when authorized."
        />
        <Button
          secondary
          onClick={() => {
            setTitle("Demonstration onboarding policy");
            setSource(sampleSource);
            setRules([
              {
                field: "work_location",
                operator: "required",
                value: "",
                quote: "Every contract must specify a work location.",
              },
              {
                field: "probation_days",
                operator: "maximum",
                value: "90",
                quote: "The probation period must be no more than 90 days.",
              },
            ]);
          }}
        >
          Load fictional sample
        </Button>
        <form
          className="journey-form"
          onSubmit={async (e) => {
            e.preventDefault();
            const saved = await act(() =>
              post("/policies", { title, source, rules }),
            );
            if (saved) {
              setTitle("");
              setSource("");
              setRules([blankRule()]);
              toast.success("Draft saved. Activate it when authorized.");
            }
          }}
        >
          <label className="full">
            Policy title
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              minLength={3}
              maxLength={160}
              required
            />
          </label>
          <label className="full">
            Import policy text (.txt)
            <input
              type="file"
              accept=".txt"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file && file.size <= 120000)
                  setSource((await file.text()).slice(0, 30000));
                else if (file) toast.error("Policy text must be under 120 KB");
              }}
            />
          </label>
          <label className="full">
            Policy source text
            <textarea
              value={source}
              onChange={(e) => setSource(e.target.value)}
              minLength={10}
              maxLength={30000}
              required
              rows={6}
            />
          </label>
          {rules.map((r, i) => (
            <fieldset className="policy-rule full" key={i}>
              <legend>Rule {i + 1}</legend>
              <div className="journey-form">
                <label>
                  Contract field
                  <select
                    value={r.field}
                    onChange={(e) =>
                      setRules((v) =>
                        v.map((x, n) =>
                          n === i ? { ...x, field: e.target.value } : x,
                        ),
                      )
                    }
                  >
                    {fields.map((f) => (
                      <option key={f} value={f}>
                        {label(f)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Check
                  <select
                    value={r.operator}
                    onChange={(e) =>
                      setRules((v) =>
                        v.map((x, n) =>
                          n === i ? { ...x, operator: e.target.value } : x,
                        ),
                      )
                    }
                  >
                    <option value="required">Must be present</option>
                    <option value="maximum">At most</option>
                    <option value="minimum">At least</option>
                    <option value="equals">Must equal</option>
                  </select>
                </label>
                {r.operator !== "required" && (
                  <label>
                    Expected value
                    <input
                      value={r.value}
                      onChange={(e) =>
                        setRules((v) =>
                          v.map((x, n) =>
                            n === i ? { ...x, value: e.target.value } : x,
                          ),
                        )
                      }
                      required
                    />
                  </label>
                )}
                <label className="full">
                  Exact supporting passage
                  <textarea
                    value={r.quote}
                    onChange={(e) =>
                      setRules((v) =>
                        v.map((x, n) =>
                          n === i ? { ...x, quote: e.target.value } : x,
                        ),
                      )
                    }
                    minLength={5}
                    maxLength={1000}
                    required
                  />
                </label>
              </div>
              {rules.length > 1 && (
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setRules((v) => v.filter((_, n) => n !== i))}
                >
                  Remove rule
                </button>
              )}
            </fieldset>
          ))}
          <Button
            secondary
            disabled={rules.length >= 30}
            onClick={() => setRules((v) => [...v, blankRule()])}
          >
            Add rule
          </Button>
          <Button type="submit" busy={busy}>
            Save policy draft
          </Button>
        </form>
      </section>
      <section className="panel">
        <SectionTitle
          title="Versioned company policies"
          subtitle="Saved versions are immutable. Create a new draft when your policy changes. These checks do not determine legal compliance."
        />
        {policies.length ? (
          <div className="policy-list">
            {policies.map((p) => (
              <article key={p.id}>
                <div className="policy-heading">
                  <h3>{p.title}</h3>
                  <Badge tone={p.active ? "green" : "neutral"}>
                    {p.active ? "Active" : "Draft / inactive"}
                  </Badge>
                </div>
                <small>
                  {new Date(p.created_at).toLocaleString()} · {p.rules.length}{" "}
                  rules
                </small>
                <details>
                  <summary>Read source and checks</summary>
                  <p className="policy-source">{p.source}</p>
                  {p.rules.map((r: any, i: number) => (
                    <div key={i}>
                      {label(r.field)} · {r.operator} {r.value}
                      <blockquote>{r.quote}</blockquote>
                    </div>
                  ))}
                </details>
                <Button
                  secondary
                  busy={busy}
                  onClick={() =>
                    void act(() =>
                      post("/policies/" + p.id + "/activate", {
                        active: !p.active,
                      }),
                    )
                  }
                >
                  {p.active
                    ? "Deactivate for new journeys"
                    : "Authorize and activate policy"}
                </Button>
              </article>
            ))}
          </div>
        ) : (
          <Empty title="No company policies yet">
            Use the builder to save your first draft.
          </Empty>
        )}
      </section>
    </div>
  );
}
