"use client";

import { useState, useEffect } from "react";
import { getSupabase, requireSupervisor } from "@/lib/supabase";
import { buildTimeOffFormDocument, TimeOffRequest } from "./timeoff-form-template";

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
  const [filter, setFilter] = useState("all");
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

  const filtered = requests.filter((r) => {
    const matchesFilter =
      filter === "all" ||
      (filter === "pending" && r.status === "pending") ||
      (filter === "approved" && r.status === "approved") ||
      (filter === "rejected" && r.status === "rejected");
    const matchesSearch =
      !search ||
      r.officer_name?.toLowerCase().includes(search.toLowerCase()) ||
      r.absence_type?.toLowerCase().includes(search.toLowerCase()) ||
      r.dates_requested?.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const pending = requests.filter((r) => r.status === "pending").length;
  const approved = requests.filter((r) => r.status === "approved").length;
  const rejected = requests.filter((r) => r.status === "rejected").length;

  const statusBadge = (status: string) => {
    const styles: Record<string, { bg: string; color: string; border: string }> = {
      pending: { bg: "#fff3cd", color: "#92400e", border: "#fcd34d" },
      approved: { bg: "#e8f5e9", color: GREEN, border: "#a5d6a7" },
      rejected: { bg: "#fef2f2", color: "#b91c1c", border: "#fca5a5" },
    };
    const s = styles[status] || styles.pending;
    return (
      <span style={{ fontSize: "0.68rem", fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: s.bg, color: s.color, border: `1px solid ${s.border}`, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {status}
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
    <div style={{ minHeight: "100vh", background: SOFT_BG, fontFamily: "var(--font-sans)", padding: "2rem 1rem" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>

        <div style={{ background: "linear-gradient(135deg, #0f2d57 0%, #1d4f91 100%)", padding: "1.25rem 2rem", borderRadius: "4px 4px 0 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ color: WHITE, fontSize: "1rem", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Allied<span style={{ fontWeight: 300 }}>Universal</span><sup style={{ fontSize: "0.5rem", fontWeight: 300, marginLeft: 1 }}>™</sup>
            </div>
            <div style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.68rem", marginTop: 2 }}>Security Services · Supervisor Portal</div>
          </div>
          <div style={{ textAlign: "right", display: "flex", alignItems: "center", gap: "1.25rem" }}>
            <a href="/supervisor/dashboard" style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.75rem", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              Dashboard
            </a>
            <div style={{ color: WHITE, fontSize: "0.95rem", fontWeight: 700 }}>Time-Off Requests</div>
            <div style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.75rem" }}>Washington University</div>
          </div>
        </div>

        <div style={{ background: DARK, padding: "0.75rem 2rem", display: "flex", gap: "2rem", flexWrap: "wrap", alignItems: "center" }}>
          {[["Total", requests.length], ["Pending", pending], ["Approved", approved], ["Rejected", rejected]].map(([label, val]) => (
            <div key={label as string}>
              <div style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
              <div style={{ color: WHITE, fontSize: "1.1rem", fontWeight: 700 }}>{val}</div>
            </div>
          ))}
        </div>

        <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderTop: "none", padding: "1rem 2rem", display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by officer, type, or dates..."
            style={{ flex: 1, minWidth: 200, padding: "0.45rem 0.75rem", border: `1px solid ${BORDER}`, borderRadius: 12, fontSize: "0.85rem", color: TEXT, background: "#ffffff", outline: "none", fontFamily: "inherit" }} />
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {["all", "pending", "approved", "rejected"].map((f) => (
              <button key={f} onClick={() => setFilter(f)} style={{ padding: "0.4rem 0.9rem", borderRadius: 12, fontSize: "0.78rem", fontWeight: 700, border: `1px solid ${filter === f ? NAVY : BORDER}`, background: filter === f ? NAVY : WHITE, color: filter === f ? WHITE : MUTED, cursor: "pointer", fontFamily: "inherit", textTransform: "capitalize" }}>
                {f}
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
            <div key={r.id} style={{ background: WHITE, border: `1px solid ${BORDER}`, borderTop: "none", padding: "1rem 2rem", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, fontSize: "0.92rem", color: TEXT }}>{r.officer_name}</span>
                  {statusBadge(r.status)}
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
                  onClick={() => generateBlankManagerPDF(r)}
                  style={{ background: "none", border: `1px solid ${BORDER}`, borderRadius: 12, color: "#92400e", padding: "0.4rem 0.75rem", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4 }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                  </svg>
                  Print
                </button>
                {r.status !== "pending" && (
                  <button
                    onClick={() => generatePDF(r)}
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
                  style={{ ...btnStyle(r.status === "pending" ? NAVY : "#6b7280"), padding: "0.4rem 1rem", width: "auto", fontSize: "0.78rem", display: "inline-block", textDecoration: "none", textAlign: "center" as const }}>
                  {r.status === "pending" ? "Review" : "View"}
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
  return { background: bg, color: "#ffffff", border: "none", borderRadius: 12, padding: "0.7rem 1.75rem", fontSize: "0.85rem", fontWeight: 700, letterSpacing: "0.04em", cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase", width: "100%" };
}
