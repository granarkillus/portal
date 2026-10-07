"use client";

import { useState, useEffect } from "react";
import { getSupabase, requireSupervisor } from "@/lib/supabase";
import SupervisorHeader, { StatStrip } from "@/components/supervisor-header";
import { C } from "@/lib/theme";
import { fmtDate, fmtTime, fmtStamp } from "@/lib/format";
import { Skeleton } from "@/components/feedback";

const pill: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none", fontSize: "0.85rem", fontWeight: 700, color: C.text, background: C.white, border: "1px solid #dbe2ec", borderRadius: 999, padding: "0.4rem 0.9rem" };

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
  at: string;
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
      supabase.from("time_off_requests").select("id, officer_name, absence_type, dates_requested, status, submitted_at").gte("submitted_at", sevenDaysAgo).order("submitted_at", { ascending: false }).limit(15),
      supabase.from("calloff_submissions").select("id, officer_name, post, shift_date, notice_type, submitted_at, excusal_status").gte("submitted_at", sevenDaysAgo).order("submitted_at", { ascending: false }).limit(15),
      supabase.from("disciplinary_records").select("id, officer_name, infraction, action_type, signature, submitted_at").gte("submitted_at", sevenDaysAgo).order("submitted_at", { ascending: false }).limit(15),
      supabase.from("time_off_requests").select("id", { count: "exact" }).is("printed_at", null),
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
        ...(timeOff.data || []).map((r) => ({ id: r.id, type: "time-off", name: r.officer_name, detail: [r.absence_type, r.dates_requested].filter(Boolean).join(" · "), at: r.submitted_at, status: r.status })),
        ...(callOffs.data || []).map((r) => ({ id: r.id, type: "calloff", name: r.officer_name, detail: [r.post, fmtDate(r.shift_date)].filter(Boolean).join(" · "), at: r.submitted_at })),
        ...(disciplinary.data || []).map((r) => ({ id: r.id, type: "disciplinary", name: r.officer_name, detail: r.infraction || r.action_type || "Write-up", at: r.submitted_at, status: r.signature ? "acknowledged" : "pending" })),
      ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 12);

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
    "time-off": { label: "Time off", color: C.navy, bg: C.navyTint, link: (id) => `/timeoff/view?id=${id}` },
    "calloff": { label: "Call-off", color: C.amber, bg: C.amberTint, link: () => `/supervisor/calloffs?filter=week` },
    "disciplinary": { label: "Write-up", color: C.red, bg: C.redTint, link: (id) => `/writeup/view?id=${id}` },
  };

  return (
    <div style={{ minHeight: "100vh", background: C.softBg, fontFamily: "var(--font-sans)" }}>

      <SupervisorHeader title="Dashboard" active="dashboard" right={<button onClick={handleSignOut} style={{ background: "none", border: "1px solid rgba(255,255,255,0.35)", color: C.white, borderRadius: 999, padding: "0.3rem 0.75rem", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", minHeight: 0, whiteSpace: "nowrap", flexShrink: 0 }}>Sign out</button>} rounded={false} />

      <div style={{ maxWidth: 1040, margin: "0 auto", padding: "1rem 0.75rem 2rem" }}>

        {/* Today at a glance */}
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 16, padding: "1rem 1.1rem", marginBottom: "1rem", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "0.5rem", marginBottom: "0.75rem" }}>
            <div style={{ fontSize: "1.15rem", fontWeight: 700, color: C.text }}>Today</div>
            <div style={{ fontSize: "0.85rem", color: C.muted }}>{new Date(`${todayStr}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</div>
          </div>
          <div className="grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <a href="/supervisor/calendar" style={{ textDecoration: "none", background: C.softBg, border: `1px solid ${C.border}`, borderRadius: 12, padding: "0.8rem 0.9rem", display: "block" }}>
              <div style={{ fontSize: "0.88rem", fontWeight: 700, color: C.navy, marginBottom: 6 }}>Off today ({loading ? "…" : offToday.length}) ›</div>
              {loading ? <div style={{ color: C.muted, fontSize: "0.88rem" }}>Loading…</div> : offToday.length === 0 ? (
                <div style={{ color: C.muted, fontSize: "0.88rem" }}>Nobody has time off today.</div>
              ) : offToday.map((r) => (
                <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.92rem", color: C.text, padding: "2px 0" }}>
                  <span style={{ width: 8, height: 8, borderRadius: 99, background: C.navy, flexShrink: 0 }} />
                  {r.officer_name}
                </div>
              ))}
            </a>
            <a href="/supervisor/calloffs" style={{ textDecoration: "none", background: C.softBg, border: `1px solid ${C.border}`, borderRadius: 12, padding: "0.8rem 0.9rem", display: "block" }}>
              <div style={{ fontSize: "0.88rem", fontWeight: 700, color: C.amber, marginBottom: 6 }}>Called off today ({loading ? "…" : calloffsToday.length}) ›</div>
              {loading ? <div style={{ color: C.muted, fontSize: "0.88rem" }}>Loading…</div> : calloffsToday.length === 0 ? (
                <div style={{ color: C.muted, fontSize: "0.88rem" }}>No call-offs for today.</div>
              ) : calloffsToday.map((r) => (
                <div key={r.id} style={{ fontSize: "0.92rem", color: C.text, padding: "2px 0" }}>
                  {r.officer_name} <span style={{ color: C.muted, fontSize: "0.8rem" }}>· {r.post}{r.shift_start ? ` · ${fmtTime(r.shift_start)}` : ""}</span>
                </div>
              ))}
            </a>
          </div>
        </div>

        {/* Pending counts */}
        <div className="grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem", marginBottom: "1rem" }}>
          {[
            { label: "New time-off requests (not forwarded yet)", value: stats.pendingTimeOff, color: C.navy, link: "/timeoff/requests?filter=new" },
            { label: "Call-offs to review", value: stats.pendingCallOffReview, color: C.amber, link: "/supervisor/calloffs" },
            { label: "Write-ups awaiting signature", value: stats.pendingDisciplinary, color: C.red, link: "/writeup/records" },
          ].map((stat) => (
            <a key={stat.label} href={stat.link} style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 14, padding: "0.9rem 1rem", textDecoration: "none", display: "flex", alignItems: "center", gap: "0.85rem", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
              <div style={{ fontSize: "1.7rem", fontWeight: 800, color: !loading && stat.value === 0 ? C.faint : stat.color, lineHeight: 1, minWidth: 28 }}>{loading ? "—" : stat.value}</div>
              <div style={{ flex: 1, fontSize: "0.92rem", color: C.text, fontWeight: 600, lineHeight: 1.3 }}>{stat.label}</div>
              <div style={{ color: C.muted }}>›</div>
            </a>
          ))}
        </div>

        {/* Shortcuts */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.5rem", marginBottom: "1.25rem" }}>
          <a href="/writeup/write" style={{ ...pill, background: C.red, borderColor: C.red, color: C.white }}>+ New write-up</a>
          <a href="/dar/report" style={pill}>DARs <span style={{ color: C.muted, fontWeight: 600 }}>{loading ? "" : stats.darsTotal}</span></a>
          <a href="/supervisor/calloffs?filter=unexcused" style={pill}>Unexcused call-offs <span style={{ color: C.muted, fontWeight: 600 }}>{loading ? "" : stats.unexcusedCallOffs}</span></a>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.35rem 0.85rem", margin: "-0.5rem 0 1.25rem", padding: "0 0.25rem" }}>
          <span style={{ fontSize: "0.8rem", color: C.muted, fontWeight: 600 }}>Officer forms:</span>
          {[["Time off", "/timeoff"], ["DAR", "/dar"], ["Call-off", "/calloff"], ["Write-up response", "/writeup"]].map(([label, href]) => (
            <a key={href} href={href} target="_blank" rel="noopener noreferrer" style={{ fontSize: "0.82rem", fontWeight: 600, color: C.navy, textDecoration: "none" }}>{label} ↗</a>
          ))}
        </div>

        {/* This week */}
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "0.5rem", padding: "0.9rem 1.1rem 0.6rem" }}>
            <div style={{ fontSize: "1.15rem", fontWeight: 700, color: C.text }}>This week</div>
            <div style={{ fontSize: "0.82rem", color: C.muted }}>{loading ? "" : `${stats.recentCallOffs} call-off${stats.recentCallOffs === 1 ? "" : "s"} in the last 7 days`}</div>
          </div>
          {loading ? (
            <Skeleton rows={4} card={false} />
          ) : recent.length === 0 ? (
            <div style={{ padding: "1.5rem", textAlign: "center", color: C.muted, fontSize: "0.9rem" }}>Nothing new in the last 7 days.</div>
          ) : (
            recent.map((item) => {
              const config = typeConfig[item.type];
              return (
                <a key={`${item.type}-${item.id}`} href={config.link(item.id)} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.7rem 1.1rem", borderTop: `1px solid ${C.border}`, textDecoration: "none", background: C.white }}>
                  <span style={{ fontSize: "0.75rem", fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: config.bg, color: config.color, whiteSpace: "nowrap", minWidth: 62, textAlign: "center" }}>{config.label}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: "0.92rem", color: C.text }}>{item.name}</div>
                    {item.detail && <div style={{ fontSize: "0.82rem", color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.detail}</div>}
                  </div>
                  <div style={{ fontSize: "0.78rem", color: C.muted, whiteSpace: "nowrap" }}>{fmtStamp(item.at)}</div>
                </a>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
