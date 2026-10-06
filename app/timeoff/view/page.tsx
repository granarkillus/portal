"use client";

import { useState, useEffect } from "react";
import { getSupabase, requireSupervisor } from "@/lib/supabase";
import { buildTimeOffFormDocument, TimeOffRequest } from "../requests/timeoff-form-template";
import SupervisorHeader, { StatStrip, headerButton } from "@/components/supervisor-header";
import { C } from "@/lib/theme";
import { fmtDateFull, fmtStamp } from "@/lib/format";
import { PageSkeleton, toast } from "@/components/feedback";

export default function TimeOffViewPage() {
  const [request, setRequest] = useState<TimeOffRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);


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
    // Printing is what sends a request on to Shawn, so remember it.
    if (!request.printed_at) {
      const now = new Date().toISOString();
      getSupabase().from("time_off_requests").update({ printed_at: now }).eq("id", request.id).then(() => {});
      setRequest((r) => (r ? { ...r, printed_at: now } : r));
      toast("Marked as printed");
    }
    const html = buildTimeOffFormDocument(request);
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(html);
      win.document.close();
      win.onload = () => { win.focus(); win.print(); };
    }
  };

  if (loading) return <PageSkeleton />;

  if (notFound) return (
    <div style={{ minHeight: "100vh", background: C.softBg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-sans)" }}>
      <div style={{ textAlign: "center" }}><div style={{ fontSize: "1.1rem", fontWeight: 700, color: C.text, marginBottom: 8 }}>Request Not Found</div></div>
    </div>
  );

  const statusColors: Record<string, { bg: string; color: string; border: string }> = {
    pending: { bg: C.amberTint, color: C.amber, border: C.amberLine },
    approved: { bg: C.greenTint, color: C.green, border: C.greenLine },
    rejected: { bg: C.redTint, color: C.red, border: C.redLine },
  };
  const sc = statusColors[request!.status] || statusColors.pending;

  return (
    <div style={{ minHeight: "100vh", background: C.softBg, fontFamily: "var(--font-sans)", padding: "1rem 0.75rem 2rem" }}>
      <div style={{ maxWidth: 780, margin: "0 auto", background: C.white, borderRadius: 12, boxShadow: "0 10px 30px rgba(15,23,42,0.08), 0 1px 3px rgba(15,23,42,0.06)", overflow: "hidden" }}>

        <SupervisorHeader title="Time-off request" active="timeoff" actions={<><a href="/timeoff/requests" style={headerButton()}>← All requests</a><button type="button" onClick={generatePDF} style={headerButton(true)}>Download PDF</button></>} />

        {request && (
          <div style={{ padding: "0 0 2rem" }}>

            {/* Info strip */}
            <div style={{ background: C.softBg, borderBottom: `1px solid ${C.border}`, padding: "0.75rem 1.25rem", display: "flex", flexWrap: "wrap", gap: "0.4rem 2rem", alignItems: "center" }}>
              {[
                ["Employee", request.officer_name],
                ["Emp #", request.employee_number],
                ["Account", request.account],
                ["Manager", request.manager],
                ["Type", request.absence_type],
                ["Use vacation", request.use_vacation == null ? "" : `${request.use_vacation ? "Yes" : "No"}${request.vacation_initials ? ` (${request.vacation_initials})` : ""}`],
                ["Dates", request.dates_requested],
                ["Submitted", fmtStamp(request.submitted_at)],
              ].map(([label, val]) => val ? (
                <div key={label} style={{ fontSize: "0.78rem" }}>
                  <span style={{ fontWeight: 600, fontSize: "0.82rem", color: C.muted }}>{label}: </span>
                  <span style={{ color: C.text, fontWeight: label === "Type" || label === "Dates" ? 600 : 400 }}>{val}</span>
                </div>
              ) : null)}
              <div style={{ marginLeft: "auto" }}>
                <span style={{ fontSize: "0.78rem", fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`, textTransform: "capitalize", letterSpacing: "0.05em" }}>
                  {request.status}
                </span>
              </div>
            </div>

            {/* Employee section */}
            <SectionBar label="Request details" />
            <div style={{ padding: "1rem 1.25rem", background: "#fafafa" }}>
              {request.reason && (
                <div style={{ marginBottom: "0.75rem" }}>
                  <Label>Reason For Absence</Label>
                  <div style={{ fontSize: "0.88rem", color: C.text, padding: "0.5rem 0.75rem", background: C.white, border: `1px solid ${C.border}`, borderRadius: 12 }}>{request.reason}</div>
                </div>
              )}
              <div style={{ display: "flex", gap: "1rem" }}>
                <SigBlock label="Employee Signature" value={request.employee_signature} />
                <SigBlock label="Date" value={fmtDateFull(request.employee_date)} narrow />
              </div>
            </div>

            {/* Manager section */}
            <SectionBar label="Manager decision" />
            <div style={{ padding: "1rem 1.25rem" }}>
              {request.manager_signature ? (
                <div style={{ background: C.softBg, border: `1px solid ${C.border}`, borderRadius: 12, padding: "1rem 1.25rem" }}>
                  <div style={{ display: "flex", gap: "2rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
                    {request.hours_available && (
                      <div>
                        <div style={{ fontSize: "0.82rem", fontWeight: 600, color: C.muted, marginBottom: 2 }}>Hours Available</div>
                        <div style={{ fontSize: "0.88rem", color: C.text, fontWeight: 600 }}>{request.hours_available}</div>
                      </div>
                    )}
                    <div>
                      <div style={{ fontSize: "0.82rem", fontWeight: 600, color: C.muted, marginBottom: 2 }}>Decision</div>
                      <div style={{ fontSize: "0.92rem", fontWeight: 700, color: request.status === "approved" ? C.green : C.red }}>
                        {request.approval_decision === "approved_payout" ? "✓ Approved — With Payout"
                          : request.approval_decision === "approved_no_payout" ? "✓ Approved — Without Payout"
                          : request.approval_decision === "not_approved" ? "✗ Not Approved"
                          : request.status === "approved" ? "✓ Approved" : "✗ Rejected"}
                      </div>
                    </div>
                  </div>
                  {request.rejection_reason && (
                    <div style={{ marginBottom: "0.75rem" }}>
                      <div style={{ fontSize: "0.82rem", fontWeight: 600, color: C.muted, marginBottom: 2 }}>Rejection Reason</div>
                      <div style={{ fontSize: "0.85rem", color: C.text }}>{request.rejection_reason}</div>
                    </div>
                  )}
                  <div style={{ display: "flex", gap: "1rem" }}>
                    <SigBlock label="Manager Signature" value={request.manager_signature} />
                    <SigBlock label="Date" value={fmtDateFull(request.manager_date)} narrow />
                  </div>
                </div>
              ) : (
                <div style={{ background: C.amberTint, border: "1px solid #fcd34d", borderRadius: 12, padding: "0.75rem 1rem", fontSize: "0.85rem", color: C.amber, fontWeight: 600 }}>
                  Pending manager approval.{" "}
                  <a href={`/timeoff/approve?id=${request.id}`} style={{ color: C.amber, fontWeight: 700 }}>Review now →</a>
                </div>
              )}
            </div>

            {/* Download button */}
            <div style={{ padding: "1.5rem 1.25rem", borderTop: `1px solid ${C.border}` }}>
              <button onClick={generatePDF} style={{ background: C.navy, color: C.white, border: "none", borderRadius: 12, padding: "0.7rem 1.75rem", fontSize: "0.85rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", width: "100%" }}>
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
    <div style={{ margin: "1.5rem 1.25rem 0", color: C.text, fontSize: "1.1rem", fontWeight: 700 }}>
      {label}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: "0.92rem", fontWeight: 600, color: C.slate, marginBottom: 6 }}>
      {children}
    </div>
  );
}

function SigBlock({ label, value, narrow }: { label: string; value: string; narrow?: boolean }) {
  return (
    <div style={{ flex: narrow ? "0 0 160px" : 1 }}>
      <div style={{ borderBottom: "1.5px solid #1a1a2e", minHeight: 28, paddingBottom: 2, fontSize: "0.92rem", color: C.text, marginBottom: 3 }}>{value}</div>
      <div style={{ fontSize: "0.68rem", color: C.muted, fontStyle: "italic" }}>{label}</div>
    </div>
  );
}
