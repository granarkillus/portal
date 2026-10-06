"use client";

import { useState, useEffect, Fragment } from "react";
import { getSupabase, requireSupervisor } from "@/lib/supabase";
import { buildTimeOffFormDocument, TimeOffRequest } from "./timeoff-form-template";
import SupervisorHeader, { StatStrip } from "@/components/supervisor-header";
import { C, btnStyle } from "@/lib/theme";
import { fmtDate } from "@/lib/format";
import Icon from "@/components/icon";
import { Skeleton, toast } from "@/components/feedback";

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

  // On "All", requests that haven't been printed yet sit on top under "New".
  const ordered = filter === "all" ? [...filtered.filter((r) => !r.printed_at), ...filtered.filter((r) => r.printed_at)] : filtered;
  const groupHeading = (idx: number) => {
    if (filter !== "all") return null;
    const r = ordered[idx];
    if (idx > 0 && !!ordered[idx - 1].printed_at === !!r.printed_at) return null;
    return r.printed_at ? "Earlier" : "New — not printed yet";
  };
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
    toast("Marked as printed");
  };

  const printedBadge = (r: TimeOffRequest) => r.printed_at
    ? <span style={{ fontSize: "0.78rem", fontWeight: 600, padding: "3px 10px", borderRadius: 999, background: "#f1f5f9", color: C.muted, border: `1px solid ${C.border}` }}>Printed {fmtDate(r.printed_at)}</span>
    : <span style={{ fontSize: "0.78rem", fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: C.navyTint, color: C.navy, border: "1px solid #bcd0ec" }}>New</span>;

  const statusBadge = (status: string) => {
    const styles: Record<string, { bg: string; color: string; border: string }> = {
      pending: { bg: C.amberTint, color: C.amber, border: C.amberLine },
      approved: { bg: C.greenTint, color: C.green, border: C.greenLine },
      rejected: { bg: C.redTint, color: C.red, border: C.redLine },
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
    <div style={{ minHeight: "100vh", background: C.softBg, fontFamily: "var(--font-sans)", padding: "1rem 0.75rem 2rem" }}>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>

        <SupervisorHeader title="Time-off requests" active="timeoff" />

        <StatStrip items={[["New (not printed)", newCount, C.navy], ["Off today", offToday], ["Upcoming", upcomingCount], ["Total", requests.length]]} action={<a href="/supervisor/calendar" style={{ display: "inline-flex", background: C.navy, color: C.white, textDecoration: "none", borderRadius: 999, padding: "0.5rem 1rem", fontWeight: 700, fontSize: "0.9rem", alignItems: "center", gap: 6 }}><Icon name="calendar" size={16} />Calendar</a>} />

        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderTop: "none", padding: "1rem 1.25rem", display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by officer, type, or dates..."
            style={{ flex: 1, minWidth: 200, padding: "0.45rem 0.75rem", border: `1px solid ${C.border}`, borderRadius: 12, fontSize: "0.85rem", color: C.text, background: C.white, outline: "none", fontFamily: "inherit" }} />
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {["all", "new", "upcoming", "printed"].map((f) => (
              <button key={f} onClick={() => setFilter(f)} style={{ padding: "0.55rem 0.9rem", borderRadius: 12, fontSize: "0.85rem", fontWeight: 700, border: `1px solid ${filter === f ? C.navy : C.border}`, background: filter === f ? C.navy : C.white, color: filter === f ? C.white : C.muted, cursor: "pointer", fontFamily: "inherit", textTransform: "capitalize" }}>
                {f === "new" ? "New" : f === "upcoming" ? "Upcoming" : f === "printed" ? "Printed" : "All"}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ background: C.white, border: `1px solid ${C.border}`, borderTop: "none", borderRadius: "0 0 16px 16px", overflow: "hidden" }}><Skeleton rows={5} card={false} /></div>
        ) : filtered.length === 0 ? (
          <div style={{ background: C.white, border: `1px solid ${C.border}`, borderTop: "none", padding: "2rem", textAlign: "center", color: C.muted, fontSize: "0.85rem" }}>No requests found.</div>
        ) : (
          ordered.map((r, idx) => (
            <Fragment key={r.id}>
            {groupHeading(idx) && (
              <div style={{ background: C.softBg, borderLeft: `1px solid ${C.border}`, borderRight: `1px solid ${C.border}`, padding: "0.6rem 1.25rem", fontSize: "0.85rem", fontWeight: 700, color: r.printed_at ? C.muted : C.navy }}>{groupHeading(idx)}</div>
            )}
            <div style={{ background: C.white, border: `1px solid ${C.border}`, borderTop: "none", padding: "1rem 1.25rem", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 240px", minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, fontSize: "0.92rem", color: C.text }}>{r.officer_name}</span>
                  {printedBadge(r)}
                  {r.status !== "pending" && statusBadge(r.status)}
                </div>
                <div style={{ fontSize: "0.78rem", color: C.muted }}>
                  <span style={{ fontWeight: 600, color: C.text }}>{r.absence_type}</span>
                  {r.dates_requested && <> &nbsp;·&nbsp; {r.dates_requested}</>}
                  {r.manager && <> &nbsp;·&nbsp; Manager: {r.manager}</>}
                  &nbsp;·&nbsp; Submitted {fmtDate(r.submitted_at)}
                </div>
                {r.reason && <div style={{ fontSize: "0.78rem", color: C.muted, marginTop: 2 }}>{r.reason}</div>}
              </div>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <button
                  onClick={() => { generateBlankManagerPDF(r); markPrinted(r); }}
                  style={{ background: r.printed_at ? C.white : C.navy, border: `1px solid ${r.printed_at ? C.border : C.navy}`, borderRadius: 999, color: r.printed_at ? C.navy : C.white, padding: "0.5rem 1rem", fontSize: "0.88rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6 }}
                >
                  <Icon name="printer" size={14} />
                  {r.printed_at ? "Print again" : "Print"}
                </button>
                {r.status !== "pending" && (
                  <button
                    onClick={() => { generatePDF(r); markPrinted(r); }}
                    style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 12, color: C.muted, padding: "0.55rem 0.75rem", fontSize: "0.85rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4 }}
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
                  style={{ background: "none", border: `1px solid ${C.border}`, color: C.muted, borderRadius: 999, padding: "0.5rem 1rem", fontSize: "0.88rem", fontWeight: 700, display: "inline-block", textDecoration: "none", textAlign: "center" as const }}>
                  Open
                </a>
              </div>
            </div>
            </Fragment>
          ))
        )}

        <div style={{ marginTop: "1rem", fontSize: "0.72rem", color: C.muted, textAlign: "center" }}>
          Allied Universal Security Services &nbsp;·&nbsp; Washington University &nbsp;·&nbsp; Keep all completed forms on file for audit purposes.
        </div>
      </div>
    </div>
  );
}

