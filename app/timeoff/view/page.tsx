"use client";

import { useState, useEffect } from "react";
import { getSupabase, requireSupervisor } from "@/lib/supabase";
import { buildTimeOffFormDocument, TimeOffRequest } from "../requests/timeoff-form-template";

const NAVY = "#1a4480";
const DARK = "#243b5e";
const SOFT_BG = "#f2f5fa";
const WHITE = "#ffffff";
const MUTED = "#5b6474";
const BORDER = "#dbe2ec";
const TEXT = "#0f172a";
const GREEN = "#15803d";

export default function TimeOffViewPage() {
  const [request, setRequest] = useState<TimeOffRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const formatDate = (iso: string) => {
    if (!iso) return "";
    const d = iso.split("T")[0];
    const [y, m, day] = d.split("-");
    return `${m}/${day}/${y}`;
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    if (!id) { setNotFound(true); setLoading(false); return; }

    requireSupervisor().then((u) => {
      if (!u) return;
      getSupabase().from("time_off_requests").select("*").eq("id", id).single()
        .then(({ data, error }) => {
          if (error || !data) setNotFound(true);
          else setRequest(data);
          setLoading(false);
        });
    });
  }, []);

  // Prints the official AlliedUniversal Time-off Request Form, filled
  // with this record's saved data (employee submission + manager
  // decision, if any).
  const generatePDF = () => {
    if (!request) return;
    const html = buildTimeOffFormDocument(request);
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(html);
      win.document.close();
      win.onload = () => { win.focus(); win.print(); };
    }
  };

  if (loading) return (
    <div style={{ minHeight: "100vh", background: SOFT_BG, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-sans)" }}>
      <div style={{ color: MUTED }}>Loading...</div>
    </div>
  );

  if (notFound) return (
    <div style={{ minHeight: "100vh", background: SOFT_BG, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-sans)" }}>
      <div style={{ textAlign: "center" }}><div style={{ fontSize: "1.1rem", fontWeight: 700, color: TEXT, marginBottom: 8 }}>Request Not Found</div></div>
    </div>
  );

  const statusColors: Record<string, { bg: string; color: string; border: string }> = {
    pending: { bg: "#fff3cd", color: "#92400e", border: "#fcd34d" },
    approved: { bg: "#e8f5e9", color: GREEN, border: "#a5d6a7" },
    rejected: { bg: "#fef2f2", color: "#b91c1c", border: "#fca5a5" },
  };
  const sc = statusColors[request!.status] || statusColors.pending;

  return (
    <div style={{ minHeight: "100vh", background: SOFT_BG, fontFamily: "var(--font-sans)", padding: "2rem 1rem" }}>
      <div style={{ maxWidth: 780, margin: "0 auto", background: WHITE, borderRadius: 12, boxShadow: "0 10px 30px rgba(15,23,42,0.08), 0 1px 3px rgba(15,23,42,0.06)", overflow: "hidden" }}>

        <div className="hdr" style={{ background: "linear-gradient(135deg, #0f2d57 0%, #1d4f91 100%)", padding: "1.25rem 2rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ color: WHITE, fontSize: "1rem", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Allied<span style={{ fontWeight: 300 }}>Universal</span><sup style={{ fontSize: "0.5rem", fontWeight: 300, marginLeft: 1 }}>™</sup>
            </div>
            <div style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.68rem", marginTop: 2 }}>Security Services · Supervisor Portal</div>
          </div>
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
            <a href="/timeoff/requests" style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.78rem", textDecoration: "none" }}>← All Requests</a>
            <button onClick={generatePDF} style={{ background: GREEN, color: WHITE, border: "none", borderRadius: 12, padding: "0.45rem 1.25rem", fontSize: "0.78rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Download PDF
            </button>
          </div>
        </div>

        {request && (
          <div style={{ padding: "0 0 2rem" }}>

            {/* Info strip */}
            <div style={{ background: SOFT_BG, borderBottom: `1px solid ${BORDER}`, padding: "0.75rem 2rem", display: "flex", flexWrap: "wrap", gap: "0.4rem 2rem", alignItems: "center" }}>
              {[
                ["Employee", request.officer_name],
                ["Emp #", request.employee_number],
                ["Account", request.account],
                ["Manager", request.manager],
                ["Type", request.absence_type],
                ["Dates", request.dates_requested],
                ["Submitted", formatDate(request.submitted_at)],
              ].map(([label, val]) => val ? (
                <div key={label} style={{ fontSize: "0.78rem" }}>
                  <span style={{ fontWeight: 700, textTransform: "uppercase", fontSize: "0.65rem", letterSpacing: "0.05em", color: MUTED }}>{label}: </span>
                  <span style={{ color: TEXT, fontWeight: label === "Type" || label === "Dates" ? 600 : 400 }}>{val}</span>
                </div>
              ) : null)}
              <div style={{ marginLeft: "auto" }}>
                <span style={{ fontSize: "0.68rem", fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {request.status}
                </span>
              </div>
            </div>

            {/* Employee section */}
            <SectionBar label="Time Off Information — Employee" />
            <div style={{ padding: "1rem 2rem", background: "#fafafa" }}>
              {request.reason && (
                <div style={{ marginBottom: "0.75rem" }}>
                  <Label>Reason For Absence</Label>
                  <div style={{ fontSize: "0.88rem", color: TEXT, padding: "0.5rem 0.75rem", background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 12 }}>{request.reason}</div>
                </div>
              )}
              <div style={{ display: "flex", gap: "1rem" }}>
                <SigBlock label="Employee Signature" value={request.employee_signature} />
                <SigBlock label="Date" value={formatDate(request.employee_date)} narrow />
              </div>
            </div>

            {/* Manager section */}
            <SectionBar label="Manager / Scheduling Supervisor Approval" />
            <div style={{ padding: "1rem 2rem" }}>
              {request.manager_signature ? (
                <div style={{ background: SOFT_BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "1rem 1.25rem" }}>
                  <div style={{ display: "flex", gap: "2rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
                    {request.hours_available && (
                      <div>
                        <div style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: MUTED, marginBottom: 2 }}>Hours Available</div>
                        <div style={{ fontSize: "0.88rem", color: TEXT, fontWeight: 600 }}>{request.hours_available}</div>
                      </div>
                    )}
                    <div>
                      <div style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: MUTED, marginBottom: 2 }}>Decision</div>
                      <div style={{ fontSize: "0.92rem", fontWeight: 700, color: request.status === "approved" ? GREEN : "#b91c1c" }}>
                        {request.approval_decision === "approved_payout" ? "✓ Approved — With Payout"
                          : request.approval_decision === "approved_no_payout" ? "✓ Approved — Without Payout"
                          : request.approval_decision === "not_approved" ? "✗ Not Approved"
                          : request.status === "approved" ? "✓ Approved" : "✗ Rejected"}
                      </div>
                    </div>
                  </div>
                  {request.rejection_reason && (
                    <div style={{ marginBottom: "0.75rem" }}>
                      <div style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: MUTED, marginBottom: 2 }}>Rejection Reason</div>
                      <div style={{ fontSize: "0.85rem", color: TEXT }}>{request.rejection_reason}</div>
                    </div>
                  )}
                  <div style={{ display: "flex", gap: "1rem" }}>
                    <SigBlock label="Manager Signature" value={request.manager_signature} />
                    <SigBlock label="Date" value={formatDate(request.manager_date || "")} narrow />
                  </div>
                </div>
              ) : (
                <div style={{ background: "#fff3cd", border: "1px solid #fcd34d", borderRadius: 12, padding: "0.75rem 1rem", fontSize: "0.85rem", color: "#92400e", fontWeight: 600 }}>
                  Pending manager approval.{" "}
                  <a href={`/timeoff/approve?id=${request.id}`} style={{ color: "#92400e", fontWeight: 700 }}>Review now →</a>
                </div>
              )}
            </div>

            {/* Download button */}
            <div style={{ padding: "1.5rem 2rem", borderTop: `1px solid ${BORDER}` }}>
              <button onClick={generatePDF} style={{ background: NAVY, color: WHITE, border: "none", borderRadius: 12, padding: "0.7rem 1.75rem", fontSize: "0.85rem", fontWeight: 700, letterSpacing: "0.04em", cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase", width: "100%" }}>
                Download Complete PDF
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SectionBar({ label }: { label: string }) {
  return (
    <div style={{ margin: "1.75rem 2rem 0", paddingBottom: "0.5rem", borderBottom: "2px solid #1a4480", color: "#1a4480", fontSize: "1.05rem", fontWeight: 700 }}>
      {label}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: "0.92rem", fontWeight: 600, color: "#334155", marginBottom: 6 }}>
      {children}
    </div>
  );
}

function SigBlock({ label, value, narrow }: { label: string; value: string; narrow?: boolean }) {
  return (
    <div style={{ flex: narrow ? "0 0 160px" : 1 }}>
      <div style={{ borderBottom: "1.5px solid #1a1a2e", minHeight: 28, paddingBottom: 2, fontSize: "0.92rem", color: "#1a1a2e", marginBottom: 3 }}>{value}</div>
      <div style={{ fontSize: "0.68rem", color: "#6b7280", fontStyle: "italic" }}>{label}</div>
    </div>
  );
}
