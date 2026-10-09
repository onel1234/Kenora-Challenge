"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  CalendarDays,
  Search,
  Plus,
  Minus,
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
  ChevronLeft,
  ChevronDown,
  RefreshCw,
  LoaderCircle,
  Sparkles,
  Rows3,
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
const initials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();

function GatherEmblem({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Subtle architectural arch halo */}
      <path
        d="M6.5 25.5V15.5C6.5 10.2533 10.7533 6 16 6C21.2467 6 25.5 10.2533 25.5 15.5V25.5"
        stroke="#CBE0B4"
        strokeOpacity="0.38"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
      {/* Warm champagne sun/seed orb at apex */}
      <circle cx="16" cy="9.5" r="2.1" fill="#F5E3BE" />
      {/* Left sculptural leaf in luminous warm ivory */}
      <path
        d="M15.3 22.8C15.3 22.8 15.3 15.6 10.2 12.2C7.8 10.6 5.8 11.2 5.8 13.7C5.8 17.5 9.6 21.8 15.3 22.8Z"
        fill="#F9FBF6"
      />
      {/* Right sculptural leaf in bright sunlit sage-cream */}
      <path
        d="M16.7 21.2C16.7 21.2 16.8 14.2 21.8 11.1C24.2 9.6 26.2 10.3 26.2 12.8C26.2 16.5 22.4 20.3 16.7 21.2Z"
        fill="#DCEAC7"
      />
      {/* Central stem & grounding vessel base in warm ivory */}
      <path
        d="M16 13.5V25.5M11.5 25.5H20.5"
        stroke="#F9FBF6"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function GatherLogo() {
  return (
    <div className="brand">
      <div className="brand-mark">
        <GatherEmblem size={24} />
      </div>
      <div className="brand-wordmark">
        gather<span className="brand-dot">.</span>
      </div>
    </div>
  );
}

const pad2 = (n: number) => String(n).padStart(2, "0");
const toLocalIsoDate = (d: Date) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

const formatDisplayDate = (isoDate: string, includeWeekday = true) => {
  if (!isoDate) return "";
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return isoDate;
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("en-GB", {
    ...(includeWeekday ? { weekday: "short" } : {}),
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const format12h = (hhmm: string) => {
  const [hStr, mStr] = (hhmm || "10:00").split(":");
  const h = Number(hStr || 10);
  const m = Number(mStr || 0);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${pad2(m)} ${period}`;
};

const buildCalendarCells = (year: number, month: number) => {
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7; // Monday = 0
  const todayIso = toLocalIsoDate(new Date());
  return Array.from({ length: 42 }, (_, idx) => {
    const cellDate = new Date(year, month, 1 - startOffset + idx);
    const iso = toLocalIsoDate(cellDate);
    return {
      day: cellDate.getDate(),
      month: cellDate.getMonth(),
      year: cellDate.getFullYear(),
      iso,
      isCurrentMonth: cellDate.getMonth() === month,
      isToday: iso === todayIso,
    };
  });
};

const STUDIO_TIME_SLOTS = [
  "09:00",
  "10:00",
  "11:00",
  "13:00",
  "14:00",
  "15:30",
  "17:00",
  "18:30",
];

function BotanicalDateTimePicker({ defaultValue }: { defaultValue?: string }) {
  const initialValue = useMemo(() => {
    if (defaultValue) return defaultValue;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return `${toLocalIsoDate(tomorrow)}T10:00`;
  }, [defaultValue]);

  const [value, setValue] = useState(initialValue);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  const [datePart, timePart] = useMemo(() => {
    const [d, t] = value.split("T");
    return [d || toLocalIsoDate(new Date()), (t || "10:00").slice(0, 5)];
  }, [value]);

  const [viewYear, setViewYear] = useState(() => {
    const [y] = datePart.split("-").map(Number);
    return y || new Date().getFullYear();
  });
  const [viewMonth, setViewMonth] = useState(() => {
    const [, m] = datePart.split("-").map(Number);
    return (m ? m - 1 : new Date().getMonth());
  });

  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => {
      popoverRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
    const onMouseDown = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open]);

  const cells = useMemo(
    () => buildCalendarCells(viewYear, viewMonth),
    [viewYear, viewMonth],
  );

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString(
    "en-GB",
    { month: "long", year: "numeric" },
  );

  const [hour24, minute] = timePart.split(":").map(Number);
  const isPM = hour24 >= 12;
  const hour12 = hour24 % 12 || 12;

  const selectDate = (iso: string, y: number, m: number) => {
    setValue(`${iso}T${timePart}`);
    setViewYear(y);
    setViewMonth(m);
  };

  const applyPresetOffset = (daysToAdd: number) => {
    const target = new Date();
    target.setDate(target.getDate() + daysToAdd);
    selectDate(
      toLocalIsoDate(target),
      target.getFullYear(),
      target.getMonth(),
    );
  };

  const applyNextSaturday = () => {
    const target = new Date();
    const diff = (6 - target.getDay() + 7) % 7 || 7;
    target.setDate(target.getDate() + diff);
    selectDate(
      toLocalIsoDate(target),
      target.getFullYear(),
      target.getMonth(),
    );
  };

  const setTime = (newH: number, newM: number) => {
    const clampedH = ((newH % 24) + 24) % 24;
    const clampedM = ((newM % 60) + 60) % 60;
    setValue(`${datePart}T${pad2(clampedH)}:${pad2(clampedM)}`);
  };

  const togglePeriod = (wantPM: boolean) => {
    if (wantPM && hour24 < 12) setTime(hour24 + 12, minute);
    else if (!wantPM && hour24 >= 12) setTime(hour24 - 12, minute);
  };

  const stepMonth = (delta: number) => {
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  };

  return (
    <div className="dtp-container" ref={containerRef}>
      <input type="hidden" name="starts_at" value={value} required />
      <button
        type="button"
        className={open ? "dtp-trigger open" : "dtp-trigger"}
        aria-label="Date and time"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="dtp-trigger-left">
          <span className="dtp-icon-badge">
            <CalendarDays size={15} />
          </span>
          <span className="dtp-trigger-text">
            <span className="dtp-trigger-date">
              {formatDisplayDate(datePart, true)}
            </span>
          </span>
        </span>
        <span className="dtp-trigger-right">
          <span className="dtp-time-pill">{format12h(timePart)}</span>
          <ChevronDown size={15} className="dtp-chevron" />
        </span>
      </button>

      {open && (
        <div
          ref={popoverRef}
          className="dtp-popover"
          role="group"
          aria-label="Choose workshop date and time"
        >
          <div className="dtp-body">
            <div className="dtp-calendar-col">
              <div className="dtp-cal-header">
                <span className="dtp-cal-title">{monthLabel}</span>
                <div className="dtp-nav-btns">
                  <button
                    type="button"
                    className="dtp-nav-btn"
                    aria-label="Previous month"
                    onClick={() => stepMonth(-1)}
                  >
                    <ChevronLeft size={15} />
                  </button>
                  <button
                    type="button"
                    className="dtp-nav-btn"
                    aria-label="Next month"
                    onClick={() => stepMonth(1)}
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>
              </div>

              <div className="dtp-presets">
                <button
                  type="button"
                  className="dtp-preset-btn"
                  onClick={() => applyPresetOffset(0)}
                >
                  Today
                </button>
                <button
                  type="button"
                  className="dtp-preset-btn"
                  onClick={() => applyPresetOffset(1)}
                >
                  Tomorrow
                </button>
                <button
                  type="button"
                  className="dtp-preset-btn"
                  onClick={applyNextSaturday}
                >
                  Next Sat
                </button>
                <button
                  type="button"
                  className="dtp-preset-btn"
                  onClick={() => applyPresetOffset(7)}
                >
                  +1 Week
                </button>
              </div>

              <div className="dtp-weekdays" aria-hidden="true">
                <span>MO</span>
                <span>TU</span>
                <span>WE</span>
                <span>TH</span>
                <span>FR</span>
                <span className="weekend">SA</span>
                <span className="weekend">SU</span>
              </div>

              <div className="dtp-days-grid">
                {cells.map((c) => {
                  const selected = c.iso === datePart;
                  return (
                    <button
                      type="button"
                      key={c.iso}
                      className={`dtp-day${!c.isCurrentMonth ? " outside" : ""}${
                        c.isToday ? " today" : ""
                      }${selected ? " selected" : ""}`}
                      onClick={() => selectDate(c.iso, c.year, c.month)}
                    >
                      {c.day}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="dtp-time-col">
              <div>
                <div className="dtp-time-header">
                  <span className="dtp-time-label">Start time</span>
                  <div className="dtp-ampm-toggle">
                    <button
                      type="button"
                      className={!isPM ? "active" : ""}
                      onClick={() => togglePeriod(false)}
                    >
                      AM
                    </button>
                    <button
                      type="button"
                      className={isPM ? "active" : ""}
                      onClick={() => togglePeriod(true)}
                    >
                      PM
                    </button>
                  </div>
                </div>

                <div className="dtp-slots-grid">
                  {STUDIO_TIME_SLOTS.map((slot) => (
                    <button
                      type="button"
                      key={slot}
                      className={
                        timePart === slot ? "dtp-slot-btn active" : "dtp-slot-btn"
                      }
                      onClick={() => setValue(`${datePart}T${slot}`)}
                    >
                      {format12h(slot)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="dtp-fine-time">
                <div className="dtp-fine-row">
                  <small>Hour</small>
                  <div className="dtp-hour-stepper">
                    <button
                      type="button"
                      aria-label="Decrease hour"
                      onClick={() => setTime(hour24 - 1, minute)}
                    >
                      <Minus size={12} />
                    </button>
                    <span>{pad2(hour12)}</span>
                    <button
                      type="button"
                      aria-label="Increase hour"
                      onClick={() => setTime(hour24 + 1, minute)}
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                </div>
                <div className="dtp-minute-pills">
                  {[0, 15, 30, 45].map((m) => (
                    <button
                      type="button"
                      key={m}
                      className={
                        minute === m ? "dtp-min-pill active" : "dtp-min-pill"
                      }
                      onClick={() => setTime(hour24, m)}
                    >
                      :{pad2(m)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="dtp-footer">
            <span className="dtp-footer-summary">
              <Clock size={13} />
              {formatDisplayDate(datePart, true)} · {format12h(timePart)}
            </span>
            <div className="dtp-footer-actions">
              <button
                type="button"
                className="dtp-done-btn"
                onClick={() => setOpen(false)}
              >
                <Check size={13} />
                Apply schedule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BotanicalDatePicker({
  ariaLabel,
  placeholder,
  value,
  min,
  onChange,
}: {
  ariaLabel: string;
  placeholder: string;
  value: string;
  min?: string;
  onChange: (val: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const [viewYear, setViewYear] = useState(() => {
    if (value) {
      const [y] = value.split("-").map(Number);
      if (y) return y;
    }
    return new Date().getFullYear();
  });
  const [viewMonth, setViewMonth] = useState(() => {
    if (value) {
      const [, m] = value.split("-").map(Number);
      if (m) return m - 1;
    }
    return new Date().getMonth();
  });

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open]);

  const cells = useMemo(
    () => buildCalendarCells(viewYear, viewMonth),
    [viewYear, viewMonth],
  );

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString(
    "en-GB",
    { month: "long", year: "numeric" },
  );

  const stepMonth = (delta: number) => {
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  };

  return (
    <div className="dtp-container" ref={containerRef} style={{ width: "auto" }}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        className={open ? "dtp-trigger open" : "dtp-trigger"}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="dtp-trigger-left">
          <span className="dtp-icon-badge">
            <CalendarDays size={13} />
          </span>
          {value ? (
            <span className="dtp-trigger-date">
              {formatDisplayDate(value, false)}
            </span>
          ) : (
            <span className="dtp-trigger-placeholder">{placeholder}</span>
          )}
        </span>
        <ChevronDown size={13} className="dtp-chevron" />
      </button>

      {open && (
        <div className="dtp-popover single-col">
          <div className="dtp-body">
            <div className="dtp-calendar-col">
              <div className="dtp-cal-header">
                <span className="dtp-cal-title">{monthLabel}</span>
                <div className="dtp-nav-btns">
                  <button
                    type="button"
                    className="dtp-nav-btn"
                    aria-label="Previous month"
                    onClick={() => stepMonth(-1)}
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    type="button"
                    className="dtp-nav-btn"
                    aria-label="Next month"
                    onClick={() => stepMonth(1)}
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>

              <div className="dtp-weekdays" aria-hidden="true">
                <span>MO</span>
                <span>TU</span>
                <span>WE</span>
                <span>TH</span>
                <span>FR</span>
                <span className="weekend">SA</span>
                <span className="weekend">SU</span>
              </div>

              <div className="dtp-days-grid">
                {cells.map((c) => {
                  const selected = c.iso === value;
                  const disabled = Boolean(min && c.iso < min);
                  return (
                    <button
                      type="button"
                      key={c.iso}
                      disabled={disabled}
                      className={`dtp-day${!c.isCurrentMonth ? " outside" : ""}${
                        c.isToday ? " today" : ""
                      }${selected ? " selected" : ""}`}
                      onClick={() => {
                        onChange(c.iso);
                        setViewYear(c.year);
                        setViewMonth(c.month);
                        setOpen(false);
                      }}
                    >
                      {c.day}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="dtp-footer">
            <button
              type="button"
              className="dtp-clear-btn"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            >
              Clear
            </button>
            <button
              type="button"
              className="dtp-done-btn"
              onClick={() => {
                const today = toLocalIsoDate(new Date());
                if (!min || today >= min) onChange(today);
                setOpen(false);
              }}
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function BotanicalNumberStepper({
  name,
  defaultValue,
  min,
  max,
  step = 1,
  presets,
}: {
  name: string;
  defaultValue: number;
  min: number;
  max: number;
  step?: number;
  presets?: number[];
}) {
  const [val, setVal] = useState(defaultValue);
  useEffect(() => {
    setVal(defaultValue);
  }, [defaultValue]);

  const adjust = (delta: number) => {
    setVal((prev) => Math.min(max, Math.max(min, (Number(prev) || min) + delta)));
  };

  return (
    <div>
      <div className="stepper-field">
        <button
          type="button"
          className="stepper-btn"
          aria-label={`Decrease ${name}`}
          disabled={val <= min}
          onClick={() => adjust(-step)}
        >
          <Minus size={14} />
        </button>
        <input
          name={name}
          type="number"
          required
          min={min}
          max={max}
          value={val}
          onChange={(e) => setVal(Number(e.target.value))}
        />
        <button
          type="button"
          className="stepper-btn"
          aria-label={`Increase ${name}`}
          disabled={val >= max}
          onClick={() => adjust(step)}
        >
          <Plus size={14} />
        </button>
      </div>
      {presets && (
        <div className="duration-chips">
          {presets.map((p) => (
            <button
              type="button"
              key={p}
              className={val === p ? "duration-chip active" : "duration-chip"}
              onClick={() => setVal(p)}
            >
              {p}m
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const [client] = useState(browserClient),
    [profile, setProfile] = useState<Profile | null>(null),
    [data, setData] = useState<Data>(empty),
    [ready, setReady] = useState(false),
    [page, setPage] = useState("Workshops"),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState("all"),
    [location, setLocation] = useState("all"),
    [categoryFilter, setCategoryFilter] = useState("all"),
    [viewMode, setViewMode] = useState<"grid" | "list">("grid"),
    [regStatusFilter, setRegStatusFilter] = useState<"all" | "active" | "cancelled">("all"),
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

  const categories = useMemo(
    () => Array.from(new Set(data.workshops.map((w) => w.category))),
    [data.workshops],
  );

  const filtered = useMemo(
    () =>
      data.workshops.filter(
        (w) =>
          (w.title + " " + w.code + " " + w.instructor)
            .toLowerCase()
            .includes(search.toLowerCase()) &&
          (status === "all" || w.status === status) &&
          (location === "all" || w.location === location) &&
          (categoryFilter === "all" || w.category === categoryFilter) &&
          (!available ||
            (w.capacity > w.active_count &&
              w.status === "scheduled" &&
              new Date(w.starts_at) > new Date())) &&
          (!from || w.starts_at >= dateBoundary(from)) &&
          (!to || w.starts_at < dateBoundary(to, true)),
      ),
    [data.workshops, search, status, location, categoryFilter, available, from, to],
  );

  if (!ready)
    return (
      <main className="loading">
        <div className="brand-mark brand-mark-lg">
          <GatherEmblem size={30} />
        </div>
        <p>Opening your workshop desk…</p>
      </main>
    );

  if (!profile)
    return (
      <main className="login-page">
        <section className="login-story">
          <div className="login-story-top">
            <GatherLogo />
            <span className="edition-pill">EDITION 04 · WORKSHOP DESK</span>
          </div>
          <div className="story-copy">
            <div className="eyebrow">SPACE FOR SOMETHING NEW</div>
            <h1>
              Good things happen
              <br />
              when we <em className="editorial-italic">gather.</em>
            </h1>
            <p>
              A little creativity. A new skill. A shared experience.
              <br />
              Give your community more room to grow.
            </p>
            <div className="abstract-art" aria-hidden="true">
              <span className="arch arch-one" />
              <span className="arch arch-two" />
              <span className="art-circle" />
              <span className="art-line" />
              <Sprout size={125} />
              <div className="story-floating-card card-one">
                <span className="stat-icon" style={{ width: 34, height: 34, borderRadius: 9 }}>
                  <Sparkles size={16} />
                </span>
                <div>
                  <strong>Ceramic Handbuilding</strong>
                  <small>POT-104 · 12 / 12 seats confirmed</small>
                </div>
              </div>
              <div className="story-floating-card card-two">
                <span className="live-dot" />
                <div>
                  <strong>Botanical Dyeing Studio</strong>
                  <small>Central Studio · 4 seats open</small>
                </div>
              </div>
            </div>
          </div>
          <footer>
            <span>Community workshops, thoughtfully organised.</span>
            <div className="story-pillars">
              <span>01 / REALTIME CAPACITY</span>
              <span>02 / ZERO OVERBOOKING</span>
            </div>
          </footer>
        </section>
        <section className="login-form">
          <div className="eyebrow">YOUR COMMUNITY. CONNECTED.</div>
          <h2>
            Welcome to the <em className="editorial-italic">desk.</em>
          </h2>
          <p>Sign in to manage your community’s workshops, seats, and roster.</p>
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
    seats = active.reduce((n, w) => n + w.capacity - w.active_count, 0),
    totalCapacity = total + seats,
    occupancyRate = totalCapacity > 0 ? Math.round((total / totalCapacity) * 100) : 0;

  const auditFiltered = data.audit.filter((a) =>
    operational
      ? !["account_created", "role_changed"].includes(a.action)
      : ["account_created", "role_changed"].includes(a.action),
  );

  const filteredRegistrations = data.registrations.filter(
    (r) =>
      (regStatusFilter === "all" || r.status === regStatusFilter) &&
      (
        r.attendee_name +
        " " +
        r.attendee_email +
        " " +
        (data.workshops.find((w) => w.id === r.workshop_id)?.title || "") +
        " " +
        (data.workshops.find((w) => w.id === r.workshop_id)?.code || "")
      )
        .toLowerCase()
        .includes(search.toLowerCase()),
  );

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <GatherLogo />
        <div className="workspace-label">
          <span>COMMUNITY WORKSHOP DESK</span>
        </div>
        <nav>
          {(operational
            ? [
                ["Workshops", LayoutGrid, data.workshops.length],
                ["Registrations", ClipboardList, data.registrations.length],
                ["Activity", History, auditFiltered.length],
              ]
            : [
                ["Team", Users, data.users.length],
                ["Activity", History, auditFiltered.length],
              ]
          ).map(([label, Icon, count]) => {
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
                <NavIcon size={18} />
                {String(label)}
                <span>{Number(count)}</span>
              </button>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card">
            <span className="help-icon">
              <Sprout size={18} />
            </span>
            <h4>A little room to grow.</h4>
            <p>
              Bring people together.
              <br />
              We’ll keep track of the seats.
            </p>
            {operational && totalCapacity > 0 && (
              <div className="sidebar-capacity-mini">
                <div>
                  <small>Programme fill</small>
                  <strong>{occupancyRate}%</strong>
                </div>
                <div className="progress">
                  <span style={{ width: `${occupancyRate}%` }} />
                </div>
              </div>
            )}
          </div>
          <div className="user-block">
            <div className="avatar">{initials(profile.name)}</div>
            <div>
              <strong>{profile.name}</strong>
              <small>{profile.role}</small>
            </div>
            <button onClick={signout} title="Sign out" aria-label="Sign out">
              <LogOut size={16} />
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
            <span className="topbar-meta-pill">
              <span className="live-dot" />
              Staff workspace
            </span>
            <button
              aria-label="Refresh data"
              title="Refresh data"
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
                {page === "Workshops" ? (
                  <>
                    Your next great{" "}
                    <em className="editorial-italic">gathering.</em>
                  </>
                ) : page === "Registrations" ? (
                  <>
                    Every seat has a{" "}
                    <em className="editorial-italic">story.</em>
                  </>
                ) : page === "Team" ? (
                  <>
                    A good team starts{" "}
                    <em className="editorial-italic">here.</em>
                  </>
                ) : (
                  <>
                    The story <em className="editorial-italic">so far.</em>
                  </>
                )}
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
                  <div style={{ flex: 1 }}>
                    <small>Upcoming workshops</small>
                    <strong>
                      {active.length}
                      <span>on the calendar</span>
                    </strong>
                    <div className="stat-bar">
                      <span
                        style={{
                          width: `${data.workshops.length ? Math.max(18, Math.round((active.length / data.workshops.length) * 100)) : 35}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <span className="stat-icon">
                    <Users />
                  </span>
                  <div style={{ flex: 1 }}>
                    <small>Confirmed attendees</small>
                    <strong>
                      {total}
                      <span>ready to join in</span>
                    </strong>
                    <div className="stat-bar">
                      <span style={{ width: `${Math.max(12, occupancyRate)}%` }} />
                    </div>
                  </div>
                </div>
                <div>
                  <span className="stat-icon">
                    <Sprout />
                  </span>
                  <div style={{ flex: 1 }}>
                    <small>Seats still available</small>
                    <strong>
                      {seats}
                      <span>room for more</span>
                    </strong>
                    <div className="stat-bar">
                      <span
                        style={{
                          width: `${totalCapacity > 0 ? Math.max(12, 100 - occupancyRate) : 65}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
              <section className="catalogue">
                <div className="section-heading">
                  <h2>
                    Workshop catalogue <span>{filtered.length}</span>
                  </h2>
                  <small>
                    <Clock size={13} /> All times shown in your local timezone
                  </small>
                </div>

                {categories.length > 0 && (
                  <div className="catalogue-toolbar">
                    <div className="category-pills">
                      <button
                        type="button"
                        className={
                          categoryFilter === "all"
                            ? "cat-pill active"
                            : "cat-pill"
                        }
                        onClick={() => setCategoryFilter("all")}
                      >
                        All themes
                      </button>
                      {categories.map((cat) => (
                        <button
                          type="button"
                          key={cat}
                          className={
                            categoryFilter === cat
                              ? "cat-pill active"
                              : "cat-pill"
                          }
                          onClick={() =>
                            setCategoryFilter(
                              categoryFilter === cat ? "all" : cat,
                            )
                          }
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                    <div className="view-toggle" role="group" aria-label="Catalogue layout">
                      <button
                        type="button"
                        className={viewMode === "grid" ? "active" : ""}
                        onClick={() => setViewMode("grid")}
                      >
                        <LayoutGrid size={14} />
                        Gallery
                      </button>
                      <button
                        type="button"
                        className={viewMode === "list" ? "active" : ""}
                        onClick={() => setViewMode("list")}
                      >
                        <Rows3 size={14} />
                        Schedule
                      </button>
                    </div>
                  </div>
                )}

                <div className="filters">
                  <div className="search">
                    <Search size={17} />
                    <input
                      aria-label="Search workshops"
                      placeholder="Search workshops, codes, instructors…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                    {search && (
                      <button
                        type="button"
                        aria-label="Clear search"
                        style={{
                          border: 0,
                          background: "none",
                          color: "#889480",
                          padding: 4,
                        }}
                        onClick={() => setSearch("")}
                      >
                        <X size={14} />
                      </button>
                    )}
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
                  <div className="date-filter-item">
                    <span>From</span>
                    <BotanicalDatePicker
                      ariaLabel="From date"
                      placeholder="Start date"
                      value={from}
                      onChange={setFrom}
                    />
                  </div>
                  <span>—</span>
                  <div className="date-filter-item">
                    <span>To</span>
                    <BotanicalDatePicker
                      ariaLabel="To date"
                      placeholder="End date"
                      value={to}
                      min={from}
                      onChange={setTo}
                    />
                  </div>
                  {(from ||
                    to ||
                    available ||
                    search ||
                    categoryFilter !== "all" ||
                    status !== "all" ||
                    location !== "all") && (
                    <button
                      onClick={() => {
                        setFrom("");
                        setTo("");
                        setSearch("");
                        setStatus("all");
                        setLocation("all");
                        setCategoryFilter("all");
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
                <div
                  className={
                    viewMode === "list"
                      ? "workshop-grid list-view"
                      : "workshop-grid"
                  }
                >
                  {filtered.map((w, i) => {
                    const full = w.active_count >= w.capacity,
                      closed =
                        w.status !== "scheduled" ||
                        new Date(w.starts_at) <= new Date(),
                      artTheme =
                        w.category === "Technology"
                          ? "code"
                          : w.category === "Wellbeing"
                            ? "well"
                            : w.category === "Food & Living"
                              ? "food"
                              : i % 2
                                ? "paint"
                                : "clay";
                    return (
                      <article className="workshop-card" key={w.id}>
                        <div className={`card-art art-${artTheme}`}>
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
                          <div>
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
                          </div>
                          <div>
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
                                  width: `${Math.min(100, (w.active_count / w.capacity) * 100)}%`,
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
                <div className="category-pills">
                  {(["all", "active", "cancelled"] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      className={
                        regStatusFilter === st ? "cat-pill active" : "cat-pill"
                      }
                      onClick={() => setRegStatusFilter(st)}
                    >
                      {st === "all"
                        ? "All records"
                        : st === "active"
                          ? "Active"
                          : "Cancelled"}
                    </button>
                  ))}
                </div>
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
                    {filteredRegistrations.map((r) => {
                      const workshop = data.workshops.find(
                        (w) => w.id === r.workshop_id,
                      );
                      return (
                        <tr key={r.id}>
                          <td>
                            <div className="table-person">
                              <span className="avatar">
                                {initials(r.attendee_name)}
                              </span>
                              <div>
                                <strong>{r.attendee_name}</strong>
                                <small>{r.attendee_email}</small>
                              </div>
                            </div>
                          </td>
                          <td>
                            {workshop ? (
                              <div>
                                <strong>{workshop.title}</strong>
                                <small>{workshop.code}</small>
                              </div>
                            ) : (
                              "—"
                            )}
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
                      );
                    })}
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
                            <span className="avatar">{initials(u.name)}</span>
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
                  Activity log <span>{auditFiltered.length}</span>
                </h2>
                <small>History is preserved automatically</small>
              </div>
              {auditFiltered.map((a) => (
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
            <div
              className={`detail-art-banner card-art art-${
                current.category === "Technology"
                  ? "code"
                  : current.category === "Wellbeing"
                    ? "well"
                    : current.category === "Food & Living"
                      ? "food"
                      : "clay"
              }`}
            >
              <span className="category">{current.category}</span>
              <span
                className={`badge ${
                  current.active_count >= current.capacity
                    ? "full"
                    : current.status !== "scheduled" ||
                        new Date(current.starts_at) <= new Date()
                      ? "closed"
                      : ""
                }`}
              >
                {current.status !== "scheduled" ||
                new Date(current.starts_at) <= new Date()
                  ? human(current.status)
                  : current.active_count >= current.capacity
                    ? "Fully booked"
                    : "Open for registration"}
              </span>
              <div className="art-shape">
                <span />
                <span />
                <span />
              </div>
            </div>
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
              <div className="detail-capacity-main">
                <strong>{current.capacity - current.active_count}</strong>
                <span>of {current.capacity} seats available</span>
              </div>
              {current.capacity <= 40 && (
                <div className="seat-matrix" aria-hidden="true">
                  {Array.from({ length: current.capacity }, (_, idx) => (
                    <span
                      key={idx}
                      className={
                        idx < current.active_count
                          ? "seat-dot occupied"
                          : "seat-dot"
                      }
                    />
                  ))}
                </div>
              )}
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
                  <div className="form-row form-row-datetime">
                    <div className="field-group">
                      <span className="field-label">Date & time</span>
                      <BotanicalDateTimePicker
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
                    </div>
                    <div className="field-group">
                      <span className="field-label">Duration (minutes)</span>
                      <BotanicalNumberStepper
                        name="duration_minutes"
                        min={15}
                        max={720}
                        step={15}
                        defaultValue={editing?.duration_minutes || 90}
                        presets={[60, 90, 120, 180]}
                      />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="field-group">
                      <span className="field-label">Capacity</span>
                      <BotanicalNumberStepper
                        name="capacity"
                        min={editing?.active_count || 1}
                        max={1000}
                        step={1}
                        defaultValue={editing?.capacity || 12}
                      />
                    </div>
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
