"use client";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  CalendarDays,
  Search,
  Plus,
  MapPin,
  Clock,
  Users,
  LayoutGrid,
  ClipboardList,
  History,
  LogOut,
  X,
  ArrowRight,
  Check,
  Shield,
  SlidersHorizontal,
  Sprout,
  ChevronRight,
  RefreshCw,
  LoaderCircle,
} from "lucide-react";
import { browserClient } from "@/lib/supabase";
import { dateBoundary } from "@/lib/dates";
import type { Data, Profile, Workshop } from "@/lib/types";
const empty: Data = { workshops: [], registrations: [], users: [], audit: [] };
const date = (s: string) =>
  new Date(s).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
const time = (s: string) =>
  new Date(s).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
const human = (s: string) => s.replaceAll("_", " ");
export default function Home() {
  const [client] = useState(browserClient),
    [profile, setProfile] = useState<Profile | null>(null),
    [data, setData] = useState<Data>(empty),
    [ready, setReady] = useState(false),
    [page, setPage] = useState("Workshops"),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState("all"),
    [location, setLocation] = useState("all"),
    [available, setAvailable] = useState(false),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [selected, setSelected] = useState<Workshop | null>(null),
    [modal, setModal] = useState<"register" | "workshop" | "user" | null>(null),
    [editing, setEditing] = useState<Workshop | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [loginError, setLoginError] = useState("");
  const [cancelId, setCancelId] = useState<string | null>(null);
  useEffect(() => {
    if (!modal && !selected && !cancelId) return;
    const previous = document.activeElement as HTMLElement;
    const dialogs = document.querySelectorAll<HTMLElement>('[role="dialog"]');
    const dialog = dialogs[dialogs.length - 1];
    dialog?.querySelector<HTMLElement>("input,button,select,textarea")?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) {
        setModal(null);
        setSelected(null);
        setCancelId(null);
        setError("");
      }
      if (e.key === "Tab" && dialog) {
        const items = Array.from(
          dialog.querySelectorAll<HTMLElement>(
            "button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled)",
          ),
        );
        const first = items[0],
          last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
      previous?.focus();
    };
  }, [modal, selected?.id, cancelId, busy]);
  useEffect(() => {
    if (profile?.role === "admin" && !["Team", "Activity"].includes(page))
      setPage("Team");
    if (profile && profile.role !== "admin" && page === "Team")
      setPage("Workshops");
  }, [profile?.role, page]);
  async function token() {
    const s = await client?.auth.getSession();
    return s?.data.session?.access_token;
  }
  async function reload() {
    if (!client) return;
    const access = await token();
    if (!access) return;
    const res = await fetch("/api/data", {
      headers: { Authorization: `Bearer ${access}` },
    });
    const payload = await res.json();
    if (!res.ok) throw new Error(payload.error);
    setProfile(payload.profile);
    setData(payload);
  }
  useEffect(() => {
    let mounted = true;
    if (!client) {
      setReady(true);
      return;
    }
    client.auth.getSession().then(async () => {
      try {
        await reload();
      } catch (e) {
        if (mounted) setLoginError((e as Error).message);
      } finally {
        if (mounted) setReady(true);
      }
    });
    return () => {
      mounted = false;
    };
  }, [client]);
  useEffect(() => {
    if (!profile) return;
    const interval = setInterval(() => reload().catch(() => {}), 15000);
    return () => clearInterval(interval);
  }, [profile?.id]);
  useEffect(() => {
    if (!notice) return;
    const timeout = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(timeout);
  }, [notice]);
  async function mutate(
    path: string,
    input: Record<string, unknown>,
    method = "POST",
  ) {
    setBusy(true);
    setError("");
    try {
      const access = await token();
      if (!access) throw new Error("Your session has expired. Please sign in.");
      const res = await fetch(`/api${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${access}`,
        },
        body: JSON.stringify(input),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error);
      await reload();
      setNotice(
        path === "/workshops"
          ? "Workshop saved."
          : path === "/registrations"
            ? "Attendee registered. Their seat is confirmed."
            : path.startsWith("/registrations/")
              ? "Registration cancelled. The seat is available again."
              : "Account updated.",
      );
      setModal(null);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function signout() {
    await client?.auth.signOut();
    setProfile(null);
    setData(empty);
    setError("");
    setSearch("");
    setSelected(null);
    setModal(null);
    setCancelId(null);
    setNotice("");
  }
  const current = selected
    ? data.workshops.find((w) => w.id === selected.id) || selected
    : null;
  const filtered = useMemo(
    () =>
      data.workshops.filter(
        (w) =>
          (w.title + " " + w.code + " " + w.instructor)
            .toLowerCase()
            .includes(search.toLowerCase()) &&
          (status === "all" || w.status === status) &&
          (location === "all" || w.location === location) &&
          (!available ||
            (w.capacity > w.active_count &&
              w.status === "scheduled" &&
              new Date(w.starts_at) > new Date())) &&
          (!from || w.starts_at >= dateBoundary(from)) &&
          (!to || w.starts_at < dateBoundary(to, true)),
      ),
    [data.workshops, search, status, location, available, from, to],
  );
  if (!ready)
    return (
      <main className="loading">
        <Sprout size={36} />
        <p>Opening your workshop desk…</p>
      </main>
    );
  if (!profile)
    return (
      <main className="login-page">
        <section className="login-story">
          <div className="brand">
            <Sprout />
            <span>
              gather<span className="brand-dot">.</span>
            </span>
          </div>
          <div className="story-copy">
            <div className="eyebrow">SPACE FOR SOMETHING NEW</div>
            <h1>
              Good things happen
              <br />
              when we gather.
            </h1>
            <p>
              A little creativity. A new skill. A shared experience.
              <br />
              Give your community more room to grow.
            </p>
            <div className="abstract-art">
              <span className="arch arch-one" />
              <span className="arch arch-two" />
              <span className="art-circle" />
              <span className="art-line" />
              <Sprout size={125} />
            </div>
          </div>
          <footer>Community workshops, thoughtfully organised.</footer>
        </section>
        <section className="login-form">
          <div className="eyebrow">YOUR COMMUNITY. CONNECTED.</div>
          <h2>Welcome to the desk.</h2>
          <p>Sign in to manage your community’s workshops.</p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setLoginError("");
              try {
                if (!client)
                  throw new Error(
                    "Sign-in is unavailable. Please contact your administrator.",
                  );
                const f = new FormData(e.currentTarget);
                const { error } = await client.auth.signInWithPassword({
                  email: String(f.get("email")),
                  password: String(f.get("password")),
                });
                if (error) throw error;
                await reload();
              } catch (e) {
                setLoginError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Email address
              <input
                name="email"
                type="email"
                autoComplete="username"
                placeholder="you@yourcentre.org"
                required
              />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="Enter your password"
                required
              />
            </label>
            {loginError && (
              <div className="error" role="alert">
                {loginError}
              </div>
            )}
            <button className="primary wide" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
              <ArrowRight size={17} />
            </button>
          </form>
          <div className="admin-note">
            <Shield size={16} />
            Need access? Ask your administrator for an account.
          </div>
          <small>One desk. Every workshop. No overbooked seats.</small>
        </section>
      </main>
    );
  const operational = profile.role !== "admin";
  const active = data.workshops.filter(
    (w) => w.status === "scheduled" && new Date(w.starts_at) > new Date(),
  );
  const total = active.reduce((n, w) => n + w.active_count, 0),
    seats = active.reduce((n, w) => n + w.capacity - w.active_count, 0);
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <Sprout />
          <span>
            gather<span className="brand-dot">.</span>
          </span>
        </div>
        <div className="workspace-label">COMMUNITY WORKSHOP DESK</div>
        <nav>
          {(operational
            ? [
                ["Workshops", LayoutGrid],
                ["Registrations", ClipboardList],
                ["Activity", History],
              ]
            : [
                ["Team", Users],
                ["Activity", History],
              ]
          ).map(([label, Icon]) => {
            const NavIcon = Icon as typeof Users;
            return (
              <button
                className={page === label ? "nav-active" : ""}
                key={String(label)}
                onClick={() => {
                  setPage(String(label));
                  setSearch("");
                  setError("");
                }}
              >
                <NavIcon size={19} />
                {String(label)}
                {label === "Workshops" && <span>{data.workshops.length}</span>}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card">
            <span className="help-icon">
              <Sprout size={20} />
            </span>
            <h4>A little room to grow.</h4>
            <p>
              Bring people together.
              <br />
              We’ll keep track of the seats.
            </p>
          </div>
          <div className="user-block">
            <div className="avatar">
              {profile.name
                .split(" ")
                .map((n) => n[0])
                .join("")}
            </div>
            <div>
              <strong>{profile.name}</strong>
              <small>{profile.role}</small>
            </div>
            <button onClick={signout} title="Sign out" aria-label="Sign out">
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <span>
            Workspace <ChevronRight size={13} /> <strong>{page}</strong>
          </span>
          <div>
            <span className="live-dot" />
            Staff workspace
            <button
              aria-label="Refresh data"
              onClick={() => {
                reload().catch((e) => setError(e.message));
              }}
            >
              <RefreshCw size={15} />
            </button>
          </div>
        </header>
        <main className="content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                {operational
                  ? "MAKE ROOM FOR CONNECTION"
                  : "PEOPLE BEHIND THE PROGRAMME"}
              </div>
              <h1>
                {page === "Workshops"
                  ? "Your next great gathering."
                  : page === "Registrations"
                    ? "Every seat has a story."
                    : page === "Team"
                      ? "A good team starts here."
                      : "The story so far."}
              </h1>
              <p>
                {page === "Workshops"
                  ? "Find a workshop, welcome an attendee, and let the good things begin."
                  : page === "Registrations"
                    ? "A complete record of attendees, bookings, and cancellations."
                    : page === "Team"
                      ? "Give your people the right access to do their best work."
                      : "A clear record of who did what, and when."}
              </p>
            </div>
            {page === "Workshops" && profile.role === "manager" && (
              <button
                className="primary"
                onClick={() => {
                  setEditing(null);
                  setModal("workshop");
                  setError("");
                }}
              >
                <Plus size={17} />
                New workshop
              </button>
            )}
            {page === "Team" && (
              <button
                className="primary"
                onClick={() => {
                  setModal("user");
                  setError("");
                }}
              >
                <Plus size={17} />
                Add team member
              </button>
            )}
          </div>
          {error && !modal && (
            <div className="error" role="alert">
              {error}
              <button aria-label="Dismiss error" onClick={() => setError("")}>
                <X size={15} />
              </button>
            </div>
          )}
          {page === "Workshops" && (
            <>
              <div className="stats">
                <div>
                  <span className="stat-icon">
                    <CalendarDays />
                  </span>
                  <div>
                    <small>Upcoming workshops</small>
                    <strong>
                      {active.length}
                      <span>on the calendar</span>
                    </strong>
                  </div>
                </div>
                <div>
                  <span className="stat-icon">
                    <Users />
                  </span>
                  <div>
                    <small>Confirmed attendees</small>
                    <strong>
                      {total}
                      <span>ready to join in</span>
                    </strong>
                  </div>
                </div>
                <div>
                  <span className="stat-icon">
                    <Sprout />
                  </span>
                  <div>
                    <small>Seats still available</small>
                    <strong>
                      {seats}
                      <span>room for more</span>
                    </strong>
                  </div>
                </div>
              </div>
              <section className="catalogue">
                <div className="section-heading">
                  <h2>
                    Workshop catalogue <span>{filtered.length}</span>
                  </h2>
                  <small>All times shown in your local timezone</small>
                </div>
                <div className="filters">
                  <div className="search">
                    <Search size={17} />
                    <input
                      aria-label="Search workshops"
                      placeholder="Search workshops, codes, instructors…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  <select
                    aria-label="Workshop location"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  >
                    <option value="all">All locations</option>
                    {Array.from(
                      new Set(data.workshops.map((w) => w.location)),
                    ).map((l) => (
                      <option key={l}>{l}</option>
                    ))}
                  </select>
                  <select
                    aria-label="Workshop status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    <option value="all">All statuses</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                  <button
                    className={available ? "toggle selected" : "toggle"}
                    aria-pressed={available}
                    onClick={() => setAvailable(!available)}
                  >
                    <SlidersHorizontal size={15} />
                    Seats available
                  </button>
                </div>
                <div className="date-filters">
                  <label>
                    From{" "}
                    <input
                      type="date"
                      aria-label="From date"
                      value={from}
                      onChange={(e) => setFrom(e.target.value)}
                    />
                  </label>
                  <span>—</span>
                  <label>
                    To{" "}
                    <input
                      type="date"
                      aria-label="To date"
                      value={to}
                      min={from}
                      onChange={(e) => setTo(e.target.value)}
                    />
                  </label>
                  {(from ||
                    to ||
                    available ||
                    search ||
                    status !== "all" ||
                    location !== "all") && (
                    <button
                      onClick={() => {
                        setFrom("");
                        setTo("");
                        setSearch("");
                        setStatus("all");
                        setLocation("all");
                        setAvailable(false);
                      }}
                    >
                      Clear filters
                    </button>
                  )}
                  <span className="results">
                    {filtered.length} workshop{filtered.length === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="workshop-grid">
                  {filtered.map((w, i) => {
                    const full = w.active_count >= w.capacity,
                      closed =
                        w.status !== "scheduled" ||
                        new Date(w.starts_at) <= new Date();
                    return (
                      <article className="workshop-card" key={w.id}>
                        <div
                          className={`card-art art-${w.category === "Technology" ? "code" : w.category === "Wellbeing" ? "well" : w.category === "Food & Living" ? "food" : i % 2 ? "paint" : "clay"}`}
                        >
                          <span className="category">{w.category}</span>
                          <span
                            className={`badge ${full ? "full" : closed ? "closed" : ""}`}
                          >
                            {closed
                              ? human(w.status)
                              : full
                                ? "Fully booked"
                                : "Open for registration"}
                          </span>
                          <div className="art-shape">
                            <span />
                            <span />
                            <span />
                          </div>
                          <span className="art-caption">
                            {w.category === "Technology"
                              ? "CREATE. CONNECT. CODE."
                              : w.category === "Wellbeing"
                                ? "BREATHE A LITTLE."
                                : w.category === "Food & Living"
                                  ? "SOMETHING GOOD IS COOKING."
                                  : "A LITTLE CREATIVE SPACE."}
                          </span>
                        </div>
                        <div className="card-body">
                          <span className="workshop-code">{w.code}</span>
                          <h3>
                            <button onClick={() => setSelected(w)}>
                              {w.title}
                            </button>
                          </h3>
                          <p className="instructor">with {w.instructor}</p>
                          <div className="card-meta">
                            <span>
                              <CalendarDays size={14} />
                              {date(w.starts_at)}
                              <span className="meta-dot">·</span>
                              {time(w.starts_at)}
                            </span>
                            <span>
                              <MapPin size={14} />
                              {w.location}
                              <span className="meta-dot">·</span>
                              {w.duration_minutes} min
                            </span>
                          </div>
                          <div className="capacity-label">
                            <span>
                              <strong>{w.capacity - w.active_count}</strong>{" "}
                              seats available
                            </span>
                            <small>
                              {w.active_count} / {w.capacity} booked
                            </small>
                          </div>
                          <div className="progress">
                            <span
                              style={{
                                width: `${(w.active_count / w.capacity) * 100}%`,
                              }}
                            />
                          </div>
                          <div className="card-footer">
                            <button
                              className="text-button"
                              onClick={() => setSelected(w)}
                            >
                              View details
                              <ArrowUpRight size={14} />
                            </button>
                            <button
                              className="book-button"
                              disabled={full || closed}
                              onClick={() => {
                                setSelected(w);
                                setModal("register");
                                setError("");
                              }}
                            >
                              {full
                                ? "Fully booked"
                                : closed
                                  ? "Closed"
                                  : "Register attendee"}
                              {!full && !closed && <Plus size={14} />}
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
                {!filtered.length && (
                  <div className="empty">
                    <Search size={28} />
                    <h3>No workshops found</h3>
                    <p>
                      Try changing your filters
                      {profile.role === "manager"
                        ? " or create your first workshop."
                        : "."}
                    </p>
                  </div>
                )}
              </section>
            </>
          )}
          {page === "Registrations" && (
            <section className="panel">
              <div className="section-heading">
                <h2>
                  Registration history <span>{data.registrations.length}</span>
                </h2>
              </div>
              <div className="search standalone">
                <Search size={17} />
                <input
                  aria-label="Search registrations"
                  placeholder="Search attendees, emails, workshops…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Attendee</th>
                      <th>Workshop</th>
                      <th>Status</th>
                      <th>Registered by</th>
                      <th>Cancellation</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {data.registrations
                      .filter((r) =>
                        (
                          r.attendee_name +
                          r.attendee_email +
                          data.workshops.find((w) => w.id === r.workshop_id)
                            ?.title
                        )
                          .toLowerCase()
                          .includes(search.toLowerCase()),
                      )
                      .map((r) => (
                        <tr key={r.id}>
                          <td>
                            <strong>{r.attendee_name}</strong>
                            <small>{r.attendee_email}</small>
                          </td>
                          <td>
                            {
                              data.workshops.find((w) => w.id === r.workshop_id)
                                ?.title
                            }
                          </td>
                          <td>
                            <span className={`pill ${r.status}`}>
                              {human(r.status)}
                            </span>
                          </td>
                          <td>
                            {r.registered_by_name}
                            <small>
                              {date(r.registered_at)} · {time(r.registered_at)}
                            </small>
                          </td>
                          <td>
                            {r.cancelled_by_name || "—"}
                            {r.cancelled_at && (
                              <small>
                                {date(r.cancelled_at)} · {time(r.cancelled_at)}
                              </small>
                            )}
                          </td>
                          <td>
                            {r.status === "active" && (
                              <button
                                className="cancel-button"
                                disabled={busy}
                                onClick={() => {
                                  setCancelId(r.id);
                                  setError("");
                                }}
                              >
                                Cancel
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              {!data.registrations.length && (
                <div className="empty">
                  <ClipboardList />
                  <h3>No registrations yet</h3>
                  <p>Register an attendee from the workshop catalogue.</p>
                </div>
              )}
            </section>
          )}
          {page === "Team" && (
            <section className="panel">
              <div className="section-heading">
                <h2>
                  Team members <span>{data.users.length}</span>
                </h2>
                <small>Accounts are created by administrators only</small>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Team member</th>
                      <th>Email</th>
                      <th>Access level</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.users.map((u) => (
                      <tr key={u.id}>
                        <td>
                          <div className="table-person">
                            <span className="avatar">
                              {u.name
                                .split(" ")
                                .map((n) => n[0])
                                .join("")}
                            </span>
                            <strong>
                              {u.name}
                              {u.id === profile.id && <small>You</small>}
                            </strong>
                          </div>
                        </td>
                        <td>{u.email}</td>
                        <td>
                          <select
                            aria-label={`Role for ${u.name}`}
                            disabled={busy}
                            value={u.role}
                            onChange={(e) =>
                              mutate(
                                "/users",
                                { id: u.id, role: e.target.value },
                                "PATCH",
                              )
                            }
                          >
                            <option value="admin">Admin</option>
                            <option value="manager">Manager</option>
                            <option value="staff">Staff</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="role-guide">
                <div>
                  <Shield size={19} />
                  <strong>Admin</strong>
                  <p>Create accounts and manage roles.</p>
                </div>
                <div>
                  <CalendarDays size={19} />
                  <strong>Manager</strong>
                  <p>Manage workshops and registrations.</p>
                </div>
                <div>
                  <ClipboardList size={19} />
                  <strong>Staff</strong>
                  <p>Register attendees and manage cancellations.</p>
                </div>
              </div>
            </section>
          )}
          {page === "Activity" && (
            <section className="panel">
              <div className="section-heading">
                <h2>
                  Activity log{" "}
                  <span>
                    {
                      data.audit.filter((a) =>
                        operational
                          ? !["account_created", "role_changed"].includes(
                              a.action,
                            )
                          : ["account_created", "role_changed"].includes(
                              a.action,
                            ),
                      ).length
                    }
                  </span>
                </h2>
                <small>History is preserved automatically</small>
              </div>
              {data.audit
                .filter((a) =>
                  operational
                    ? !["account_created", "role_changed"].includes(a.action)
                    : ["account_created", "role_changed"].includes(a.action),
                )
                .map((a) => (
                  <div className="activity-row" key={a.id}>
                    <span className="activity-icon">
                      <History size={17} />
                    </span>
                    <div>
                      <strong>{a.actor_name}</strong>{" "}
                      <span>{human(a.action)}</span>
                      <small>
                        {date(a.created_at)} at {time(a.created_at)}
                      </small>
                      {!!a.details.attendee_name && (
                        <small>{String(a.details.attendee_name)}</small>
                      )}
                    </div>
                  </div>
                ))}
              {!data.audit.length && (
                <div className="empty">
                  <History />
                  <h3>A fresh start</h3>
                  <p>
                    Workshop, registration, and account changes will appear
                    here.
                  </p>
                </div>
              )}
            </section>
          )}
          <footer className="content-footer">
            <span>
              <Sprout size={14} />
              Made for a community that keeps growing.
            </span>
            <span>Gather workshop desk</span>
          </footer>
        </main>
      </div>
      {notice && (
        <div className="toast" role="status">
          <Check size={18} />
          {notice}
        </div>
      )}
      {current && !modal && (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <section
            className="detail-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Workshop details"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="close"
              aria-label="Close details"
              onClick={() => setSelected(null)}
            >
              <X />
            </button>
            <div className="eyebrow">
              {current.code} · {current.category}
            </div>
            <h2>{current.title}</h2>
            <p className="detail-description">{current.description}</p>
            <div className="detail-facts">
              <span>
                <Users size={17} />
                {current.instructor}
              </span>
              <span>
                <CalendarDays size={17} />
                {date(current.starts_at)}
              </span>
              <span>
                <Clock size={17} />
                {time(current.starts_at)} · {current.duration_minutes} minutes
              </span>
              <span>
                <MapPin size={17} />
                {current.location}
              </span>
            </div>
            <div className="detail-capacity">
              <strong>{current.capacity - current.active_count}</strong>
              <span>of {current.capacity} seats available</span>
            </div>
            <div className="detail-actions">
              <button
                className="primary"
                disabled={
                  current.active_count >= current.capacity ||
                  current.status !== "scheduled" ||
                  new Date(current.starts_at) <= new Date()
                }
                onClick={() => {
                  setModal("register");
                  setError("");
                }}
              >
                <Plus size={17} />
                Register attendee
              </button>
              {profile.role === "manager" && (
                <button
                  className="secondary"
                  onClick={() => {
                    setEditing(current);
                    setModal("workshop");
                    setError("");
                  }}
                >
                  Edit workshop
                </button>
              )}
            </div>
            <h3>Attendees & history</h3>
            <div className="detail-attendees">
              {data.registrations
                .filter((r) => r.workshop_id === current.id)
                .map((r) => (
                  <div key={r.id}>
                    <div>
                      <strong>{r.attendee_name}</strong>
                      <small>{r.attendee_email}</small>
                      <small>
                        Registered by {r.registered_by_name} ·{" "}
                        {date(r.registered_at)} {time(r.registered_at)}
                      </small>
                      {r.cancelled_at && (
                        <small>
                          Cancelled by {r.cancelled_by_name} ·{" "}
                          {date(r.cancelled_at)} {time(r.cancelled_at)}
                        </small>
                      )}
                    </div>
                    {r.status === "active" ? (
                      <button
                        className="cancel-button"
                        disabled={busy}
                        onClick={() => {
                          setCancelId(r.id);
                          setError("");
                        }}
                      >
                        Cancel
                      </button>
                    ) : (
                      <span className="pill cancelled">Cancelled</span>
                    )}
                  </div>
                ))}
              {!data.registrations.some(
                (r) => r.workshop_id === current.id,
              ) && <p>No attendees yet. Give the first one a warm welcome.</p>}
            </div>
          </section>
        </div>
      )}
      {modal && (
        <div className="modal-backdrop">
          <section
            className="form-modal"
            role="dialog"
            aria-modal="true"
            aria-label={
              modal === "register"
                ? "Register attendee"
                : modal === "workshop"
                  ? "Workshop form"
                  : "Add team member"
            }
          >
            <button
              className="close"
              disabled={busy}
              aria-label="Close form"
              onClick={() => {
                setModal(null);
                setError("");
              }}
            >
              <X />
            </button>
            <div className="eyebrow">
              {modal === "register"
                ? "MAKE SOMEONE’S DAY"
                : modal === "workshop"
                  ? "SOMETHING TO LOOK FORWARD TO"
                  : "WELCOME TO THE TEAM"}
            </div>
            <h2>
              {modal === "register"
                ? "Save them a seat."
                : modal === "workshop"
                  ? editing
                    ? "Edit workshop."
                    : "Create a gathering."
                  : "Add a team member."}
            </h2>
            <p>
              {modal === "register"
                ? `${current?.title} · ${current ? current.capacity - current.active_count : 0} seats available`
                : modal === "workshop"
                  ? "Set the details. We’ll help you keep everything in order."
                  : "Choose the access they need to get started."}
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const f = Object.fromEntries(new FormData(e.currentTarget));
                if (modal === "register")
                  mutate("/registrations", { ...f, workshop_id: current!.id });
                else if (modal === "user") mutate("/users", f);
                else
                  mutate("/workshops", {
                    ...f,
                    ...(editing ? { id: editing.id } : {}),
                    capacity: Number(f.capacity),
                    duration_minutes: Number(f.duration_minutes),
                    starts_at: new Date(String(f.starts_at)).toISOString(),
                  });
              }}
            >
              {modal === "register" ? (
                <>
                  <label>
                    Attendee name
                    <input
                      name="attendee_name"
                      autoFocus
                      required
                      minLength={2}
                      maxLength={100}
                      placeholder="Full name"
                    />
                  </label>
                  <label>
                    Email address
                    <input
                      name="attendee_email"
                      required
                      type="email"
                      maxLength={254}
                      placeholder="attendee@example.com"
                    />
                  </label>
                  <div className="form-note">
                    <Shield size={16} />A seat is confirmed only after the
                    booking succeeds.
                  </div>
                </>
              ) : modal === "user" ? (
                <>
                  <label>
                    Full name
                    <input
                      name="name"
                      autoFocus
                      required
                      minLength={2}
                      maxLength={100}
                    />
                  </label>
                  <label>
                    Email address
                    <input name="email" type="email" required />
                  </label>
                  <label>
                    Initial password
                    <input
                      name="password"
                      type="password"
                      required
                      minLength={12}
                      autoComplete="new-password"
                    />
                    <small>
                      At least 12 characters. Share securely with your team
                      member.
                    </small>
                  </label>
                  <label>
                    Access level
                    <select name="role" defaultValue="staff">
                      <option value="staff">Staff</option>
                      <option value="manager">Manager</option>
                      <option value="admin">Admin</option>
                    </select>
                  </label>
                </>
              ) : (
                <>
                  <div className="form-row">
                    <label>
                      Workshop code
                      <input
                        name="code"
                        required
                        minLength={2}
                        maxLength={30}
                        defaultValue={editing?.code}
                        placeholder="POT-101"
                      />
                    </label>
                    <label>
                      Category
                      <input
                        name="category"
                        required
                        defaultValue={editing?.category || "Creative"}
                        maxLength={50}
                      />
                    </label>
                  </div>
                  <label>
                    Title
                    <input
                      name="title"
                      autoFocus
                      required
                      minLength={2}
                      maxLength={120}
                      defaultValue={editing?.title}
                    />
                  </label>
                  <label>
                    Instructor
                    <input
                      name="instructor"
                      required
                      minLength={2}
                      maxLength={100}
                      defaultValue={editing?.instructor}
                    />
                  </label>
                  <div className="form-row">
                    <label>
                      Date & time
                      <input
                        name="starts_at"
                        type="datetime-local"
                        required
                        defaultValue={
                          editing
                            ? new Date(
                                new Date(editing.starts_at).getTime() -
                                  new Date(
                                    editing.starts_at,
                                  ).getTimezoneOffset() *
                                    60000,
                              )
                                .toISOString()
                                .slice(0, 16)
                            : ""
                        }
                      />
                    </label>
                    <label>
                      Duration (minutes)
                      <input
                        name="duration_minutes"
                        type="number"
                        required
                        min={15}
                        max={720}
                        defaultValue={editing?.duration_minutes || 90}
                      />
                    </label>
                  </div>
                  <div className="form-row">
                    <label>
                      Capacity
                      <input
                        name="capacity"
                        type="number"
                        required
                        min={editing?.active_count || 1}
                        max={1000}
                        defaultValue={editing?.capacity || 12}
                      />
                    </label>
                    <label>
                      Status
                      <select
                        name="status"
                        defaultValue={editing?.status || "scheduled"}
                      >
                        <option value="scheduled">Scheduled</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </label>
                  </div>
                  <label>
                    Location
                    <input
                      name="location"
                      required
                      minLength={2}
                      maxLength={100}
                      defaultValue={editing?.location || "Central Studio"}
                      list="locations"
                    />
                    <datalist id="locations">
                      <option>Central Studio</option>
                      <option>Riverside Centre</option>
                      <option>Northside Hub</option>
                    </datalist>
                  </label>
                  <label>
                    Description
                    <textarea
                      name="description"
                      maxLength={1000}
                      rows={3}
                      defaultValue={editing?.description}
                    />
                  </label>
                </>
              )}
              {error && (
                <div className="error" role="alert">
                  {error}
                </div>
              )}
              <button className="primary wide" disabled={busy}>
                {busy ? (
                  <>
                    <LoaderCircle size={17} className="spin" />
                    Saving…
                  </>
                ) : modal === "register" ? (
                  <>
                    Confirm registration
                    <ArrowRight size={17} />
                  </>
                ) : modal === "workshop" ? (
                  "Save workshop"
                ) : (
                  "Create account"
                )}
              </button>
            </form>
          </section>
        </div>
      )}
      {cancelId && (
        <div className="modal-backdrop">
          <section
            className="form-modal compact"
            role="dialog"
            aria-modal="true"
            aria-label="Confirm cancellation"
          >
            <div className="eyebrow">REGISTRATION UPDATE</div>
            <h2>Release this seat?</h2>
            <p>
              {data.registrations.find((r) => r.id === cancelId)?.attendee_name}
              ’s registration will be cancelled. Their booking history will stay
              in the record.
            </p>
            {error && (
              <div className="error" role="alert">
                {error}
              </div>
            )}
            <div className="detail-actions">
              <button
                className="secondary"
                disabled={busy}
                onClick={() => {
                  setCancelId(null);
                  setError("");
                }}
              >
                Keep registration
              </button>
              <button
                className="primary"
                disabled={busy}
                onClick={async () => {
                  if (await mutate(`/registrations/${cancelId}`, {}, "PATCH"))
                    setCancelId(null);
                }}
              >
                Cancel registration
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
