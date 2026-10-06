"use client";

import { useState, useEffect } from "react";
import { getSupabase, requireSupervisor } from "@/lib/supabase";
import { buildTimeOffFormDocument, TimeOffRequest } from "./timeoff-form-template";
import SupervisorHeader, { StatStrip } from "@/components/supervisor-header";

const NAVY = "#1a4480";
const DARK = "#243b5e";
const SOFT_BG = "#f2f5fa";
const WHITE = "#ffffff";
const MUTED = "#5b6474";
const BORDER = "#dbe2ec";
const TEXT = "#0f172a";
const GREEN = "#15803d";

export default function RequestsPage() {
  const [requests, setRequests] = useState<TimeOffRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState(() => (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("filter")) || "all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    requireSupervisor().then((u) => {
      if (!u) return;
      getSupabase()
        .from("time_off_requests")
        .select("*")
        .order("submitted_at", { ascending: false })
        .then(({ data }) => {
          setRequests(data || []);
          setLoading(false);
        });
    });
  }, []);

  const formatDate = (iso: string) => {
    if (!iso) return "";
    const d = iso.split("T")[0];
    const [y, m, day] = d.split("-");
    return `${m}/${day}/${y}`;
  };

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
  const isUpcoming = (r: TimeOffRequest) => (r.requested_dates || []).some((d) => d >= today);
  const filtered = requests.filter((r) => {
    const matchesFilter =
      filter === "all" ||
      (filter === "new" && !r.printed_at) ||
      (filter === "printed" && !!r.printed_at) ||
      (filter === "upcoming" && isUpcoming(r));
    const matchesSearch =
      !search ||
      r.officer_name?.toLowerCase().includes(search.toLowerCase()) ||
      r.absence_type?.toLowerCase().includes(search.toLowerCase()) ||
      r.dates_requested?.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const newCount = requests.filter((r) => !r.printed_at).length;
  const upcomingCount = requests.filter(isUpcoming).length;
  const offToday = requests.filter((r) => r.status !== "rejected" && (r.requested_dates || []).includes(today)).length;

  // In practice requests are printed and texted to Shawn rather than
  // approved here, so "printed" is what tells a new request from a handled one.
  const markPrinted = (r: TimeOffRequest) => {
    if (r.printed_at) return;
    const now = new Date().toISOString();
    setRequests((rs) => rs.map((x) => (x.id === r.id ? { ...x, printed_at: now } : x)));
    getSupabase().from("time_off_requests").update({ printed_at: now }).eq("id", r.id).then(() => {});
  };

  const printedBadge = (r: TimeOffRequest) => r.printed_at
    ? <span style={{ fontSize: "0.78rem", fontWeight: 600, padding: "3px 10px", borderRadius: 999, background: "#f1f5f9", color: MUTED, border: `1px solid ${BORDER}` }}>Printed {formatDate(r.printed_at)}</span>
    : <span style={{ fontSize: "0.78rem", fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: "#eaf1fb", color: NAVY, border: "1px solid #bcd0ec" }}>New</span>;

  const statusBadge = (status: string) => {
    const styles: Record<string, { bg: string; color: string; border: string }> = {
      pending: { bg: "#fff3cd", color: "#92400e", border: "#fcd34d" },
      approved: { bg: "#e8f5e9", color: GREEN, border: "#a5d6a7" },
      rejected: { bg: "#fef2f2", color: "#b91c1c", border: "#fca5a5" },
    };
    const s = styles[status] || styles.pending;
    return (
      <span style={{ fontSize: "0.78rem", fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: s.bg, color: s.color, border: `1px solid ${s.border}`, textTransform: "capitalize", letterSpacing: "0.05em" }}>
        {status === "rejected" ? "Denied" : status}
      </span>
    );
  };

  // Prints the official AlliedUniversal Time-off Request Form filled
  // with this record's saved data (employee submission + manager
  // decision, if any).
  const generatePDF = (r: TimeOffRequest) => {
    const html = buildTimeOffFormDocument(r);
    const win = window.open("", "_blank");
    if (win) { win.document.write(html); win.document.close(); win.onload = () => { win.focus(); win.print(); }; }
  };

  // Prints the official form with Section 2 (Manager / Scheduling
  // Supervisor Approval) left blank, for a manager to complete by hand
  // on a still-pending request.
  const generateBlankManagerPDF = (r: TimeOffRequest) => {
    const html = buildTimeOffFormDocument(r, { blankManager: true });
    const win = window.open("", "_blank");
    if (win) { win.document.write(html); win.document.close(); win.onload = () => { win.focus(); win.print(); }; }
  };

  return (
    <div style={{ minHeight: "100vh", background: SOFT_BG, fontFamily: "var(--font-sans)", padding: "1rem 0.75rem 2rem" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>

        <SupervisorHeader title="Time-off requests" active="timeoff" />

        <StatStrip items={[["New (not printed)", newCount, NAVY], ["Off today", offToday], ["Upcoming", upcomingCount], ["Total", requests.length]]} action={<a href="/supervisor/calendar" style={{ display: "inline-block", background: NAVY, color: "#fff", textDecoration: "none", borderRadius: 999, padding: "0.5rem 1rem", fontWeight: 700, fontSize: "0.9rem" }}>📅 Calendar</a>} />

        <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderTop: "none", padding: "1rem 1.25rem", display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by officer, type, or dates..."
            style={{ flex: 1, minWidth: 200, padding: "0.45rem 0.75rem", border: `1px solid ${BORDER}`, borderRadius: 12, fontSize: "0.85rem", color: TEXT, background: "#ffffff", outline: "none", fontFamily: "inherit" }} />
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {["all", "new", "upcoming", "printed"].map((f) => (
              <button key={f} onClick={() => setFilter(f)} style={{ padding: "0.4rem 0.9rem", borderRadius: 12, fontSize: "0.78rem", fontWeight: 700, border: `1px solid ${filter === f ? NAVY : BORDER}`, background: filter === f ? NAVY : WHITE, color: filter === f ? WHITE : MUTED, cursor: "pointer", fontFamily: "inherit", textTransform: "capitalize" }}>
                {f === "new" ? "New" : f === "upcoming" ? "Upcoming" : f === "printed" ? "Printed" : "All"}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderTop: "none", padding: "2rem", textAlign: "center", color: MUTED, fontSize: "0.85rem" }}>Loading requests...</div>
        ) : filtered.length === 0 ? (
          <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderTop: "none", padding: "2rem", textAlign: "center", color: MUTED, fontSize: "0.85rem" }}>No requests found.</div>
        ) : (
          filtered.map((r) => (
            <div key={r.id} style={{ background: WHITE, border: `1px solid ${BORDER}`, borderTop: "none", padding: "1rem 1.25rem", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 240px", minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, fontSize: "0.92rem", color: TEXT }}>{r.officer_name}</span>
                  {printedBadge(r)}
                  {r.status !== "pending" && statusBadge(r.status)}
                </div>
                <div style={{ fontSize: "0.78rem", color: MUTED }}>
                  <span style={{ fontWeight: 600, color: TEXT }}>{r.absence_type}</span>
                  {r.dates_requested && <> &nbsp;·&nbsp; {r.dates_requested}</>}
                  {r.manager && <> &nbsp;·&nbsp; Manager: {r.manager}</>}
                  &nbsp;·&nbsp; Submitted: {formatDate(r.submitted_at)}
                </div>
                {r.reason && <div style={{ fontSize: "0.78rem", color: MUTED, marginTop: 2 }}>{r.reason}</div>}
              </div>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <button
                  onClick={() => { generateBlankManagerPDF(r); markPrinted(r); }}
                  style={{ background: r.printed_at ? WHITE : NAVY, border: `1px solid ${r.printed_at ? BORDER : NAVY}`, borderRadius: 999, color: r.printed_at ? NAVY : WHITE, padding: "0.5rem 1rem", fontSize: "0.88rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6 }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                  </svg>
                  {r.printed_at ? "Print again" : "Print"}
                </button>
                {r.status !== "pending" && (
                  <button
                    onClick={() => { generatePDF(r); markPrinted(r); }}
                    style={{ background: "none", border: `1px solid ${BORDER}`, borderRadius: 12, color: MUTED, padding: "0.4rem 0.75rem", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4 }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                      <line x1="12" y1="18" x2="12" y2="12"/>
                      <line x1="9" y1="15" x2="15" y2="15"/>
                    </svg>
                    PDF
                  </button>
                )}
                <a href={r.status === "pending" ? `/timeoff/approve?id=${r.id}` : `/timeoff/view?id=${r.id}`}
                  style={{ background: "none", border: `1px solid ${BORDER}`, color: MUTED, borderRadius: 999, padding: "0.5rem 1rem", fontSize: "0.88rem", fontWeight: 700, display: "inline-block", textDecoration: "none", textAlign: "center" as const }}>
                  Open
                </a>
              </div>
            </div>
          ))
        )}

        <div style={{ marginTop: "1rem", fontSize: "0.72rem", color: MUTED, textAlign: "center" }}>
          Allied Universal Security Services &nbsp;·&nbsp; Washington University &nbsp;·&nbsp; Keep all completed forms on file for audit purposes.
        </div>
      </div>
    </div>
  );
}

function btnStyle(bg: string): React.CSSProperties {
  return { background: bg, color: "#ffffff", border: "none", borderRadius: 12, padding: "0.7rem 1.75rem", fontSize: "0.95rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", width: "100%" };
}
