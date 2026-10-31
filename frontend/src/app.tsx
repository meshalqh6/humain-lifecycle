import { useState, type FormEvent } from "react";
import {
  Navigate,
  NavLink,
  Routes,
  Route,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Users,
  ListTodo,
  FileText,
  ShieldCheck,
  Mail,
  ChartNoAxesCombined,
  ScanLine,
  Sparkles,
  Settings2,
  Unplug,
  Search,
  Bell,
  Plus,
  ArrowUpRight,
  ArrowRight,
  Menu,
  X,
  LogOut,
  CircleHelp,
  Check,
  Activity,
  Leaf,
  Upload,
  RefreshCw,
  Download,
  CheckCircle2,
  Trash2,
  Archive,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { toast } from "sonner";
import { api, post } from "./services/api";
import {
  Avatar,
  Badge,
  Button,
  Empty,
  Failure,
  Loading,
  Metric,
  Modal,
  SectionTitle,
} from "./components/ui";
import Wasl from "./pages/wasl";
import Journeys from "./pages/journeys";
import { HumainLogo, LifecycleWordmark } from "./components/humain-logo";
import { EmailSettings } from "./components/email-settings";
import { RosterImport } from "./components/roster-import";
import { EmployeeSaudization } from "./components/employee-saudization";

const nav = [
  ["/", "Overview", LayoutDashboard],
  ["/journeys", "Journey workspace", Sparkles],
  ["/employees", "Employees", Users],
  ["/onboarding", "Onboarding", ListTodo],
  ["/contracts", "Contracts", FileText],
  ["/compliance", "Compliance", ShieldCheck],
  ["/communications", "Communications", Mail],
  ["/analytics", "Workforce Analytics", ChartNoAxesCombined],
  ["/audit", "Audit Trail", ScanLine],
] as const;
const titles: Record<string, string> = {
  "/": "Overview",
  "/journeys": "Journey workspace",
  "/employees": "Employees",
  "/onboarding": "Onboarding",
  "/contracts": "Contracts",
  "/compliance": "Compliance",
  "/communications": "Communications",
  "/analytics": "Workforce Analytics",
  "/audit": "Audit Trail",
  "/chat": "HUMAIN Chat",
  "/settings": "Settings",
  "/integrations": "Integrations",
};
export function useData<T = any>(path: string, enabled = true) {
  return useQuery<T, Error>({
    queryKey: [path],
    queryFn: () => api<T>(path),
    enabled,
  });
}
function useAction() {
  const client = useQueryClient();
  return async (fn: () => Promise<any>, message: string) => {
    try {
      const result = await fn();
      await client.invalidateQueries();
      toast.success(message);
      return result;
    } catch (e) {
      toast.error((e as Error).message);
      return null;
    }
  };
}
function stateBadge(value: string) {
  return (
    <Badge
      tone={
        ["COMPLETED", "active", "SMTP_ACCEPTED", "completed"].includes(value)
          ? "green"
          : ["FAILED", "UNKNOWN", "error", "expired"].includes(value)
            ? "red"
            : ["AWAITING_REVIEW", "pending"].includes(value)
              ? "amber"
              : "neutral"
      }
    >
      {value.replaceAll("_", " ").toLowerCase()}
    </Badge>
  );
}
function QueryView({
  query,
  children,
}: {
  query: any;
  children: (data: any) => React.ReactNode;
}) {
  return query.isPending ? (
    <Loading />
  ) : query.error ? (
    <Failure error={query.error} retry={query.refetch} />
  ) : (
    children(query.data)
  );
}

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const client = useQueryClient();
  const session = useQuery({
    queryKey: ["session"],
    queryFn: () => api("/auth/me"),
    retry: false,
  });
  const [mobile, setMobile] = useState(false);
  const [search, setSearch] = useState("");
  const [help, setHelp] = useState(false);
  if (session.isPending)
    return (
      <div className="login-screen">
        <Loading />
      </div>
    );
  if (!session.data)
    return (
      <Login
        onLogin={() => client.invalidateQueries({ queryKey: ["session"] })}
      />
    );
  return (
    <div className="app-shell">
      <aside className={"sidebar " + (mobile ? "open" : "")}>
        <div className="brand">
          <div className="brand-lockup">
            <HumainLogo light />
            <LifecycleWordmark />
          </div>
          <button
            className="mobile-close icon-btn"
            onClick={() => setMobile(false)}
            aria-label="Close navigation"
          >
            <X />
          </button>
        </div>
        <NavLink
          to="/settings"
          className="workspace-switch workspace-card"
          aria-label="Workspace settings"
          title="Workspace settings"
          onClick={() => setMobile(false)}
        >
          <span className="workspace-icon workspace-logo" aria-hidden="true">
            <HumainLogo light />
          </span>
          <div className="workspace-copy">
            <strong>Workspace</strong>
            <small>People operations</small>
          </div>
          <ArrowUpRight
            size={13}
            className="workspace-settings-arrow"
            aria-hidden="true"
          />
        </NavLink>
        <p className="nav-label">WORKSPACE</p>
        <nav aria-label="Workspace">
          {nav.map(([href, label, Icon]) => (
            <NavLink
              end={href === "/"}
              to={href}
              key={href}
              onClick={() => setMobile(false)}
            >
              <Icon size={18} />
              {label}
              {href === "/onboarding" && <span className="nav-dot" />}
            </NavLink>
          ))}
        </nav>
        <p className="nav-label assistant-label">AI ASSISTANT</p>
        <NavLink
          className="wasl-nav"
          to="/chat"
          onClick={() => setMobile(false)}
        >
          <Sparkles size={18} />
          HUMAIN Chat
        </NavLink>
        <p className="nav-label">ADMINISTRATION</p>
        <nav aria-label="Administration">
          <NavLink to="/settings" onClick={() => setMobile(false)}>
            <Settings2 size={18} />
            Settings
          </NavLink>
          <NavLink to="/integrations" onClick={() => setMobile(false)}>
            <Unplug size={18} />
            Integrations
          </NavLink>
        </nav>
        <div className="sidebar-bottom">
          <button className="profile" onClick={() => setHelp(true)}>
            <span className="user-avatar">HR</span>
            <span>
              Workspace Admin<small>HR Operations</small>
            </span>
            <CircleHelp size={16} />
          </button>
        </div>
      </aside>
      {mobile && (
        <button
          className="mobile-scrim"
          onClick={() => setMobile(false)}
          aria-label="Dismiss navigation"
        />
      )}
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              className="icon-btn mobile-menu"
              onClick={() => setMobile(true)}
              aria-label="Open navigation"
            >
              <Menu />
            </button>
            <span>Workspace</span>
            <span className="slash">/</span>
            <strong>{titles[location.pathname] || "Workspace"}</strong>
          </div>
          <div className="topbar-right">
            <form
              className="global-search"
              onSubmit={(e) => {
                e.preventDefault();
                navigate("/employees?q=" + encodeURIComponent(search));
              }}
            >
              <Search size={16} />
              <input
                aria-label="Search workspace"
                placeholder="Search employees…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <kbd>↵</kbd>
            </form>
            <span className="sandbox-tag">
              <span />
              SANDBOX
            </span>
            <button
              className="icon-btn"
              aria-label="View deadline alerts"
              onClick={() => navigate("/compliance")}
            >
              <Bell size={19} />
            </button>
            <span className="top-avatar">HR</span>
          </div>
        </header>
        <main
          className={
            location.pathname === "/chat" ? "content chat-content" : "content"
          }
        >
          <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/journeys" element={<Journeys />} />
            <Route path="/employees" element={<Employees />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/contracts" element={<Contracts />} />
            <Route path="/compliance" element={<Compliance />} />
            <Route path="/communications" element={<Communications />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/audit" element={<Audit />} />
            <Route path="/chat" element={<Wasl />} />
            <Route
              path="/wasl"
              element={<Navigate to={"/chat" + location.search} replace />}
            />
            <Route path="/settings" element={<Settings />} />
            <Route path="/integrations" element={<Settings integrations />} />
            <Route
              path="*"
              element={
                <Empty title="Page not found">
                  <NavLink to="/">Return to overview</NavLink>
                </Empty>
              }
            />
          </Routes>
        </main>
      </div>
      <Modal
        open={help}
        onClose={() => setHelp(false)}
        title="Your local workspace"
        description="HUMAIN Lifecycle · Hackathon development environment"
      >
        <p>
          This workspace uses synthetic employee records, PostgreSQL 17, local
          Qwen and sandbox SMTP. IT provisioning creates simulated requests. No
          official HUMAIN affiliation.
        </p>
        <div className="modal-actions">
          <Button
            secondary
            onClick={() => {
              setHelp(false);
              navigate("/settings");
            }}
          >
            Workspace settings
          </Button>
          <Button
            onClick={async () => {
              await post("/auth/logout");
              client.clear();
              window.location.reload();
            }}
          >
            <LogOut size={16} />
            Sign out
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function Login({ onLogin }: { onLogin: () => void }) {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await post("/auth/login", { username, password });
      onLogin();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login-screen">
      <div className="login-art">
        <span className="eyebrow">HUMAIN LIFECYCLE</span>
        <h1>
          People, connected.
          <br />
          <em>Possibilities, unlocked.</em>
        </h1>
        <p>Your people operations. One intelligent workspace.</p>
        <div className="orb login-orb" />
        <span className="login-footer">POWERED BY HUMAIN Chat</span>
      </div>
      <form className="login-card" onSubmit={submit}>
        <div className="login-brand">
          <HumainLogo className="login-logo" />
          <LifecycleWordmark />
        </div>
        <Badge tone="green">LOCAL WORKSPACE</Badge>
        <h2>Welcome back.</h2>
        <p>Sign in to your HR operations workspace.</p>
        <label>
          Username
          <input
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" busy={busy}>
          Enter workspace
          <ArrowRight size={17} />
        </Button>
      </form>
    </div>
  );
}

function PageHead({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="head-actions">{children}</div>
    </div>
  );
}
function Overview() {
  const query = useData("/dashboard");
  const navigate = useNavigate();
  return (
    <>
      <PageHead
        eyebrow="YOUR PEOPLE. YOUR POSSIBILITIES."
        title="A clearer view. A smarter day."
        description="Everything your people need to move forward, connected in one place."
      >
        <Button secondary onClick={() => navigate("/analytics")}>
          <ChartNoAxesCombined size={16} />
          View analytics
        </Button>
        <Button onClick={() => navigate("/contracts")}>
          <Plus size={17} />
          New onboarding
        </Button>
      </PageHead>
      <QueryView query={query}>
        {(d) => (
          <>
            <div className="metrics">
              <Metric
                label="Total employees"
                value={d.headcount}
                icon={<Users size={18} />}
              />
              <Metric
                label="Active onboarding"
                value={d.onboarding}
                icon={<ListTodo size={18} />}
              />
              <Metric
                label="Upcoming deadlines"
                value={d.alerts.length}
                icon={<ShieldCheck size={18} />}
              />
              <Metric
                label="Saudization ratio"
                value={
                  <>
                    {d.saudization.overall?.rate || 0}
                    <small>%</small>
                  </>
                }
                icon={<Leaf size={18} />}
              />
            </div>
            <section className="wasl-banner">
              <div className="banner-copy">
                <Badge tone="lime">
                  <Sparkles size={12} />
                  MEET YOUR AI OPERATIONS PARTNER
                </Badge>
                <h2>
                  Less admin.
                  <br />
                  More human.
                </h2>
                <p>
                  From the first contract to the next milestone.
                  <br />
                  Let HUMAIN Chat connect the dots.
                </p>
                <Button onClick={() => navigate("/chat")}>
                  Start a conversation
                  <ArrowUpRight size={17} />
                </Button>
              </div>
              <div className="banner-art" aria-hidden="true">
                <div className="orbit orbit-one" />
                <div className="orbit orbit-two" />
                <div className="orb" />
                <span className="art-callout callout-one">
                  <CheckCircle2 size={16} />
                  Policy checked
                </span>
                <span className="art-callout callout-two">
                  <ScanLine size={16} />
                  Every action, traceable
                </span>
                <HumainLogo light className="hero-logo" />
                <span className="art-index">INTELLIGENCE THAT CONNECTS.</span>
              </div>
            </section>
            <div className="overview-grid">
              <section className="panel deadlines-panel">
                <SectionTitle
                  title="On your radar"
                  subtitle="A little attention today. A smoother tomorrow."
                  action={
                    <button
                      className="text-button"
                      onClick={() => navigate("/compliance?days=90")}
                    >
                      All deadlines
                      <ArrowUpRight size={14} />
                    </button>
                  }
                />
                <DeadlineTable alerts={d.alerts.slice(0, 5)} />
              </section>
              <section className="panel activity-panel">
                <SectionTitle
                  title="Workspace activity"
                  subtitle="A transparent view of every action."
                  action={<Activity size={18} />}
                />
                {d.recent_actions.length ? (
                  d.recent_actions.slice(0, 4).map((a: any) => (
                    <div className="activity-row" key={a.id}>
                      <span className="activity-dot">
                        <Check size={13} />
                      </span>
                      <div>
                        <strong>
                          {a.action.replaceAll(".", " ").replaceAll("_", " ")}
                        </strong>
                        <small>{new Date(a.created_at).toLocaleString()}</small>
                      </div>
                    </div>
                  ))
                ) : (
                  <Empty title="Your story starts here" />
                )}
                <button
                  className="text-button activity-link"
                  onClick={() => navigate("/audit")}
                >
                  Explore audit trail
                  <ArrowRight size={15} />
                </button>
              </section>
            </div>
            <div className="workspace-footer">
              <span>Built around your people. Powered by HUMAIN Chat.</span>
            </div>
          </>
        )}
      </QueryView>
    </>
  );
}

function DeadlineTable({ alerts }: { alerts: any[] }) {
  const navigate = useNavigate();
  return alerts.length ? (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>EMPLOYEE</th>
            <th>DOCUMENT</th>
            <th>DUE DATE</th>
            <th>STATUS</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {alerts.map((a: any) => (
            <tr key={a.employee_id + a.kind + a.due_date}>
              <td>
                <div className="person">
                  <Avatar name={a.name} />
                  <div>
                    <strong>{a.name}</strong>
                    <small>Synthetic enterprise</small>
                  </div>
                </div>
              </td>
              <td className="capitalize">{a.kind.replace("_", " ")}</td>
              <td>{a.due_date}</td>
              <td>
                <Badge
                  tone={
                    a.expired ? "red" : a.days_left < 15 ? "amber" : "neutral"
                  }
                >
                  {a.expired ? "Expired" : `${a.days_left} days left`}
                </Badge>
              </td>
              <td>
                <button
                  className="icon-btn"
                  aria-label={"View " + a.name}
                  onClick={() =>
                    navigate("/employees?q=" + encodeURIComponent(a.name))
                  }
                >
                  <ArrowUpRight size={17} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <Empty title="All clear for now">
      No documents fall within this deadline window.
    </Empty>
  );
}

function Employees() {
  const location = useLocation();
  const [search, setSearch] = useState(
    new URLSearchParams(location.search).get("q") || "",
  );
  const [page, setPage] = useState(0);
  const [employeeView, setEmployeeView] = useState<"directory" | "saudization">(
    "directory",
  );
  const [professionFilter, setProfessionFilter] = useState<string | null>(null);
  const [add, setAdd] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const action = useAction();
  const query = useData(
    "/employees?q=" +
      encodeURIComponent(search) +
      "&offset=" +
      page * 25 +
      (professionFilter !== null
        ? "&profession=" +
          encodeURIComponent(professionFilter) +
          "&workforce_only=true"
        : ""),
  );
  const deps = useData("/departments");
  const [busy, setBusy] = useState(false);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget));
    setBusy(true);
    const result = await action(
      () =>
        post("/employees", {
          ...data,
          department_id: data.department_id || null,
          email: data.email || null,
          synthetic: true,
        }),
      "Employee profile created",
    );
    setBusy(false);
    if (result) setAdd(false);
  }
  return (
    <>
      <PageHead
        eyebrow="PEOPLE DIRECTORY"
        title="Great people. One connected team."
        description="Find your people, explore their profiles and keep the details together."
      >
        <RosterImport />
        <Button onClick={() => setAdd(true)}>
          <Plus size={16} />
          Add employee
        </Button>
      </PageHead>
      <div className="journey-tabs" role="tablist" aria-label="Employee views">
        <button
          role="tab"
          aria-selected={employeeView === "directory"}
          onClick={() => setEmployeeView("directory")}
        >
          Employee directory
        </button>
        <button
          role="tab"
          aria-selected={employeeView === "saudization"}
          onClick={() => setEmployeeView("saudization")}
        >
          Saudization
        </button>
      </div>
      {employeeView === "saudization" ? (
        <EmployeeSaudization
          onViewProfession={(profession) => {
            setProfessionFilter(profession);
            setSearch("");
            setPage(0);
            setEmployeeView("directory");
          }}
        />
      ) : (
        <>
          {professionFilter !== null && (
            <div className="employee-profession-filter">
              <span>
                Profession: <strong>{professionFilter}</strong> · Active and
                onboarding employees
              </span>
              <button
                className="text-button"
                onClick={() => {
                  setProfessionFilter(null);
                  setPage(0);
                }}
              >
                Clear profession filter <X size={14} />
              </button>
            </div>
          )}
          <section className="panel">
            <div className="toolbar">
              <label className="search-field">
                <Search size={17} />
                <input
                  aria-label="Search employees"
                  placeholder="Search name, employee ID or profession…"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(0);
                  }}
                />
              </label>
              <Badge>{query.data?.total || 0} employees</Badge>
            </div>
            <QueryView query={query}>
              {(d) =>
                d.items.length ? (
                  <>
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>NAME</th>
                            <th>EMPLOYEE ID</th>
                            <th>DEPARTMENT</th>
                            <th>PROFESSION</th>
                            <th>STATUS</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {d.items.map((e: any) => (
                            <tr key={e.id}>
                              <td>
                                <div className="person">
                                  <Avatar name={e.name} />
                                  <div>
                                    <strong>{e.name}</strong>
                                    <small>{e.nationality}</small>
                                  </div>
                                </div>
                              </td>
                              <td className="mono">{e.employee_number}</td>
                              <td>
                                {deps.data?.items.find(
                                  (x: any) => x.id === e.department_id,
                                )?.name || "Unassigned"}
                              </td>
                              <td>{e.profession}</td>
                              <td>{stateBadge(e.status)}</td>
                              <td>
                                <button
                                  className="icon-btn"
                                  aria-label={"Open " + e.name}
                                  onClick={async () =>
                                    setProfile(await api("/employees/" + e.id))
                                  }
                                >
                                  <ArrowUpRight size={17} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <Pagination page={page} setPage={setPage} total={d.total} />
                  </>
                ) : (
                  <Empty title="No matching employees">
                    Try another name or add your first synthetic employee.
                  </Empty>
                )
              }
            </QueryView>
          </section>
        </>
      )}
      <Modal
        open={add}
        onClose={() => setAdd(false)}
        title="Add an employee"
        description="Development workspace · use synthetic data only."
      >
        <form onSubmit={save} className="form-grid">
          <label>
            Full name
            <input name="name" required minLength={2} />
          </label>
          <label>
            Employee number
            <input name="employee_number" required />
          </label>
          <label>
            Nationality
            <input name="nationality" required />
          </label>
          <label>
            Profession
            <input name="profession" defaultValue="Unspecified" />
          </label>
          <label>
            Email
            <input
              name="email"
              type="email"
              placeholder="welcome@humain.test"
            />
          </label>
          <label>
            Department
            <select name="department_id">
              <option value="">Unassigned</option>
              {deps.data?.items.map((d: any) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <div className="full modal-actions">
            <Button secondary onClick={() => setAdd(false)}>
              Cancel
            </Button>
            <Button type="submit" busy={busy}>
              Create profile
            </Button>
          </div>
        </form>
      </Modal>
      <Modal
        open={!!profile}
        onClose={() => {
          if (deleting) return;
          setProfile(null);
          setConfirmDelete(false);
        }}
        title={confirmDelete ? "Delete employee?" : profile?.name || "Employee"}
        description={
          confirmDelete
            ? "Confirm removal from the active employee directory."
            : "Employee profile · authoritative PostgreSQL record"
        }
      >
        {profile && confirmDelete ? (
          <>
            <p>
              Delete <strong>{profile.name}</strong> ({profile.employee_number})
              from the active directory? This archives the employee. Their
              contracts, tasks and audit history are preserved.
            </p>
            <div className="modal-actions">
              <Button
                secondary
                disabled={deleting}
                onClick={() => setConfirmDelete(false)}
              >
                Cancel
              </Button>
              <button
                type="button"
                className="button danger"
                disabled={deleting}
                onClick={async () => {
                  if (deleting) return;
                  setDeleting(true);
                  const result = await action(
                    () => api("/employees/" + profile.id, { method: "DELETE" }),
                    "Employee removed from active directory; history preserved",
                  );
                  setDeleting(false);
                  if (result) {
                    setConfirmDelete(false);
                    setProfile(null);
                    setPage(0);
                  }
                }}
              >
                <Trash2 size={16} />
                {deleting ? "Deleting…" : "Confirm delete"}
              </button>
            </div>
          </>
        ) : (
          profile && (
            <>
              <div className="profile-detail">
                <Avatar name={profile.name} />
                <div>
                  <h3>{profile.profession}</h3>
                  <p>
                    {profile.employee_number} · {profile.nationality}
                  </p>
                </div>
                {stateBadge(profile.status)}
              </div>
              <dl className="details">
                <dt>Email</dt>
                <dd>{profile.email || "Not provided"}</dd>
                <dt>Iqama expiry</dt>
                <dd>{profile.iqama_expiry || "Not provided"}</dd>
                <dt>Work permit expiry</dt>
                <dd>{profile.work_permit_expiry || "Not provided"}</dd>
              </dl>
              <h3>Contracts</h3>
              {profile.contracts.map((c: any) => (
                <p key={c.id}>
                  {c.start_date} → {c.end_date} {stateBadge(c.status)}
                </p>
              ))}
              <h3>HR tasks</h3>
              {profile.tasks.map((t: any) => (
                <div className="task-line" key={t.id}>
                  <span>{t.title}</span>
                  {stateBadge(t.status)}
                  {t.status === "pending" && !t.simulated && (
                    <button
                      className="text-button"
                      onClick={async () => {
                        await action(
                          () => post("/tasks/" + t.id + "/complete"),
                          "Task completed",
                        );
                        setProfile(await api("/employees/" + profile.id));
                      }}
                    >
                      Complete
                    </button>
                  )}
                </div>
              ))}
              <div className="modal-actions">
                <button
                  type="button"
                  className="button danger"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 size={16} />
                  Delete employee
                </button>
              </div>
            </>
          )
        )}
      </Modal>
    </>
  );
}
function Pagination({
  page,
  setPage,
  total,
}: {
  page: number;
  setPage: (n: number) => void;
  total: number;
}) {
  return (
    <div className="pagination">
      <span>
        {total} records · Page {page + 1}
      </span>
      <div>
        <button disabled={page === 0} onClick={() => setPage(page - 1)}>
          Previous
        </button>
        <button
          disabled={(page + 1) * 25 >= total}
          onClick={() => setPage(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}

function Contracts() {
  const query = useData("/documents");
  const contracts = useData("/contracts?limit=100");
  const action = useAction();
  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState<any>(null);
  const navigate = useNavigate();
  async function upload(file: File) {
    setBusy(true);
    const form = new FormData();
    form.append("file", file);
    const doc = await action(
      () => api("/documents", { method: "POST", body: form }),
      "Document saved",
    );
    if (doc) {
      const result = await action(
        () => post("/documents/" + doc.id + "/extract"),
        "Extraction stored",
      );
      if (result) setReview(result);
    }
    setBusy(false);
  }
  return (
    <>
      <PageHead
        eyebrow="CONTRACT INTELLIGENCE"
        title="From paperwork to possibility."
        description="Upload an authorized Qiwa export. Extract the facts, review the details, start the journey."
      >
        <Badge tone="green">
          {contracts.data?.total || 0} persisted contracts
        </Badge>
      </PageHead>
      <label
        className={"upload-zone " + (busy ? "busy" : "")}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (!busy && e.dataTransfer.files[0])
            void upload(e.dataTransfer.files[0]);
        }}
      >
        <span className="upload-icon">
          <Upload size={24} />
        </span>
        <h3>
          {busy ? "Processing your document…" : "A new beginning starts here"}
        </h3>
        <p>
          Drop a contract here, or <strong>browse files</strong>
        </p>
        <small>PDF, XLSX or CSV · up to 8 MB · one contract per file</small>
        <input
          aria-label="Upload contract"
          type="file"
          accept=".pdf,.xlsx,.csv"
          disabled={busy}
          onChange={(e) => {
            if (e.target.files?.[0]) void upload(e.target.files[0]);
            e.target.value = "";
          }}
        />
      </label>
      <section className="panel">
        <SectionTitle
          title="Document library"
          subtitle="Original sources, extraction results and next steps."
        />
        <QueryView query={query}>
          {(d) =>
            d.items.length ? (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>DOCUMENT</th>
                      <th>RECEIVED</th>
                      <th>SOURCE REFERENCE</th>
                      <th>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.items.map((doc: any) => (
                      <tr key={doc.id}>
                        <td>
                          <div className="person">
                            <span className="file-icon">
                              <FileText size={19} />
                            </span>
                            <strong>{doc.filename}</strong>
                          </div>
                        </td>
                        <td>{new Date(doc.created_at).toLocaleDateString()}</td>
                        <td className="mono">{doc.sha256.slice(0, 14)}…</td>
                        <td>
                          <div className="inline-actions">
                            <button
                              className="text-button"
                              onClick={async () => {
                                const x = await action(
                                  () =>
                                    post("/documents/" + doc.id + "/extract"),
                                  "Extraction loaded",
                                );
                                if (x) setReview(x);
                              }}
                            >
                              Review
                              <ArrowUpRight size={14} />
                            </button>
                            <a
                              className="icon-btn"
                              aria-label={"Download " + doc.filename}
                              href={"/api/documents/" + doc.id + "/download"}
                            >
                              <Download size={16} />
                            </a>
                            <button
                              className="text-button"
                              onClick={() =>
                                navigate("/chat?document=" + doc.id)
                              }
                            >
                              Ask HUMAIN Chat
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty title="Ready for your first contract">
                Use the synthetic contract in the project’s demo folder to try
                the full workflow.
              </Empty>
            )
          }
        </QueryView>
      </section>
      <Modal
        open={!!review}
        onClose={() => setReview(null)}
        title="Review extracted information"
        description="Confirm source facts. Missing and uncertain values must be resolved before onboarding."
      >
        {review && (
          <>
            <div className="review-status">
              {stateBadge(review.valid ? "COMPLETED" : "AWAITING_REVIEW")}
              <span>Source: {review.method}</span>
            </div>
            {review.issues.map((x: any, i: number) => (
              <p className="review-issue" key={i}>
                {x.field}: {x.message}
              </p>
            ))}
            <form
              className="form-grid"
              onSubmit={async (e) => {
                e.preventDefault();
                const values = Object.fromEntries(
                  new FormData(e.currentTarget),
                );
                const fields = {
                  ...review.fields,
                  ...Object.fromEntries(
                    Object.entries(values).map(([k, v]) => [
                      k,
                      v === "" ? null : v,
                    ]),
                  ),
                };
                const x = await action(
                  () =>
                    api("/documents/" + review.document_id + "/review", {
                      method: "PUT",
                      body: JSON.stringify(fields),
                    }),
                  "Review saved",
                );
                if (x) setReview(x);
              }}
            >
              {Object.entries(review.fields)
                .filter(([k]) => !["warnings", "synthetic"].includes(k))
                .map(([key, value]) => (
                  <label
                    key={key}
                    className={["renewal_terms"].includes(key) ? "full" : ""}
                  >
                    <span className="capitalize">
                      {key.replaceAll("_", " ")}
                    </span>
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
                      step={key.includes("salary") ? "0.01" : undefined}
                    />
                  </label>
                ))}
              <div className="full modal-actions">
                <Button secondary type="submit">
                  Save verified fields
                </Button>
                <Button
                  disabled={!review.valid}
                  onClick={async () => {
                    const result = await action(
                      () =>
                        post("/onboarding", {
                          document_id: review.document_id,
                        }),
                      "Workflow outcome saved",
                    );
                    if (result) {
                      setReview(null);
                      navigate("/onboarding");
                    }
                  }}
                >
                  Start onboarding
                  <ArrowRight size={16} />
                </Button>
              </div>
            </form>
          </>
        )}
      </Modal>
    </>
  );
}

function Onboarding() {
  const query = useData("/onboarding");
  const tasks = useData("/tasks?limit=100");
  const action = useAction();
  const navigate = useNavigate();
  const [busy, setBusy] = useState("");
  const [archiveTarget, setArchiveTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [archiving, setArchiving] = useState(false);
  return (
    <>
      <PageHead
        eyebrow="EMPLOYEE JOURNEYS"
        title="A thoughtful start, every time."
        description="Durable workflows, clear handoffs and a welcome that feels human."
      >
        <Button onClick={() => navigate("/journeys")}>
          <Plus size={16} />
          New onboarding
        </Button>
      </PageHead>
      <QueryView query={query}>
        {(d) =>
          d.items.length ? (
            <div className="workflow-grid">
              {d.items.map((w: any) => (
                <section className="panel workflow-card" key={w.id}>
                  <div className="workflow-top">
                    <Avatar name={w.employee?.name || "Pending review"} />
                    <div>
                      <h3>{w.employee?.name || "Contract under review"}</h3>
                      <p>
                        {w.employee?.profession ||
                          "Awaiting validated employee details"}
                      </p>
                    </div>
                    {stateBadge(w.state)}
                  </div>
                  <div className="workflow-progress">
                    <span
                      style={{
                        width:
                          (w.steps.filter((x: any) => x.status === "completed")
                            .length /
                            7) *
                            100 +
                          "%",
                      }}
                    />
                  </div>
                  <span className="subtle">
                    {
                      w.steps.filter((x: any) => x.status === "completed")
                        .length
                    }{" "}
                    of 7 automation steps verified
                  </span>
                  <div className="workflow-steps">
                    {w.steps.map((step: any) => (
                      <div key={step.id}>
                        <span
                          className={
                            step.status === "completed"
                              ? "step-check done"
                              : "step-check"
                          }
                        >
                          {step.status === "completed" ? (
                            <Check size={12} />
                          ) : (
                            <span />
                          )}
                        </span>
                        <span>{step.name}</span>
                        {step.result?.simulated && <Badge>Simulated</Badge>}
                      </div>
                    ))}
                  </div>
                  {w.error && <p className="review-issue">{w.error}</p>}
                  <p className="workflow-note">
                    Automation completion prepares onboarding. HR tasks and
                    official Qiwa approvals still need human completion.
                  </p>
                  <div className="inline-actions">
                    <Button
                      secondary
                      onClick={() =>
                        navigate("/chat?document=" + w.document_id)
                      }
                    >
                      Ask HUMAIN Chat
                      <ArrowUpRight size={15} />
                    </Button>
                    {!["COMPLETED", "CANCELLED"].includes(w.state) && (
                      <Button
                        busy={busy === w.id}
                        onClick={async () => {
                          setBusy(w.id);
                          await action(
                            () =>
                              post("/onboarding", {
                                document_id: w.document_id,
                              }),
                            "Workflow outcome refreshed",
                          );
                          setBusy("");
                        }}
                      >
                        <RefreshCw size={15} />
                        Retry / verify
                      </Button>
                    )}
                    <Button
                      secondary
                      disabled={!!busy || archiving}
                      onClick={() =>
                        setArchiveTarget({
                          id: w.id,
                          name: w.employee?.name || "Contract under review",
                        })
                      }
                    >
                      <Archive size={15} /> Archive onboarding
                    </Button>
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <Empty title="Make the first day a great day">
              <p>
                Upload a contract to begin an employee’s onboarding journey.
              </p>
              <Button onClick={() => navigate("/contracts")}>
                Upload a contract
                <ArrowRight size={16} />
              </Button>
            </Empty>
          )
        }
      </QueryView>
      <Modal
        open={!!archiveTarget}
        onClose={() => {
          if (!archiving) setArchiveTarget(null);
        }}
        title="Archive onboarding?"
        description="Hide this workflow card from the Onboarding page."
      >
        <p>
          Archive onboarding for <strong>{archiveTarget?.name}</strong>?
          Employee records, contracts, tasks, email evidence and audit history
          are preserved.
        </p>
        <p>
          This hides the card only. It does not cancel pending tasks or
          scheduled emails, or stop work already in progress.
        </p>
        <div className="modal-actions">
          <Button
            secondary
            disabled={archiving}
            onClick={() => setArchiveTarget(null)}
          >
            Cancel
          </Button>
          <Button
            busy={archiving}
            onClick={async () => {
              if (!archiveTarget || archiving) return;
              setArchiving(true);
              const result = await action(
                () => post("/onboarding/" + archiveTarget.id + "/archive"),
                "Onboarding archived; records and history preserved",
              );
              setArchiving(false);
              if (result) setArchiveTarget(null);
            }}
          >
            <Archive size={15} /> Confirm archive
          </Button>
        </div>
      </Modal>
      <section className="panel task-panel">
        <SectionTitle
          title="Human handoffs"
          subtitle="Tasks created by your onboarding workflows. Simulated IT requests are labeled."
        />
        <QueryView query={tasks}>
          {(d) =>
            d.items.length ? (
              <div>
                {d.items.map((t: any) => (
                  <div className="task-line" key={t.id}>
                    <span className="task-icon">
                      <ListTodo size={17} />
                    </span>
                    <div className="task-description">
                      <strong>{t.title}</strong>
                      <small>Due {t.due_date || "not set"}</small>
                    </div>
                    {t.simulated ? (
                      <Badge>Simulated request</Badge>
                    ) : (
                      stateBadge(t.status)
                    )}
                    {!t.simulated && t.status === "pending" && (
                      <button
                        className="text-button"
                        onClick={() =>
                          action(
                            () => post("/tasks/" + t.id + "/complete"),
                            "Task completed",
                          )
                        }
                      >
                        Complete
                        <Check size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <Empty title="No pending handoffs" />
            )
          }
        </QueryView>
      </section>
    </>
  );
}

function Compliance() {
  const location = useLocation();
  const [days, setDays] = useState(() => {
    const value = Number(
      new URLSearchParams(location.search).get("days") ?? 30,
    );
    return Number.isInteger(value) && value >= 0 && value <= 365 ? value : 30;
  });
  const [kind, setKind] = useState("all");
  const query = useData("/compliance?days=" + days + "&kind=" + kind);
  const action = useAction();
  const [busy, setBusy] = useState(false);
  return (
    <>
      <PageHead
        eyebrow="PROACTIVE PEOPLE OPERATIONS"
        title="One step ahead. Always aware."
        description="Contract, Iqama and work permit deadlines, brought into focus."
      >
        <Button
          secondary
          busy={busy}
          onClick={async () => {
            setBusy(true);
            await action(
              () => post("/compliance/scan"),
              "Compliance scan persisted",
            );
            setBusy(false);
          }}
        >
          <RefreshCw size={16} />
          Run a scan
        </Button>
      </PageHead>
      <div className="info-strip">
        <ShieldCheck size={20} />
        <div>
          <strong>Clear signals. Informed decisions.</strong>
          <p>
            Deadline calculations use the Riyadh calendar date. These reminders
            are operational signals; they are not legal compliance
            determinations.
          </p>
        </div>
      </div>
      <section className="panel">
        <div className="toolbar">
          <div className="tabs">
            {["all", "contract", "iqama", "work_permit"].map((x) => (
              <button
                key={x}
                className={x === kind ? "selected" : ""}
                onClick={() => setKind(x)}
              >
                {x === "all" ? "All documents" : x.replace("_", " ")}
              </button>
            ))}
          </div>
          <label className="compact-label">
            Window
            <select
              aria-label="Deadline window"
              value={days}
              onChange={(e) => setDays(+e.target.value)}
            >
              {[7, 30, 60, 90].map((d) => (
                <option key={d} value={d}>
                  {d} days
                </option>
              ))}
            </select>
          </label>
        </div>
        <QueryView query={query}>
          {(d) => <DeadlineTable alerts={d.alerts} />}
        </QueryView>
      </section>
    </>
  );
}

function Communications() {
  const query = useData("/communications");
  const action = useAction();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <PageHead
        eyebrow="CONSIDERED COMMUNICATIONS"
        title="The right message. The right moment."
        description="Approved templates, authorized recipients and a complete execution history."
      >
        <a
          className="button secondary"
          target="_blank"
          rel="noreferrer"
          href="http://127.0.0.1:8025"
        >
          Open sandbox inbox
          <ArrowUpRight size={16} />
        </a>
        <Button onClick={() => setConfirm(true)}>
          <Mail size={16} />
          Run renewal reminders
        </Button>
      </PageHead>
      <QueryView query={query}>
        {(d) => (
          <>
            <div className="communication-grid">
              {d.templates.map((t: any) => (
                <section className="panel template-card" key={t.id}>
                  <div className="template-icon">
                    <Mail size={20} />
                  </div>
                  <Badge tone="green">Approved template</Badge>
                  <h3 className="capitalize">
                    {t.code.replace("_", " ")}
                    {t.code === "welcome" ? " email" : " reminder"}
                  </h3>
                  <p>{t.subject}</p>
                  <details>
                    <summary>Preview template</summary>
                    <pre>{t.body}</pre>
                  </details>
                </section>
              ))}
            </div>
            <section className="panel">
              <SectionTitle
                title="Delivery workspace"
                subtitle="SMTP acceptance is recorded separately from inbox delivery."
                action={<Badge tone="green">{d.mode} SMTP</Badge>}
              />
              <div className="recipient-list">
                <span>Approved recipients</span>
                {d.approved_recipients.map((r: string) => (
                  <code key={r}>{r}</code>
                ))}
              </div>
              {d.jobs.length ? (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>MESSAGE</th>
                        <th>RECIPIENT</th>
                        <th>STATE</th>
                        <th>ATTEMPTS</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {d.jobs.map((j: any) => (
                        <tr key={j.id}>
                          <td>
                            <strong>{j.subject}</strong>
                            <small className="block mono">
                              {j.id.slice(0, 8)}
                            </small>
                          </td>
                          <td>{j.recipient}</td>
                          <td>{stateBadge(j.state)}</td>
                          <td>{j.attempts}</td>
                          <td>
                            {j.state === "AWAITING_REVIEW" && (
                              <button
                                className="text-button"
                                onClick={() =>
                                  action(
                                    () =>
                                      post(
                                        "/communications/" + j.id + "/review",
                                      ),
                                    "Current email policy verified",
                                  )
                                }
                              >
                                Recheck authorization
                                <ShieldCheck size={14} />
                              </button>
                            )}
                            {["PREPARED", "FAILED"].includes(j.state) && (
                              <button
                                className="text-button"
                                onClick={() =>
                                  action(
                                    () =>
                                      post("/communications/" + j.id + "/send"),
                                    "SMTP execution result saved",
                                  )
                                }
                              >
                                Send approved
                                <ArrowRight size={14} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Empty title="Every message starts with permission">
                  Run approved reminders or start onboarding to prepare your
                  first email.
                </Empty>
              )}
            </section>
            <section className="panel task-panel">
              <SectionTitle
                title="SMTP execution history"
                subtitle="A server acceptance receipt does not verify inbox delivery."
              />
              {d.logs.map((l: any) => (
                <div className="task-line" key={l.id}>
                  <Mail size={16} />
                  <code>{l.message_id}</code>
                  {stateBadge(l.status)}
                  <span className="subtle">{l.detail}</span>
                </div>
              ))}
              {!d.logs.length && <Empty title="No SMTP executions yet" />}
            </section>
          </>
        )}
      </QueryView>
      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Run approved renewal reminders"
        description="Expired documents and documents due within 30 days will be checked."
      >
        <p>
          The service will verify recipient authorization, use approved
          templates and prevent duplicate messages. This workspace uses the
          local sandbox inbox.
        </p>
        <div className="modal-actions">
          <Button secondary onClick={() => setConfirm(false)}>
            Cancel
          </Button>
          <Button
            busy={busy}
            onClick={async () => {
              setBusy(true);
              const result = await action(
                () =>
                  post("/communications/reminders/run", {
                    days: 30,
                    kind: "all",
                  }),
                "Reminder execution results saved",
              );
              setBusy(false);
              if (result) {
                setConfirm(false);
                toast.info(
                  `${result.count} deadline(s) evaluated. Inspect each job’s state below.`,
                );
              }
            }}
          >
            Run reminders
            <ArrowRight size={16} />
          </Button>
        </div>
      </Modal>
    </>
  );
}

function Analytics() {
  const ratio = useData("/saudization");
  const evaluation = useData("/evaluation");
  return (
    <>
      <PageHead
        eyebrow="WORKFORCE INTELLIGENCE"
        title="See the people behind the numbers."
        description="Measured insights from your authoritative workforce records."
      />
      <QueryView query={ratio}>
        {(d) => (
          <>
            <div className="metrics">
              <Metric
                label="Workforce"
                value={d.overall?.total || 0}
                detail="Active employee records"
                icon={<Users size={18} />}
              />
              <Metric
                label="Saudi nationals"
                value={d.overall?.saudi || 0}
                detail="Based on nationality aliases"
                icon={<Leaf size={18} />}
              />
              <Metric
                label="Saudization ratio"
                value={`${d.overall?.rate || 0}%`}
                detail="Descriptive, not a Nitaqat rating"
                icon={<ChartNoAxesCombined size={18} />}
              />
              <Metric
                label="Professions"
                value={d.by_profession.length}
                detail="Distinct recorded professions"
                icon={<ListTodo size={18} />}
              />
            </div>
            <section className="panel chart-panel">
              <SectionTitle
                title="A closer look at your workforce"
                subtitle="Saudi and non-Saudi employees, by profession."
              />
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height={290}>
                  <BarChart
                    data={d.by_profession}
                    margin={{ left: 0, right: 20, top: 20, bottom: 35 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 6"
                      vertical={false}
                      stroke="#e6eae6"
                    />
                    <XAxis
                      dataKey="profession"
                      tick={{ fontSize: 11, fill: "#7b837d" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip cursor={{ fill: "#f4f6ef" }} />
                    <Bar
                      dataKey="saudi"
                      name="Saudi nationals"
                      fill="#008d9f"
                      stackId="a"
                      barSize={42}
                    />
                    <Bar
                      dataKey="non_saudi"
                      name="Non-Saudi nationals"
                      fill="#caff3d"
                      stackId="a"
                      radius={[5, 5, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="chart-legend">
                <span>
                  <i />
                  Saudi nationals
                </span>
                <span>
                  <i />
                  Non-Saudi nationals
                </span>
              </div>
            </section>
          </>
        )}
      </QueryView>
      <section className="panel task-panel">
        <SectionTitle
          title="Measured automation performance"
          subtitle="Observed runs only. No estimated time savings are presented."
        />
        <QueryView query={evaluation}>
          {(d) => (
            <>
              <div className="evaluation-grid">
                {[
                  ["Agent runs", d.agent_runs],
                  ["Completed agent runs", d.agent_completed],
                  [
                    "Tool success",
                    `${d.tools_succeeded} / ${d.tool_executions}`,
                  ],
                  [
                    "Mean agent latency",
                    d.mean_latency_ms === null
                      ? "Not measured"
                      : `${(d.mean_latency_ms / 1000).toFixed(1)} s`,
                  ],
                  [
                    "Onboarding completions",
                    `${d.onboarding_completed} / ${d.onboarding_runs}`,
                  ],
                  ["Review requests", d.human_interventions],
                  ["SMTP accepted jobs", d.smtp_accepted_jobs],
                  ["Time saved", "Baseline needed"],
                ].map(([label, v]) => (
                  <div key={label}>
                    <span>{label}</span>
                    <strong>{v}</strong>
                  </div>
                ))}
              </div>
            </>
          )}
        </QueryView>
      </section>
    </>
  );
}

function Audit() {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<any>(null);
  const query = useData(
    "/audit?offset=" + page * 25 + "&q=" + encodeURIComponent(search),
  );
  return (
    <>
      <PageHead
        eyebrow="TRUST THROUGH TRANSPARENCY"
        title="Every action has a story."
        description="Follow the decisions, permissions and verified outcomes behind your operations."
      />
      <section className="panel">
        <div className="toolbar">
          <label className="search-field">
            <Search size={17} />
            <input
              aria-label="Search audit actions"
              placeholder="Search actions…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
            />
          </label>
          <Badge>Durable PostgreSQL records</Badge>
        </div>
        <QueryView query={query}>
          {(d) => (
            <>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>ACTION</th>
                      <th>REFERENCE</th>
                      <th>ACTOR</th>
                      <th>TIME</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {d.items.map((e: any) => (
                      <tr key={e.id}>
                        <td>
                          <strong>{e.action}</strong>
                        </td>
                        <td className="mono">
                          {e.object_id?.slice(0, 14) || "Workspace"}
                        </td>
                        <td>{e.actor_id ? "Authorized user" : "System"}</td>
                        <td>{new Date(e.created_at).toLocaleString()}</td>
                        <td>
                          <button
                            className="icon-btn"
                            aria-label={"Inspect " + e.action}
                            onClick={() => setDetail(e)}
                          >
                            <ArrowUpRight size={17} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination page={page} setPage={setPage} total={d.total} />
            </>
          )}
        </QueryView>
      </section>
      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title="Audit event"
        description={detail?.action}
      >
        <pre className="json-view">{JSON.stringify(detail, null, 2)}</pre>
      </Modal>
    </>
  );
}

function Settings({ integrations = false }: { integrations?: boolean }) {
  const cfg = useData("/settings");
  const db = useData("/health/database");
  const model = useData("/health/ollama");
  const [refreshing, setRefreshing] = useState(false);
  return (
    <>
      <PageHead
        eyebrow={integrations ? "CONNECTED SYSTEMS" : "WORKSPACE SETTINGS"}
        title={
          integrations
            ? "A connected foundation."
            : "Built for your way of working."
        }
        description="Local infrastructure, explicit permissions and configuration you control."
      >
        <Button
          secondary
          busy={refreshing}
          onClick={async () => {
            setRefreshing(true);
            await Promise.all([cfg.refetch(), db.refetch(), model.refetch()]);
            setRefreshing(false);
          }}
        >
          <RefreshCw size={16} />
          Check connections
        </Button>
      </PageHead>
      <div
        className="integration-grid"
        aria-busy={
          cfg.isPending || db.isPending || model.isPending || refreshing
        }
      >
        {[
          {
            title: "PostgreSQL 17",
            ready: !!db.data?.connected,
            icon: <Activity />,
          },
          {
            title: "Qwen + Ollama",
            ready: !!model.data?.ready,
            icon: <Sparkles />,
          },
          {
            title:
              cfg.data?.smtp_mode === "real" ? "SMTP delivery" : "SMTP sandbox",
            ready:
              cfg.data?.smtp_mode === "sandbox" ||
              (cfg.data?.smtp_mode === "real" &&
                cfg.data?.real_email_authorized),
            icon: <Mail />,
          },
          {
            title: "IT provisioning",
            ready: false,
            icon: <Unplug />,
          },
        ].map((x) => (
          <section className="panel integration-card" key={x.title}>
            <span className="integration-icon">{x.icon}</span>
            <Badge tone={x.ready ? "green" : "neutral"}>
              {x.ready ? "Connected / configured" : "Unavailable / simulated"}
            </Badge>
            <h3>{x.title}</h3>
          </section>
        ))}
      </div>
      {!integrations && <EmailSettings />}
      <QueryView query={cfg}>
        {(d) => (
          <section className="panel settings-panel">
            <SectionTitle
              title="Autonomy with clear boundaries"
              subtitle="Policy is enforced in Python for every tool call."
            />
            <div className="policy-grid">
              <div>
                <h3>
                  <ShieldCheck size={18} />
                  Preauthorized routine operations
                </h3>
                <p>
                  Read employee records, review documents, create profiles and
                  HR tasks, monitor deadlines, send approved templates to
                  approved recipients, and record audit events.
                </p>
              </div>
              <div>
                <h3>
                  <ScanLine size={18} />
                  Human decisions stay human
                </h3>
                <p>
                  Contract signatures, employment terms, salary changes,
                  terminations, official Qiwa approval and production access are
                  unavailable to HUMAIN Chat.
                </p>
              </div>
            </div>
            <dl className="details">
              <dt>Deadline window</dt>
              <dd>{d.alert_window_days} days</dd>
              <dt>Scheduler</dt>
              <dd>
                {d.scheduler_enabled
                  ? "Enabled while backend runs"
                  : "Disabled"}
              </dd>
              <dt>External SMTP authorization</dt>
              <dd>{d.real_email_authorized ? "Configured" : "Disabled"}</dd>
              <dt>Configuration</dt>
              <dd>
                Use Email settings above to change recipients and SMTP delivery.
                Database and model configuration remain in the local .env.
              </dd>
            </dl>
            {d.scheduler.map((j: any) => (
              <div className="task-line" key={j.id}>
                <Activity size={17} />
                <strong>{j.name}</strong>
                {stateBadge(j.state)}
                <span className="subtle">
                  Next run {new Date(j.next_run).toLocaleString()}
                </span>
              </div>
            ))}
            <p className="subtle">
              HUMAIN-inspired independent hackathon application. No official
              endorsement or private Qiwa API connection.
            </p>
          </section>
        )}
      </QueryView>
    </>
  );
}
