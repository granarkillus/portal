"use client";

import { useState, useEffect } from "react";
import { getSupabase, requireSupervisor } from "@/lib/supabase";
import { buildTimeOffFormDocument, TimeOffRequest } from "../requests/timeoff-form-template";
import SupervisorHeader, { StatStrip, headerButton } from "@/components/supervisor-header";

const NAVY = "#1a4480";
const DARK = "#243b5e";
const SOFT_BG = "#f2f5fa";
const WHITE = "#ffffff";
const MUTED = "#5b6474";
const BORDER = "#dbe2ec";
const TEXT = "#0f172a";
const GREEN = "#15803d";

// Decision values:
// "approved_payout"       → Approved — With Payout
// "approved_no_payout"    → Approved — Without Payout
// "not_approved"          → Not Approved
// "approved_paper"        → Approved on Paper (manager signed physical form)
// "not_approved_paper"    → Denied on Paper (manager signed physical form)

export default function ApprovePage() {
  const [request, setRequest] = useState<TimeOffRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const [hoursAvailable, setHoursAvailable] = useState("");
  const [decision, setDecision] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [vacationEntered, setVacationEntered] = useState(false);
  const [coveringEntered, setCoveringEntered] = useState(false);
  const [managerSignature, setManagerSignature] = useState("");
  const [managerDate, setManagerDate] = useState("");

  const isApproval = ["approved_payout", "approved_no_payout", "approved_paper"].includes(decision);
  const isRejection = ["not_approved", "not_approved_paper"].includes(decision);
  const isPaper = ["approved_paper", "not_approved_paper"].includes(decision);

  const formatDate = (iso: string) => {
    if (!iso) return "";
    const d = iso.split("T")[0];
    const [y, m, day] = d.split("-");
    return `${m}/${day}/${y}`;
  };

  const decisionLabel = (d: string) => {
    if (d === "approved_payout") return "Time Off Approved — With Payout";
    if (d === "approved_no_payout") return "Time Off Approved — Without Payout";
    if (d === "not_approved") return "Time Off Not Approved";
    if (d === "approved_paper") return "Approved on Paper";
    if (d === "not_approved_paper") return "Denied on Paper";
    return "";
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    if (!id) { setNotFound(true); setLoading(false); return; }

    requireSupervisor().then((u) => {
    if (!u) return;
    getSupabase().from("time_off_requests").select("*").eq("id", id).single()
      .then(({ data, error: dbError }) => {
        if (dbError || !data) { setNotFound(true); }
        else {
          setRequest(data);
          if (data.hours_available) setHoursAvailable(data.hours_available);
          if (data.approval_decision) setDecision(data.approval_decision);
          if (data.rejection_reason) setRejectionReason(data.rejection_reason);
          if (data.vacation_entered) setVacationEntered(data.vacation_entered);
          if (data.covering_entered) setCoveringEntered(data.covering_entered);
          if (data.manager_signature) setManagerSignature(data.manager_signature);
          if (data.manager_date) setManagerDate(data.manager_date);
          if (data.status !== "pending") setSaved(true);
        }
        setLoading(false);
      });
    });
  }, []);

  const handleSave = async () => {
    if (!request || !decision || !managerSignature || !managerDate) return;
    setSaving(true);
    setError("");

    const newStatus = isApproval ? "approved" : "rejected";

    const supabase = getSupabase();
    const { error: dbError } = await supabase
      .from("time_off_requests")
      .update({
        hours_available: hoursAvailable || null,
        approval_decision: decision,
        rejection_reason: isRejection ? rejectionReason || null : null,
        vacation_entered: isApproval && !isPaper ? vacationEntered : false,
        covering_entered: isApproval && !isPaper ? coveringEntered : false,
        manager_signature: managerSignature,
        manager_date: managerDate,
        status: newStatus,
        reviewed_by: managerSignature,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", request.id);

    if (dbError) {
      setError("Save failed. Please try again.");
      setSaving(false);
      return;
    }

    setRequest((r) => r ? { ...r, status: newStatus, approval_decision: decision } : r);
    if (!isPaper) generatePDF();
    setSaved(true);
    setSaving(false);
  };

  const generatePDF = () => {
    if (!request) return;
    // Printing is what sends a request on to Shawn, so remember it.
    if (!request.printed_at) {
      const now = new Date().toISOString();
      getSupabase().from("time_off_requests").update({ printed_at: now }).eq("id", request.id).then(() => {});
      setRequest((r) => (r ? { ...r, printed_at: now } : r));
    }

    const merged: TimeOffRequest = {
      ...request,
      hours_available: hoursAvailable || null,
      approval_decision: decision || null,
      rejection_reason: isRejection ? (rejectionReason || null) : null,
      vacation_entered: isApproval && !isPaper ? vacationEntered : false,
      covering_entered: isApproval && !isPaper ? coveringEntered : false,
      manager_signature: managerSignature || null,
      manager_date: managerDate || null,
    };

    const html = buildTimeOffFormDocument(merged);
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(html);
      win.document.close();
      win.onload = () => { win.focus(); win.print(); };
    }
  };

  if (loading) return (
    <div style={{ minHeight: "100vh", background: SOFT_BG, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-sans)" }}>
      <div style={{ color: MUTED }}>Loading request...</div>
    </div>
  );

  if (notFound) return (
    <div style={{ minHeight: "100vh", background: SOFT_BG, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-sans)" }}>
      <div style={{ textAlign: "center" }}><div style={{ fontSize: "1.1rem", fontWeight: 700, color: TEXT, marginBottom: 8 }}>Request Not Found</div></div>
    </div>
  );

  const required = decision && managerSignature && managerDate;

  const decisions = [
    { val: "approved_payout", label: "Time Off Approved — With Payout", color: GREEN, desc: "Request granted, vacation hours paid out" },
    { val: "approved_no_payout", label: "Time Off Approved — Without Payout", color: NAVY, desc: "Request granted, no vacation hours used" },
    { val: "not_approved", label: "Time Off Not Approved", color: "#b91c1c", desc: "Request denied — officer should use call-off form if absent" },
  ];

  const paperDecisions = [
    { val: "approved_paper", label: "Approved on Paper", color: GREEN, desc: "Manager signed and approved the physical form — record only, no PDF generated" },
    { val: "not_approved_paper", label: "Denied on Paper", color: "#b91c1c", desc: "Manager signed and denied the physical form — record only, no PDF generated" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: SOFT_BG, fontFamily: "var(--font-sans)", padding: "1rem 0.75rem 2rem" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", background: WHITE, borderRadius: 12, boxShadow: "0 10px 30px rgba(15,23,42,0.08), 0 1px 3px rgba(15,23,42,0.06)", overflow: "hidden" }}>

        <SupervisorHeader title="Time-off request" active="timeoff" actions={<a href="/timeoff/requests" style={headerButton()}>← All requests</a>} />

        {request && (
          <div style={{ padding: "0 0 2rem" }}>

            <div style={{ background: SOFT_BG, borderBottom: `1px solid ${BORDER}`, padding: "0.75rem 1.25rem", display: "flex", flexWrap: "wrap", gap: "0.4rem 2rem", alignItems: "center" }}>
              {[
                ["Employee", request.officer_name],
                ["Emp #", request.employee_number],
                ["Account", request.account],
                ["Manager", request.manager],
                ["Type", request.absence_type],
                ["Use vacation", request.use_vacation == null ? "" : `${request.use_vacation ? "Yes" : "No"}${request.vacation_initials ? ` (${request.vacation_initials})` : ""}`],
                ["Dates", request.dates_requested],
                ["Submitted", formatDate(request.submitted_at)],
              ].map(([label, val]) => val ? (
                <div key={label} style={{ fontSize: "0.78rem" }}>
                  <span style={{ fontWeight: 700, textTransform: "uppercase", fontSize: "0.65rem", letterSpacing: "0.05em", color: MUTED }}>{label}: </span>
                  <span style={{ color: TEXT, fontWeight: label === "Type" || label === "Dates" ? 600 : 400 }}>{val}</span>
                </div>
              ) : null)}
              <div style={{ marginLeft: "auto" }}>
                <span style={{
                  fontSize: "0.68rem", fontWeight: 700, padding: "2px 8px", borderRadius: 999,
                  background: request.status === "approved" ? "#e8f5e9" : request.status === "rejected" ? "#fef2f2" : "#fff3cd",
                  color: request.status === "approved" ? GREEN : request.status === "rejected" ? "#b91c1c" : "#92400e",
                  border: `1px solid ${request.status === "approved" ? "#a5d6a7" : request.status === "rejected" ? "#fca5a5" : "#fcd34d"}`,
                  textTransform: "uppercase", letterSpacing: "0.05em",
                }}>
                  {request.status}
                </span>
              </div>
            </div>

            <SectionBar label="Time Off Information — Employee" />
            <div style={{ padding: "1rem 1.25rem", background: "#fafafa" }}>
              {request.reason && (
                <div style={{ marginBottom: "0.5rem" }}>
                  <Label>Reason For Absence</Label>
                  <div style={{ fontSize: "0.88rem", color: TEXT, padding: "0.5rem 0.75rem", background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 12 }}>{request.reason}</div>
                </div>
              )}
              <div style={{ display: "flex", gap: "1rem" }}>
                <div style={{ flex: 1 }}>
                  <Label>Employee Signature</Label>
                  <div style={{ fontSize: "0.88rem", color: TEXT, padding: "0.5rem 0.75rem", background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 12 }}>{request.employee_signature}</div>
                </div>
                <div style={{ width: 160 }}>
                  <Label>Date</Label>
                  <div style={{ fontSize: "0.88rem", color: TEXT, padding: "0.5rem 0.75rem", background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 12 }}>{formatDate(request.employee_date)}</div>
                </div>
              </div>
            </div>

            <SectionBar label="Manager / Scheduling Supervisor Approval" />
            <div style={{ padding: "1.25rem 2rem 0" }}>

              <div style={{ marginBottom: "1.25rem", maxWidth: 260 }}>
                <Label>Hours Available per Vacation Look-Up</Label>
                <input value={hoursAvailable} onChange={(e) => setHoursAvailable(e.target.value)} placeholder="Enter hours" style={inputStyle} disabled={saved} />
              </div>

              {/* Digital decisions */}
              <Label>Decision <span style={{ color: "#b3261e" }}>*</span></Label>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", margin: "0.5rem 0 1rem" }}>
                {decisions.map(({ val, label, color, desc }) => (
                  <label key={val} onClick={() => !saved && setDecision(decision === val ? "" : val)} style={{
                    display: "flex", alignItems: "flex-start", gap: 10, cursor: saved ? "default" : "pointer",
                    background: decision === val ? (val === "not_approved" ? "#fff5f5" : "#f0f7f0") : SOFT_BG,
                    border: `1.5px solid ${decision === val ? color : BORDER}`,
                    borderRadius: 12, padding: "0.7rem 1rem", userSelect: "none", transition: "all 0.15s",
                  }}>
                    <div style={{ width: 18, height: 18, border: `2px solid ${decision === val ? color : BORDER}`, borderRadius: 2, background: decision === val ? color : WHITE, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1, transition: "all 0.15s" }}>
                      {decision === val && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><polyline points="1.5,5 4,7.5 8.5,2.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                    </div>
                    <div>
                      <div style={{ fontSize: "0.88rem", fontWeight: decision === val ? 700 : 500, color: decision === val ? color : TEXT }}>{label}</div>
                      <div style={{ fontSize: "0.72rem", color: MUTED, marginTop: 2 }}>{desc}</div>
                    </div>
                  </label>
                ))}
              </div>

              {/* Paper signature options */}
              <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: "1rem", marginBottom: "1rem" }}>
                <div style={{ fontSize: "0.72rem", fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.5rem" }}>
                  Or — Manager signed the physical paper form
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {paperDecisions.map(({ val, label, color, desc }) => (
                    <label key={val} onClick={() => !saved && setDecision(decision === val ? "" : val)} style={{
                      display: "flex", alignItems: "flex-start", gap: 10, cursor: saved ? "default" : "pointer",
                      background: decision === val ? (val === "not_approved_paper" ? "#fff5f5" : "#f0f7f0") : SOFT_BG,
                      border: `1.5px solid ${decision === val ? color : BORDER}`,
                      borderRadius: 12, padding: "0.7rem 1rem", userSelect: "none", transition: "all 0.15s",
                    }}>
                      <div style={{ width: 18, height: 18, border: `2px solid ${decision === val ? color : BORDER}`, borderRadius: 2, background: decision === val ? color : WHITE, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1, transition: "all 0.15s" }}>
                        {decision === val && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><polyline points="1.5,5 4,7.5 8.5,2.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                      </div>
                      <div>
                        <div style={{ fontSize: "0.88rem", fontWeight: decision === val ? 700 : 500, color: decision === val ? color : TEXT }}>{label}</div>
                        <div style={{ fontSize: "0.72rem", color: MUTED, marginTop: 2 }}>{desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {isRejection && (
                <div style={{ marginBottom: "1.25rem" }}>
                  <Label>If Not Approved, Why:</Label>
                  <input value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} placeholder="Enter reason" style={inputStyle} disabled={saved} />
                </div>
              )}

              {isApproval && !isPaper && (
                <div style={{ marginBottom: "1.25rem" }}>
                  <Label>For Time Off Approvals</Label>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "0.5rem" }}>
                    <CheckboxItem label="Employee and vacation time entered into weekly schedule" checked={vacationEntered} onChange={() => !saved && setVacationEntered(!vacationEntered)} />
                    <CheckboxItem label="Employee(s) covering shift(s) entered into weekly schedule" checked={coveringEntered} onChange={() => !saved && setCoveringEntered(!coveringEntered)} />
                  </div>
                  <div style={{ background: "#fef3c7", border: "1px solid #fcd34d", borderLeft: "3px solid #a06a00", borderRadius: 8, padding: "0.6rem 1rem", fontSize: "0.78rem", color: "#6b4c00", fontWeight: 600, marginTop: "0.75rem" }}>
                    All shifts should be filled using employees with less than 40 scheduled hours first, as to not incur overtime.
                  </div>
                </div>
              )}

              <div style={{ display: "flex", gap: "1rem" }}>
                <div style={{ flex: 1 }}>
                  <Label>Manager Signature (type full name) <span style={{ color: "#b3261e" }}>*</span></Label>
                  <input value={managerSignature} onChange={(e) => setManagerSignature(e.target.value)} placeholder="Full legal name" style={inputStyle} disabled={saved} />
                </div>
                <div style={{ width: 180 }}>
                  <Label>Date <span style={{ color: "#b3261e" }}>*</span></Label>
                  <input type="date" value={managerDate} onChange={(e) => setManagerDate(e.target.value)} style={inputStyle} disabled={saved} />
                </div>
              </div>

              {error && <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 12, padding: "0.75rem 1rem", fontSize: "0.82rem", color: "#b91c1c", marginBottom: "1rem" }}>{error}</div>}

              {saved ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  <div style={{
                    background: isApproval ? "#e8f5e9" : "#fef2f2",
                    border: `1px solid ${isApproval ? "#a5d6a7" : "#fca5a5"}`,
                    borderRadius: 12, padding: "0.75rem 1rem", fontSize: "0.83rem",
                    color: isApproval ? GREEN : "#b91c1c", fontWeight: 600, textAlign: "center"
                  }}>
                    {isApproval ? `✓ ${decisionLabel(decision)}` : `✗ ${decisionLabel(decision)}`}
                    {isPaper ? " — recorded." : " — PDF generated."}
                  </div>
                  {!isPaper && (
                    <button onClick={generatePDF} style={{ ...btnStyle("transparent"), color: NAVY, border: `1px solid ${NAVY}` }}>
                      Re-generate PDF
                    </button>
                  )}
                  <a href="/timeoff/requests" style={{ ...btnStyle(MUTED), display: "block", textAlign: "center", textDecoration: "none" }}>
                    Back to All Requests
                  </a>
                </div>
              ) : (
                <button
                  onClick={handleSave}
                  disabled={!required || saving}
                  style={{ ...btnStyle(required && !saving ? (isRejection ? "#b91c1c" : GREEN) : "#9ca3af"), cursor: required && !saving ? "pointer" : "not-allowed" }}
                >
                  {saving ? "Saving..." :
                    isPaper && isApproval ? "Mark as Approved on Paper" :
                    isPaper && isRejection ? "Mark as Denied on Paper" :
                    isRejection ? "Deny & Generate PDF" :
                    isApproval ? "Approve & Generate PDF" :
                    "Complete Review"}
                </button>
              )}
              {!required && !saved && <div style={{ fontSize: "0.75rem", color: MUTED, textAlign: "center", marginTop: "0.5rem" }}>Decision, manager signature, and date are required</div>}
            </div>

            <div style={{ borderTop: `1px solid ${BORDER}`, marginTop: "2rem", padding: "0.85rem 2rem 0", fontSize: "0.72rem", color: MUTED, textAlign: "center" }}>
              Allied Universal Security Services &nbsp;·&nbsp; Please keep all completed forms on file for audit purposes. &nbsp;·&nbsp; UPDATED 4/19
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SectionBar({ label }: { label: string }) {
  return (
    <div style={{ margin: "1.75rem 1.25rem 0", paddingBottom: "0.5rem", borderBottom: `2px solid ${NAVY}`, color: NAVY, fontSize: "1.05rem", fontWeight: 700 }}>
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

function CheckboxItem({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: "0.85rem", color: "#1a1a2e", fontWeight: checked ? 600 : 400, userSelect: "none" }}>
      <div onClick={onChange} style={{ width: 16, height: 16, border: `2px solid ${checked ? "#1f4e79" : "#d1d5db"}`, borderRadius: 2, background: checked ? "#1f4e79" : "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, cursor: "pointer", transition: "all 0.15s" }}>
        {checked && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><polyline points="1.5,5 4,7.5 8.5,2.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
      </div>
      <span onClick={onChange}>{label}</span>
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", padding: "0.75rem 0.9rem",
  border: "1px solid #d1d5db", borderRadius: 12, fontSize: "1rem",
  color: "#1a1a2e", background: "#ffffff", outline: "none", fontFamily: "inherit",
  marginBottom: "1rem",
};

function btnStyle(bg: string): React.CSSProperties {
  return { background: bg, color: "#ffffff", border: "none", borderRadius: 12, padding: "0.7rem 1.75rem", fontSize: "0.95rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", width: "100%" };
}
