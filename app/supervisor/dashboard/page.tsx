"use client";

import { useState, useEffect } from "react";
import { getSupabase, requireSupervisor } from "@/lib/supabase";

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
    ]).then(([timeOff, callOffs, disciplinary, toCount, coCount, discCount, darTotal, coTotal, unexcused, pendingReview]) => {
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
    "time-off": { label: "Time Off", color: NAVY, bg: "#eaf1fb", link: () => `/timeoff/requests` },
    "calloff": { label: "Call Off", color: "#92400e", bg: "#fff3cd", link: () => `/supervisor/calloffs` },
    "disciplinary": { label: "Disciplinary", color: "#b91c1c", bg: "#fef2f2", link: () => `/writeup/records` },
  };

  return (
    <div style={{ minHeight: "100vh", background: SOFT_BG, fontFamily: "var(--font-sans)" }}>

      <div className="hdr" style={{ background: "linear-gradient(135deg, #0f2d57 0%, #1d4f91 100%)", padding: "0.9rem 2rem", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <div style={{ color: WHITE, fontSize: "0.95rem", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase" }}>
            Allied<span style={{ fontWeight: 300 }}>Universal</span><sup style={{ fontSize: "0.5rem", fontWeight: 300, marginLeft: 1 }}>™</sup>
          </div>
          <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.75rem" }}>Supervisor Portal · Washington University</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <a href="/supervisor/dashboard" style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.78rem", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            Home
          </a>
          <div style={{ color: "rgba(255,255,255,0.35)", fontSize: "0.78rem" }}>|</div>
          <div style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.78rem" }}>{user?.email}</div>
          <button onClick={handleSignOut} style={{ background: "none", border: "1px solid rgba(255,255,255,0.3)", color: WHITE, borderRadius: 12, padding: "0.3rem 0.75rem", fontSize: "0.75rem", cursor: "pointer", fontFamily: "inherit" }}>
            Sign Out
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "2rem 1rem" }}>

        {/* Top stats row */}
        <div className="grid-4" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem", marginBottom: "1rem" }}>
          {[
            { label: "Pending Time-Off", value: stats.pendingTimeOff, color: NAVY, link: "/timeoff/requests" },
            { label: "Call-Offs (7 days)", value: stats.recentCallOffs, color: "#92400e", link: "/supervisor/calloffs" },
            { label: "Pending Acknowledgements", value: stats.pendingDisciplinary, color: "#b91c1c", link: "/writeup/records" },
            { label: "Pending Call-Off Review", value: stats.pendingCallOffReview, color: "#92400e", link: "/supervisor/calloffs" },
          ].map((stat) => (
            <a key={stat.label} href={stat.link} style={{ background: WHITE, border: `1px solid ${BORDER}`, borderTop: `3px solid ${stat.color}`, borderRadius: 12, padding: "1.25rem 1.5rem", textDecoration: "none", display: "block", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <div style={{ fontSize: "2rem", fontWeight: 800, color: stat.color, lineHeight: 1 }}>{loading ? "—" : stat.value}</div>
              <div style={{ fontSize: "0.75rem", color: MUTED, marginTop: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{stat.label}</div>
            </a>
          ))}
        </div>

        {/* Monthly stats row */}
        <div className="grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem", marginBottom: "1.5rem" }}>
          <a href="/dar/report" style={{ background: WHITE, border: `1px solid ${BORDER}`, borderLeft: `4px solid ${GREEN}`, borderRadius: 12, padding: "1rem 1.5rem", textDecoration: "none", display: "flex", alignItems: "center", gap: "1rem", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: "1.75rem" }}>📋</div>
            <div>
              <div style={{ fontSize: "1.75rem", fontWeight: 800, color: GREEN, lineHeight: 1 }}>{loading ? "—" : stats.darsTotal}</div>
              <div style={{ fontSize: "0.75rem", color: MUTED, marginTop: 2, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>DARs — Total</div>
            </div>
          </a>
          <a href="/supervisor/calloffs" style={{ background: WHITE, border: `1px solid ${BORDER}`, borderLeft: `4px solid #92400e`, borderRadius: 12, padding: "1rem 1.5rem", textDecoration: "none", display: "flex", alignItems: "center", gap: "1rem", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: "1.75rem" }}>📞</div>
            <div>
              <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "#92400e", lineHeight: 1 }}>{loading ? "—" : stats.callOffsTotal}</div>
              <div style={{ fontSize: "0.75rem", color: MUTED, marginTop: 2, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>Call-Offs — Total</div>
            </div>
          </a>
          <a href="/supervisor/calloffs" style={{ background: WHITE, border: `1px solid ${BORDER}`, borderLeft: `4px solid #b91c1c`, borderRadius: 12, padding: "1rem 1.5rem", textDecoration: "none", display: "flex", alignItems: "center", gap: "1rem", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: "1.75rem" }}>⚠️</div>
            <div>
              <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "#b91c1c", lineHeight: 1 }}>{loading ? "—" : stats.unexcusedCallOffs}</div>
              <div style={{ fontSize: "0.75rem", color: MUTED, marginTop: 2, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>Unexcused — All Time</div>
            </div>
          </a>
        </div>

        <div className="grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>

          <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden" }}>
            <div style={{ background: DARK, padding: "0.6rem 1.5rem" }}>
              <span style={{ color: WHITE, fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Recent Activity</span>
            </div>
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
                          <span style={{ fontSize: "0.68rem", fontWeight: 700, padding: "1px 7px", borderRadius: 999, background: config.bg, color: config.color, textTransform: "uppercase", letterSpacing: "0.04em" }}>{config.label}</span>
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
              <div style={{ background: DARK, padding: "0.6rem 1.5rem" }}>
                <span style={{ color: WHITE, fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Quick Actions</span>
              </div>
              <div style={{ padding: "1rem 1.5rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {[
                  { label: "File a Write-Up", href: "/writeup/write", color: "#b91c1c" },
                  { label: "Time-Off Calendar", href: "/supervisor/calendar", color: NAVY },
                  { label: "Review Time-Off Requests", href: "/timeoff/requests", color: NAVY },
                  { label: "View Disciplinary Records", href: "/writeup/records", color: NAVY },
                  { label: "Generate DAR Report", href: "/dar/report", color: GREEN },
                  { label: "Call-Off History", href: "/supervisor/calloffs", color: "#92400e" },
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
              <div style={{ background: DARK, padding: "0.6rem 1.5rem" }}>
                <span style={{ color: WHITE, fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Employee Forms</span>
              </div>
              <div style={{ padding: "1rem 1.5rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {[
                  { label: "Time-Off Request Form", href: "/timeoff" },
                  { label: "Daily Activity Report", href: "/dar" },
                  { label: "Call-Off Notice", href: "/calloff" },
                  { label: "Disciplinary Response", href: "/writeup" },
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
