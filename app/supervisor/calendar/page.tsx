"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabase, requireSupervisor } from "@/lib/supabase";
import { parseRequestedDates } from "@/lib/parse-dates";
import SupervisorHeader, { StatStrip } from "@/components/supervisor-header";

const NAVY = "#1a4480";
const SOFT_BG = "#f2f5fa";
const WHITE = "#ffffff";
const MUTED = "#5b6474";
const BORDER = "#dbe2ec";
const TEXT = "#0f172a";

interface Row {
  id: string;
  officer_name: string;
  absence_type: string | null;
  reason: string | null;
  dates_requested: string;
  requested_dates: string[] | null;
  dates_need_review: boolean | null;
  status: string;
  submitted_at: string;
}

interface Req extends Row { dates: string[]; needsCheck: boolean }

const STATUS: Record<string, { label: string; bg: string; fg: string; border: string; dot: string }> = {
  pending: { label: "Pending", bg: "#fff7e0", fg: "#8a5a00", border: "#f5c451", dot: "#e0a300" },
  approved: { label: "Approved", bg: "#e6f6ec", fg: "#146c34", border: "#8fd4a8", dot: "#16a34a" },
  rejected: { label: "Denied", bg: "#fdecec", fg: "#a61b1b", border: "#f4a5a5", dot: "#dc2626" },
};
const statusOf = (s: string) => STATUS[s] || STATUS.pending;

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const pad = (n: number) => String(n).padStart(2, "0");
const isoOf = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const todayIso = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
const nice = (d: string, opts: Intl.DateTimeFormatOptions = { weekday: "long", month: "long", day: "numeric" }) =>
  new Date(`${d}T12:00:00`).toLocaleDateString("en-US", opts);

function monthCells(year: number, month: number): (string | null)[] {
  const first = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = Array(first).fill(null);
  for (let d = 1; d <= days; d++) cells.push(isoOf(year, month, d));
  while (cells.length % 7) cells.push(null);
  return cells;
}

export default function TimeOffCalendar() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const now = todayIso();
  const [cursor, setCursor] = useState(() => ({ y: +now.slice(0, 4), m: +now.slice(5, 7) - 1 }));
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [openReq, setOpenReq] = useState<Req | null>(null);
  const [fixing, setFixing] = useState<Req | null>(null);

  const load = async () => {
    const { data, error: dbError } = await getSupabase()
      .from("time_off_requests")
      .select("id, officer_name, absence_type, reason, dates_requested, requested_dates, dates_need_review, status, submitted_at")
      .order("submitted_at", { ascending: false });
    if (dbError) setError("Couldn't load time-off requests. Refresh to try again.");
    else setRows((data as Row[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    requireSupervisor().then((u) => { if (u) load(); });
  }, []);

  // Every request with its calendar dates. Older rows without saved dates are
  // read from the typed text on the fly.
  const requests: Req[] = useMemo(() => rows.map((r) => {
    if (r.requested_dates && r.requested_dates.length) return { ...r, dates: r.requested_dates, needsCheck: !!r.dates_need_review };
    const p = parseRequestedDates(r.dates_requested, r.submitted_at);
    return { ...r, dates: p.dates, needsCheck: !p.confident };
  }), [rows]);

  const visible = requests.filter((r) => filter === "all" || (r.status || "pending") === filter);
  const byDay = useMemo(() => {
    const map = new Map<string, Req[]>();
    // Duplicate submissions from the same officer show once per day, keeping
    // the most decided one (approved, then pending, then denied).
    const rank = (r: Req) => (r.status === "approved" ? 0 : r.status === "rejected" ? 2 : 1);
    const key = (name: string) => name.toLowerCase().replace(/[^a-z]/g, "");
    for (const r of visible) for (const d of r.dates) {
      if (!map.has(d)) map.set(d, []);
      const list = map.get(d)!;
      const i = list.findIndex((x) => key(x.officer_name) === key(r.officer_name));
      if (i === -1) list.push(r);
      else if (rank(r) < rank(list[i])) list[i] = r;
    }
    map.forEach((list) => list.sort((a, b) => a.officer_name.localeCompare(b.officer_name)));
    return map;
  }, [visible]);

  const needsCheck = requests.filter((r) => r.needsCheck && r.status !== "rejected");
  const cells = monthCells(cursor.y, cursor.m);
  const monthLabel = new Date(cursor.y, cursor.m, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const move = (delta: number) => setCursor((c) => {
    const d = new Date(c.y, c.m + delta, 1);
    return { y: d.getFullYear(), m: d.getMonth() };
  });

  // Next 30 days, for the list under the calendar.
  const upcoming: [string, Req[]][] = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date(`${now}T12:00:00`);
    d.setDate(d.getDate() + i);
    const key = isoOf(d.getFullYear(), d.getMonth(), d.getDate());
    const list = byDay.get(key);
    if (list?.length) upcoming.push([key, list]);
  }

  const saveDates = async (req: Req, dates: string[]) => {
    const { error: dbError } = await getSupabase()
      .from("time_off_requests")
      .update({ requested_dates: dates.length ? dates : null, dates_need_review: dates.length === 0 })
      .eq("id", req.id);
    if (dbError) return "Couldn't save. Check your connection and try again.";
    setRows((rs) => rs.map((r) => (r.id === req.id ? { ...r, requested_dates: dates.length ? dates : null, dates_need_review: dates.length === 0 } : r)));
    return "";
  };

  if (loading) {
    return <div style={{ minHeight: "100vh", background: SOFT_BG, display: "flex", alignItems: "center", justifyContent: "center", color: MUTED, fontFamily: "var(--font-sans)" }}>Loading calendar…</div>;
  }

  const dayList = selectedDay ? byDay.get(selectedDay) || [] : [];

  return (
    <div style={{ minHeight: "100vh", background: SOFT_BG, fontFamily: "var(--font-sans)", padding: "1.25rem 0.75rem 3rem" }}>
      <style>{`
        .cal-grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); }
        .cal-cell { min-height: 108px; }
        .cal-pill { display: block; }
        .cal-dots { display: none; }
        @media (max-width: 700px) {
          .cal-cell { min-height: 62px; }
          .cal-pill, .cal-more { display: none !important; }
          .cal-dots { display: flex; }
        }
      `}</style>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>

        <SupervisorHeader title="Time-off calendar" subtitle="Every request, whatever its status" active="calendar" />

        <div style={{ background: WHITE, borderRadius: "0 0 16px 16px", boxShadow: "0 10px 30px rgba(15,23,42,0.08), 0 1px 3px rgba(15,23,42,0.06)", padding: "1rem 1rem 1.25rem" }}>
          {error && <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", color: "#b91c1c", borderRadius: 12, padding: "0.75rem 1rem", marginBottom: "1rem" }}>{error}</div>}

          {needsCheck.length > 0 && (
            <div style={{ background: "#fff7ed", border: "1px solid #fdba74", borderRadius: 12, padding: "0.85rem 1rem", marginBottom: "1rem" }}>
              <div style={{ fontWeight: 700, color: "#9a3412", marginBottom: 6 }}>
                ⚠️ {needsCheck.length === 1 ? "1 request needs its dates checked" : `${needsCheck.length} requests need their dates checked`}
              </div>
              <div style={{ fontSize: "0.88rem", color: "#9a3412", marginBottom: 8 }}>We couldn&apos;t read these dates for sure. Tap one to confirm or fix it.</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {needsCheck.map((r) => (
                  <button key={r.id} type="button" onClick={() => setFixing(r)} style={{ textAlign: "left", background: WHITE, border: "1px solid #fed7aa", borderRadius: 10, padding: "0.6rem 0.8rem", cursor: "pointer", fontFamily: "inherit", display: "flex", gap: 10, alignItems: "center", minHeight: 0 }}>
                    <span style={{ flex: 1 }}>
                      <strong style={{ color: TEXT }}>{r.officer_name}</strong>
                      <span style={{ color: MUTED }}> wrote “{r.dates_requested.trim()}”</span>
                    </span>
                    <span style={{ color: NAVY, fontWeight: 700, fontSize: "0.88rem", whiteSpace: "nowrap" }}>Check dates ›</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.85rem" }}>
            <button type="button" onClick={() => move(-1)} style={navBtn} aria-label="Previous month">‹</button>
            <div style={{ fontSize: "1.2rem", fontWeight: 700, color: TEXT, minWidth: 170, textAlign: "center" }}>{monthLabel}</div>
            <button type="button" onClick={() => move(1)} style={navBtn} aria-label="Next month">›</button>
            <button type="button" onClick={() => setCursor({ y: +now.slice(0, 4), m: +now.slice(5, 7) - 1 })} style={{ ...navBtn, width: "auto", padding: "0 0.9rem", fontSize: "0.88rem" }}>Today</button>
            <div style={{ flex: 1 }} />
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {(["all", "pending", "approved", "rejected"] as const).map((f) => (
                <button key={f} type="button" onClick={() => setFilter(f)} style={{
                  minHeight: 36, padding: "0.3rem 0.8rem", borderRadius: 999, fontFamily: "inherit", fontSize: "0.85rem", fontWeight: 600, cursor: "pointer",
                  border: `1.5px solid ${filter === f ? NAVY : BORDER}`, background: filter === f ? NAVY : WHITE, color: filter === f ? WHITE : TEXT,
                  display: "inline-flex", alignItems: "center", gap: 6,
                }}>
                  {f !== "all" && <span style={{ width: 8, height: 8, borderRadius: 99, background: statusOf(f).dot }} />}
                  {f === "all" ? "All" : statusOf(f).label}
                </button>
              ))}
            </div>
          </div>

          <div className="cal-grid" style={{ border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden" }}>
            {WEEKDAYS.map((w) => (
              <div key={w} style={{ background: SOFT_BG, padding: "0.45rem 0.25rem", textAlign: "center", fontSize: "0.75rem", fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: `1px solid ${BORDER}` }}>{w}</div>
            ))}
            {cells.map((d, i) => {
              const list = d ? byDay.get(d) || [] : [];
              const isToday = d === now;
              const busy = list.length >= 3;
              return (
                <div
                  key={i}
                  className="cal-cell"
                  onClick={() => d && setSelectedDay(d === selectedDay ? null : d)}
                  style={{
                    borderRight: (i + 1) % 7 ? `1px solid ${BORDER}` : "none",
                    borderTop: i >= 7 ? `1px solid ${BORDER}` : "none",
                    padding: "0.3rem",
                    background: !d ? "#fafbfd" : d === selectedDay ? "#eaf1fb" : WHITE,
                    cursor: d ? "pointer" : "default",
                    minWidth: 0,
                  }}
                >
                  {d && (
                    <>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                        <span style={{
                          fontSize: "0.8rem", fontWeight: isToday ? 800 : 600, color: isToday ? WHITE : TEXT,
                          background: isToday ? NAVY : "transparent", borderRadius: 99, minWidth: 22, height: 22,
                          display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 5px",
                        }}>{+d.slice(8)}</span>
                        {list.length > 0 && (
                          <span title={`${list.length} off`} style={{ fontSize: "0.68rem", fontWeight: 700, color: busy ? "#a61b1b" : MUTED, background: busy ? "#fdecec" : "transparent", borderRadius: 99, padding: "0 5px" }}>{list.length}</span>
                        )}
                      </div>
                      {list.slice(0, 3).map((r) => {
                        const st = statusOf(r.status);
                        return (
                          <button
                            key={r.id}
                            type="button"
                            className="cal-pill"
                            onClick={(e) => { e.stopPropagation(); setOpenReq(r); }}
                            title={`${r.officer_name} · ${st.label}`}
                            style={{ width: "100%", textAlign: "left", background: st.bg, color: st.fg, border: `1px solid ${st.border}`, borderRadius: 6, padding: "1px 5px", marginBottom: 2, fontSize: "0.72rem", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", cursor: "pointer", fontFamily: "inherit", minHeight: 0 }}
                          >
                            {r.needsCheck ? "⚠ " : ""}{r.officer_name}
                          </button>
                        );
                      })}
                      {list.length > 3 && <div className="cal-more" style={{ fontSize: "0.7rem", color: NAVY, fontWeight: 700 }}>+{list.length - 3} more</div>}
                      <div className="cal-dots" style={{ flexWrap: "wrap", gap: 3, marginTop: 2 }}>
                        {list.slice(0, 6).map((r) => <span key={r.id} style={{ width: 7, height: 7, borderRadius: 99, background: statusOf(r.status).dot }} />)}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {selectedDay && (
            <div style={{ marginTop: "1rem", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "0.9rem 1rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ fontWeight: 700, color: TEXT }}>{nice(selectedDay)}</div>
                <button type="button" onClick={() => setSelectedDay(null)} style={linkBtn}>Close</button>
              </div>
              {dayList.length === 0 ? (
                <div style={{ color: MUTED, fontSize: "0.9rem" }}>Nobody has requested this day off.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {dayList.map((r) => <PersonRow key={r.id} r={r} onOpen={() => setOpenReq(r)} />)}
                </div>
              )}
            </div>
          )}

          <div style={{ marginTop: "1.5rem" }}>
            <div style={{ fontSize: "1.05rem", fontWeight: 700, color: TEXT, marginBottom: 8 }}>Next 30 days</div>
            {upcoming.length === 0 ? (
              <div style={{ color: MUTED, fontSize: "0.9rem" }}>No time off requested in the next 30 days.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {upcoming.map(([d, list]) => (
                  <div key={d}>
                    <div style={{ fontSize: "0.85rem", fontWeight: 700, color: d === now ? NAVY : MUTED, marginBottom: 4 }}>
                      {d === now ? "Today · " : ""}{nice(d)} <span style={{ fontWeight: 500 }}>· {list.length} off</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                      {list.map((r) => <PersonRow key={r.id} r={r} onOpen={() => setOpenReq(r)} />)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {openReq && (
        <Sheet onClose={() => setOpenReq(null)}>
          <RequestDetails r={openReq} onFix={() => { setFixing(openReq); setOpenReq(null); }} />
        </Sheet>
      )}

      {fixing && (
        <Sheet onClose={() => setFixing(null)}>
          <FixDates r={fixing} onCancel={() => setFixing(null)} onSave={async (dates) => {
            const err = await saveDates(fixing, dates);
            if (!err) setFixing(null);
            return err;
          }} />
        </Sheet>
      )}
    </div>
  );
}

function PersonRow({ r, onOpen }: { r: Req; onOpen: () => void }) {
  const st = statusOf(r.status);
  return (
    <button type="button" onClick={onOpen} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", background: WHITE, border: `1px solid ${BORDER}`, borderLeft: `4px solid ${st.dot}`, borderRadius: 10, padding: "0.55rem 0.8rem", cursor: "pointer", fontFamily: "inherit", minHeight: 0 }}>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontWeight: 700, color: TEXT, fontSize: "0.95rem" }}>{r.needsCheck ? "⚠ " : ""}{r.officer_name}</span>
        {r.absence_type && <span style={{ display: "block", fontSize: "0.8rem", color: MUTED }}>{r.absence_type}</span>}
      </span>
      <span style={{ fontSize: "0.72rem", fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: st.bg, color: st.fg, border: `1px solid ${st.border}`, textTransform: "capitalize", letterSpacing: "0.04em" }}>{st.label}</span>
    </button>
  );
}

function RequestDetails({ r, onFix }: { r: Req; onFix: () => void }) {
  const st = statusOf(r.status);
  const href = r.status === "pending" ? `/timeoff/approve?id=${r.id}` : `/timeoff/view?id=${r.id}`;
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <div style={{ flex: 1, fontSize: "1.2rem", fontWeight: 700, color: TEXT }}>{r.officer_name}</div>
        <span style={{ fontSize: "0.75rem", fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: st.bg, color: st.fg, border: `1px solid ${st.border}`, textTransform: "capitalize" }}>{st.label}</span>
      </div>
      <Detail label="Type">{r.absence_type || "—"}</Detail>
      {r.reason && <Detail label="Reason">{r.reason}</Detail>}
      <Detail label="What they wrote">“{r.dates_requested.trim()}”</Detail>
      <Detail label={r.needsCheck ? "Dates on the calendar (please check)" : "Dates on the calendar"}>
        {r.dates.length ? <DateGroups dates={r.dates} /> : <span style={{ color: "#9a3412" }}>None yet: tap Fix dates</span>}
      </Detail>
      <Detail label="Submitted">{new Date(r.submitted_at).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}</Detail>
      <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
        <a href={href} style={{ ...primaryBtn, flex: 1, textAlign: "center", textDecoration: "none" }}>{r.status === "pending" ? "Review & decide" : "Open request"}</a>
        <button type="button" onClick={onFix} style={{ ...secondaryBtn, flex: 1 }}>{r.needsCheck ? "Check dates" : "Fix dates"}</button>
      </div>
    </div>
  );
}

function DateGroups({ dates }: { dates: string[] }) {
  const sorted = [...dates].sort();
  const groups: string[][] = [];
  for (const d of sorted) {
    const last = groups[groups.length - 1];
    if (last && Date.parse(d) - Date.parse(last[last.length - 1]) === 86400000) last.push(d);
    else groups.push([d]);
  }
  const f = (d: string) => nice(d, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  return <>{groups.map((g) => <div key={g[0]}>{g.length === 1 ? f(g[0]) : `${f(g[0])} – ${f(g[g.length - 1])} (${g.length} days)`}</div>)}</>;
}

function FixDates({ r, onCancel, onSave }: { r: Req; onCancel: () => void; onSave: (dates: string[]) => Promise<string> }) {
  const [picked, setPicked] = useState<Set<string>>(new Set(r.dates));
  const start = r.dates.length ? [...r.dates].sort()[0] : todayIso();
  const [cur, setCur] = useState({ y: +start.slice(0, 4), m: +start.slice(5, 7) - 1 });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const cells = monthCells(cur.y, cur.m);
  const toggle = (d: string) => setPicked((p) => { const n = new Set(p); if (n.has(d)) n.delete(d); else n.add(d); return n; });
  const move = (delta: number) => setCur((c) => { const d = new Date(c.y, c.m + delta, 1); return { y: d.getFullYear(), m: d.getMonth() }; });

  return (
    <div>
      <div style={{ fontSize: "1.15rem", fontWeight: 700, color: TEXT }}>Dates for {r.officer_name}</div>
      <div style={{ background: SOFT_BG, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "0.6rem 0.8rem", margin: "0.6rem 0 0.9rem", fontSize: "0.9rem", color: TEXT }}>
        <span style={{ color: MUTED }}>They wrote: </span>“{r.dates_requested.trim()}”
      </div>
      <div style={{ fontSize: "0.88rem", color: MUTED, marginBottom: 8 }}>Tap days to add or remove them.</div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <button type="button" onClick={() => move(-1)} style={navBtn} aria-label="Previous month">‹</button>
        <div style={{ fontWeight: 700, color: TEXT }}>{new Date(cur.y, cur.m, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" })}</div>
        <button type="button" onClick={() => move(1)} style={navBtn} aria-label="Next month">›</button>
      </div>
      <div className="cal-grid" style={{ gap: 4 }}>
        {WEEKDAYS.map((w) => <div key={w} style={{ textAlign: "center", fontSize: "0.7rem", color: MUTED, fontWeight: 700 }}>{w[0]}</div>)}
        {cells.map((d, i) => d ? (
          <button key={i} type="button" onClick={() => toggle(d)} aria-pressed={picked.has(d)} style={{
            height: 40, borderRadius: 10, border: `1.5px solid ${picked.has(d) ? NAVY : BORDER}`, background: picked.has(d) ? NAVY : WHITE,
            color: picked.has(d) ? WHITE : TEXT, fontWeight: 700, fontFamily: "inherit", fontSize: "0.9rem", cursor: "pointer", minHeight: 0, padding: 0,
          }}>{+d.slice(8)}</button>
        ) : <div key={i} />)}
      </div>
      <div style={{ marginTop: 10, fontSize: "0.88rem", color: TEXT }}>
        {picked.size === 0 ? <span style={{ color: MUTED }}>No days picked.</span> : <><strong>{picked.size} day{picked.size === 1 ? "" : "s"}:</strong> <DateGroups dates={Array.from(picked)} /></>}
      </div>
      {err && <div style={{ color: "#b91c1c", fontSize: "0.88rem", marginTop: 8 }}>{err}</div>}
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button type="button" onClick={onCancel} style={{ ...secondaryBtn, flex: 1 }}>Cancel</button>
        <button type="button" disabled={saving} onClick={async () => { setSaving(true); setErr(await onSave(Array.from(picked).sort())); setSaving(false); }} style={{ ...primaryBtn, flex: 2, opacity: saving ? 0.7 : 1 }}>
          {saving ? "Saving…" : "Save dates"}
        </button>
      </div>
    </div>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: "0.75rem", fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: "0.95rem", color: TEXT, lineHeight: 1.5 }}>{children}</div>
    </div>
  );
}

function Sheet({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", zIndex: 900, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" style={{ background: WHITE, width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto", borderRadius: "18px 18px 0 0", padding: "1.25rem 1.25rem calc(1.25rem + env(safe-area-inset-bottom))", boxShadow: "0 -10px 40px rgba(15,23,42,0.2)", marginBottom: 0 }}>
        <div style={{ width: 40, height: 4, borderRadius: 99, background: BORDER, margin: "0 auto 12px" }} />
        {children}
      </div>
    </div>
  );
}

const headerLink: React.CSSProperties = { color: "rgba(255,255,255,0.85)", fontSize: "0.85rem", textDecoration: "none", fontWeight: 600 };
const navBtn: React.CSSProperties = { width: 38, height: 38, borderRadius: 10, border: `1px solid ${BORDER}`, background: WHITE, color: TEXT, fontSize: "1.2rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", minHeight: 0, padding: 0 };
const linkBtn: React.CSSProperties = { background: "none", border: "none", color: NAVY, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", fontSize: "0.88rem", padding: 0, minHeight: 0 };
const primaryBtn: React.CSSProperties = { background: NAVY, color: WHITE, border: "none", borderRadius: 12, padding: "0.8rem 1rem", fontWeight: 700, fontSize: "0.95rem", fontFamily: "inherit", cursor: "pointer" };
const secondaryBtn: React.CSSProperties = { background: WHITE, color: NAVY, border: `1.5px solid ${NAVY}`, borderRadius: 12, padding: "0.8rem 1rem", fontWeight: 700, fontSize: "0.95rem", fontFamily: "inherit", cursor: "pointer" };
