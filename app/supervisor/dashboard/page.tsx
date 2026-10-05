"use client";

import { useState, useEffect } from "react";
import { getSupabase, requireSupervisor } from "@/lib/supabase";
import SupervisorHeader, { StatStrip } from "@/components/supervisor-header";

const NAVY = "#1a4480";
const DARK = "#243b5e";
const SOFT_BG = "#f2f5fa";
const WHITE = "#ffffff";
const MUTED = "#5b6474";
const BORDER = "#dbe2ec";
const TEXT = "#0f172a";
const GREEN = "#15803d";

interface Stats {
  pendingTimeOff: number;
  recentCallOffs: number;
  pendingDisciplinary: number;
  pendingCallOffReview: number;
  darsTotal: number;
  callOffsTotal: number;
  unexcusedCallOffs: number;
}

interface RecentItem {
  id: string;
  type: string;
  name: string;
  detail: string;
  time: string;
  status?: string;
}

export default function Dashboard() {
  const [user, setUser] = useState<{ email: string } | null>(null);
  const [stats, setStats] = useState<Stats>({ pendingTimeOff: 0, recentCallOffs: 0, pendingDisciplinary: 0, pendingCallOffReview: 0, darsTotal: 0, callOffsTotal: 0, unexcusedCallOffs: 0 });
  const [recent, setRecent] = useState<RecentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [offToday, setOffToday] = useState<{ id: string; officer_name: string; status: string }[]>([]);
  const [calloffsToday, setCalloffsToday] = useState<{ id: string; officer_name: string; post: string; shift_start: string }[]>([]);
  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });

  const formatTime = (iso: string) => {
    if (!iso) return "";
    return new Date(iso).toLocaleString("en-US", { month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
  };

  useEffect(() => {
    requireSupervisor("/supervisor").then((u) => {
      if (!u) return;
      setUser({ email: u.email || "" });
      loadDashboard();
    });
  }, []);

  const loadDashboard = () => {
    const supabase = getSupabase();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    Promise.all([
      supabase.from("time_off_requests").select("id, officer_name, absence_type, dates_requested, status, submitted_at").eq("status", "pending").order("submitted_at", { ascending: false }).limit(5),
      supabase.from("calloff_submissions").select("id, officer_name, post, shift_date, notice_type, submitted_at, excusal_status").order("submitted_at", { ascending: false }).limit(5),
      supabase.from("disciplinary_records").select("id, officer_name, infraction, action_type, signature, submitted_at").is("signature", null).order("submitted_at", { ascending: false }).limit(5),
      supabase.from("time_off_requests").select("id", { count: "exact" }).eq("status", "pending"),
      supabase.from("calloff_submissions").select("id", { count: "exact" }).gte("submitted_at", sevenDaysAgo),
      supabase.from("disciplinary_records").select("id", { count: "exact" }).is("signature", null),
      supabase.from("dar_submissions").select("id", { count: "exact" }),
      supabase.from("calloff_submissions").select("id", { count: "exact" }),
      supabase.from("calloff_submissions").select("id", { count: "exact" }).eq("excusal_status", "unexcused"),
      supabase.from("calloff_submissions").select("id", { count: "exact" }).or("excusal_status.is.null,excusal_status.eq.pending"),
      supabase.from("time_off_requests").select("id, officer_name, status").contains("requested_dates", [todayStr]).neq("status", "rejected"),
      supabase.from("calloff_submissions").select("id, officer_name, post, shift_start").eq("shift_date", todayStr).order("shift_start"),
    ]).then(([timeOff, callOffs, disciplinary, toCount, coCount, discCount, darTotal, coTotal, unexcused, pendingReview, offT, coT]) => {
      // Same officer can have duplicate requests; show each name once.
      const seen = new Set<string>();
      setOffToday(((offT.data || []) as { id: string; officer_name: string; status: string }[]).filter((r) => { const k = r.officer_name.toLowerCase().replace(/[^a-z]/g, ""); if (seen.has(k)) return false; seen.add(k); return true; }));
      setCalloffsToday((coT.data || []) as { id: string; officer_name: string; post: string; shift_start: string }[]);
      setStats({
        pendingTimeOff: toCount.count || 0,
        recentCallOffs: coCount.count || 0,
        pendingDisciplinary: discCount.count || 0,
        pendingCallOffReview: pendingReview.count || 0,
        darsTotal: darTotal.count || 0,
        callOffsTotal: coTotal.count || 0,
        unexcusedCallOffs: unexcused.count || 0,
      });

      const items: RecentItem[] = [
        ...(timeOff.data || []).map((r) => ({ id: r.id, type: "time-off", name: r.officer_name, detail: `${r.absence_type} — ${r.dates_requested}`, time: formatTime(r.submitted_at), status: r.status })),
        ...(callOffs.data || []).map((r) => ({ id: r.id, type: "calloff", name: r.officer_name, detail: `${r.post} — ${r.notice_type}`, time: formatTime(r.submitted_at) })),
        ...(disciplinary.data || []).map((r) => ({ id: r.id, type: "disciplinary", name: r.officer_name, detail: r.infraction || r.action_type || "Disciplinary notice", time: formatTime(r.submitted_at), status: r.signature ? "acknowledged" : "pending" })),
      ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 10);

      setRecent(items);
      setLoading(false);
    });
  };

  const handleSignOut = async () => {
    const supabase = getSupabase();
    await supabase.auth.signOut();
    window.location.href = "/supervisor";
  };

  const typeConfig: Record<string, { label: string; color: string; bg: string; link: (id: string) => string }> = {
    "time-off": { label: "Time off", color: NAVY, bg: "#eaf1fb", link: () => `/timeoff/requests` },
    "calloff": { label: "Call-off", color: "#92400e", bg: "#fff3cd", link: () => `/supervisor/calloffs` },
    "disciplinary": { label: "Write-up", color: "#b91c1c", bg: "#fef2f2", link: () => `/writeup/records` },
  };

  return (
    <div style={{ minHeight: "100vh", background: SOFT_BG, fontFamily: "var(--font-sans)" }}>

      <SupervisorHeader title="Dashboard" active="dashboard" right={<button onClick={handleSignOut} style={{ background: "none", border: "1px solid rgba(255,255,255,0.35)", color: "#fff", borderRadius: 999, padding: "0.3rem 0.75rem", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", minHeight: 0, whiteSpace: "nowrap", flexShrink: 0 }}>Sign out</button>} rounded={false} />

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "1rem 0.75rem 2rem" }}>

        {/* Today at a glance */}
        <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 16, padding: "1rem 1.1rem", marginBottom: "1rem", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "0.5rem", marginBottom: "0.75rem" }}>
            <div style={{ fontSize: "1.15rem", fontWeight: 700, color: TEXT }}>Today</div>
            <div style={{ fontSize: "0.85rem", color: MUTED }}>{new Date(`${todayStr}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</div>
          </div>
          <div className="grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <a href="/supervisor/calendar" style={{ textDecoration: "none", background: SOFT_BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "0.8rem 0.9rem", display: "block" }}>
              <div style={{ fontSize: "0.88rem", fontWeight: 700, color: NAVY, marginBottom: 6 }}>Off today ({loading ? "…" : offToday.length}) ›</div>
              {loading ? <div style={{ color: MUTED, fontSize: "0.88rem" }}>Loading…</div> : offToday.length === 0 ? (
                <div style={{ color: MUTED, fontSize: "0.88rem" }}>Nobody has time off today.</div>
              ) : offToday.map((r) => (
                <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.92rem", color: TEXT, padding: "2px 0" }}>
                  <span style={{ width: 8, height: 8, borderRadius: 99, background: r.status === "approved" ? "#16a34a" : "#e0a300", flexShrink: 0 }} />
                  {r.officer_name}
                  <span style={{ color: MUTED, fontSize: "0.8rem" }}>{r.status === "approved" ? "approved" : "pending"}</span>
                </div>
              ))}
            </a>
            <a href="/supervisor/calloffs" style={{ textDecoration: "none", background: SOFT_BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "0.8rem 0.9rem", display: "block" }}>
              <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "#92400e", marginBottom: 6 }}>Called off today ({loading ? "…" : calloffsToday.length}) ›</div>
              {loading ? <div style={{ color: MUTED, fontSize: "0.88rem" }}>Loading…</div> : calloffsToday.length === 0 ? (
                <div style={{ color: MUTED, fontSize: "0.88rem" }}>No call-offs for today.</div>
              ) : calloffsToday.map((r) => (
                <div key={r.id} style={{ fontSize: "0.92rem", color: TEXT, padding: "2px 0" }}>
                  {r.officer_name} <span style={{ color: MUTED, fontSize: "0.8rem" }}>· {r.post}{r.shift_start ? ` · ${r.shift_start.replace(":", "")}` : ""}</span>
                </div>
              ))}
            </a>
          </div>
        </div>

        {/* Pending counts */}
        <div className="grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem", marginBottom: "1rem" }}>
          {[
            { label: "Time-off to approve", value: stats.pendingTimeOff, color: NAVY, link: "/timeoff/requests" },
            { label: "Call-offs to review", value: stats.pendingCallOffReview, color: "#92400e", link: "/supervisor/calloffs" },
            { label: "Write-ups awaiting signature", value: stats.pendingDisciplinary, color: "#b91c1c", link: "/writeup/records" },
          ].map((stat) => (
            <a key={stat.label} href={stat.link} style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: "0.9rem 1rem", textDecoration: "none", display: "flex", alignItems: "center", gap: "0.85rem", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
              <div style={{ fontSize: "1.7rem", fontWeight: 800, color: !loading && stat.value === 0 ? "#94a3b8" : stat.color, lineHeight: 1, minWidth: 28 }}>{loading ? "—" : stat.value}</div>
              <div style={{ flex: 1, fontSize: "0.92rem", color: TEXT, fontWeight: 600, lineHeight: 1.3 }}>{stat.label}</div>
              <div style={{ color: MUTED }}>›</div>
            </a>
          ))}
        </div>

        {/* Totals */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1.25rem" }}>
          {[
            ["DARs (all time)", stats.darsTotal, "/dar/report"],
            ["Call-offs (7 days)", stats.recentCallOffs, "/supervisor/calloffs"],
            ["Call-offs (all time)", stats.callOffsTotal, "/supervisor/calloffs"],
            ["Unexcused (all time)", stats.unexcusedCallOffs, "/supervisor/calloffs"],
          ].map(([label, value, href]) => (
            <a key={label as string} href={href as string} style={{ textDecoration: "none", background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 999, padding: "0.35rem 0.85rem", display: "flex", alignItems: "baseline", gap: 6 }}>
              <span style={{ fontWeight: 800, color: TEXT }}>{loading ? "—" : value}</span>
              <span style={{ fontSize: "0.82rem", color: MUTED, fontWeight: 600 }}>{label}</span>
            </a>
          ))}
        </div>

        <div className="grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>

          <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden" }}>
            <div style={{ padding: "0.85rem 1.1rem 0.5rem", fontSize: "1.05rem", fontWeight: 700, color: TEXT }}>Recent activity</div>
            {loading ? (
              <div style={{ padding: "1.5rem", textAlign: "center", color: MUTED, fontSize: "0.82rem" }}>Loading...</div>
            ) : recent.length === 0 ? (
              <div style={{ padding: "1.5rem", textAlign: "center", color: MUTED, fontSize: "0.82rem" }}>No recent activity.</div>
            ) : (
              recent.map((item, i) => {
                const config = typeConfig[item.type];
                return (
                  <a key={i} href={config.link(item.id)} style={{ display: "block", padding: "0.75rem 1.5rem", borderBottom: i < recent.length - 1 ? `1px solid ${BORDER}` : "none", textDecoration: "none", background: WHITE }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: 2 }}>
                          <span style={{ fontSize: "0.78rem", fontWeight: 700, padding: "1px 7px", borderRadius: 999, background: config.bg, color: config.color, textTransform: "capitalize", letterSpacing: "0.04em" }}>{config.label}</span>
                          <span style={{ fontWeight: 700, fontSize: "0.85rem", color: TEXT }}>{item.name}</span>
                        </div>
                        <div style={{ fontSize: "0.76rem", color: MUTED }}>{item.detail}</div>
                      </div>
                      <div style={{ fontSize: "0.7rem", color: MUTED, whiteSpace: "nowrap", marginTop: 2 }}>{item.time}</div>
                    </div>
                  </a>
                );
              })
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden" }}>
              <div style={{ padding: "0.85rem 1.1rem 0", fontSize: "1.05rem", fontWeight: 700, color: TEXT }}>Quick actions</div>
              <div style={{ padding: "1rem 1.5rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {[
                  { label: "File a write-up", href: "/writeup/write", color: "#b91c1c" },
                  { label: "Time-off calendar", href: "/supervisor/calendar", color: NAVY },
                  { label: "Review time-off requests", href: "/timeoff/requests", color: NAVY },
                  { label: "View write-ups", href: "/writeup/records", color: NAVY },
                  { label: "DAR reports", href: "/dar/report", color: GREEN },
                  { label: "Call-off history", href: "/supervisor/calloffs", color: "#92400e" },
                ].map((link) => (
                  <a key={link.label} href={link.href} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.6rem 0.85rem", background: SOFT_BG, border: `1px solid ${BORDER}`, borderRadius: 12, textDecoration: "none", fontSize: "0.85rem", fontWeight: 600, color: link.color }}>
                    {link.label}
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6" />
                  </svg>
                  </a>
                ))}
              </div>
            </div>

            <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden" }}>
              <div style={{ padding: "0.85rem 1.1rem 0", fontSize: "1.05rem", fontWeight: 700, color: TEXT }}>Officer forms</div>
              <div style={{ padding: "1rem 1.5rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {[
                  { label: "Time-off request", href: "/timeoff" },
                  { label: "Daily Activity Report", href: "/dar" },
                  { label: "Call-off", href: "/calloff" },
                  { label: "Write-up response", href: "/writeup" },
                ].map((link) => (
                  <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.6rem 0.85rem", background: SOFT_BG, border: `1px solid ${BORDER}`, borderRadius: 12, textDecoration: "none", fontSize: "0.85rem", fontWeight: 600, color: MUTED }}>
                    {link.label}
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                      <polyline points="15 3 21 3 21 9"/>
                      <line x1="10" y1="14" x2="21" y2="3"/>
                    </svg>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
