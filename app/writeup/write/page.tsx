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

interface WorkHistoryRow {
  type: string;
  date: string;
  issuedBy: string;
  description: string;
}

export default function WriteUpForm() {
  const [form, setForm] = useState({
    employeeName: "",
    employeeId: "",
    positionTitle: "",
    branchDept: "",
    clientSite: "",
    supervisor: "",
    unionYes: false,
    unionNo: true,
    unionName: "",
    probationary: false,
    pastProbationary: false,
    workRuleViolation: false,
    workRuleDetail: "",
    performance: false,
    performanceDetail: "",
    attendance: false,
    attendanceDetail: "",
    facts: "",
    expectations: "",
    consequences: "",
    actionVerbalWarning: false,
    actionWrittenWarning: false,
    actionFinalWrittenWarning: false,
    actionSuspension: false,
    actionTermination: false,
    effectiveDate: "",
    suspensionDates: "",
    suspensionUnpaid: false,
    suspensionPaid: false,
    supervisorSignature: "",
    supervisorDateSigned: "",
    witnessSignature: "",
    witnessName: "",
    witnessDate: "",
  });

  const [workHistory, setWorkHistory] = useState<WorkHistoryRow[]>([
    { type: "Coaching / Counseling / Training", date: "", issuedBy: "", description: "" },
    { type: "Verbal Warning", date: "", issuedBy: "", description: "" },
    { type: "Written Warning", date: "", issuedBy: "", description: "" },
    { type: "Final Warning / Suspension", date: "", issuedBy: "", description: "" },
  ]);

  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Supervisors only.
  useEffect(() => { requireSupervisor(); }, []);
  const [respondLink, setRespondLink] = useState("");
  const [error, setError] = useState("");

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const toggle = (field: string) => () =>
    setForm((f) => ({ ...f, [field]: !f[field as keyof typeof f] }));

  const updateHistory = (index: number, field: string, value: string) =>
    setWorkHistory((h) => h.map((row, i) => i === index ? { ...row, [field]: value } : row));

  const required = form.employeeName && form.positionTitle && form.clientSite &&
    form.supervisor && form.facts && form.supervisorSignature && form.supervisorDateSigned;

  const handleSubmit = async () => {
    if (!required) return;
    setSubmitting(true);
    setError("");

    const supabase = getSupabase();

    const actionType = [
      form.actionVerbalWarning && "Verbal Warning",
      form.actionWrittenWarning && "Written Warning",
      form.actionFinalWrittenWarning && "Final Written Warning",
      form.actionSuspension && "Suspension",
      form.actionTermination && "Termination",
    ].filter(Boolean).join(", ");

    const infraction = [
      form.workRuleViolation && `Work Rule Violation: ${form.workRuleDetail}`,
      form.performance && `Performance: ${form.performanceDetail}`,
      form.attendance && `Attendance: ${form.attendanceDetail}`,
    ].filter(Boolean).join("; ");

    const { data, error: dbError } = await supabase
      .from("disciplinary_records")
      .insert([{
        officer_name: form.employeeName,
        employee_id: form.employeeId || null,
        position: form.positionTitle,
        branch_dept: form.branchDept || null,
        client_site: form.clientSite,
        supervisor: form.supervisor,
        notice_date: form.supervisorDateSigned,
        infraction: infraction || null,
        action_type: actionType || null,
        facts: form.facts,
        expectations: form.expectations || null,
        consequences: form.consequences || null,
        work_history: workHistory.filter(r => r.date || r.description),
        supervisor_signature: form.supervisorSignature,
        supervisor_date: form.supervisorDateSigned,
        witness_signature: form.witnessSignature || null,
        witness_name: form.witnessName || null,
        witness_date: form.witnessDate || null,
        effective_date: form.effectiveDate || null,
        suspension_dates: form.suspensionDates || null,
        suspension_type: form.suspensionUnpaid ? "Unpaid" : form.suspensionPaid ? "Paid" : null,
        agreement: null,
        officer_comments: null,
        signature: null,
        date_signed: null,
      }])
      .select("id")
      .single();

    if (dbError || !data) {
      setError("Submission failed. Please try again.");
      setSubmitting(false);
      return;
    }

    setRespondLink(`${window.location.origin}/writeup/respond?id=${data.id}`);
    setSubmitted(true);
    setSubmitting(false);
  };

  if (submitted) {
    return (
      <div style={{ minHeight: "100vh", background: SOFT_BG, fontFamily: "var(--font-sans)", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem 1rem" }}>
        <div style={{ maxWidth: 560, width: "100%", background: WHITE, borderRadius: 12, boxShadow: "0 10px 30px rgba(15,23,42,0.08), 0 1px 3px rgba(15,23,42,0.06)", overflow: "hidden" }}>
          <div className="hdr" style={{ background: "linear-gradient(135deg, #0f2d57 0%, #1d4f91 100%)", padding: "1.25rem 2rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ color: WHITE, fontSize: "1rem", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                Allied<span style={{ fontWeight: 300 }}>Universal</span><sup style={{ fontSize: "0.5rem" }}>™</sup>
              </div>
            </div>
            <a href="/supervisor/dashboard" style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.75rem", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              Dashboard
            </a>
          </div>
          <div style={{ padding: "2rem" }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#e8f5e9", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem" }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2f6b3a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div style={{ textAlign: "center", fontSize: "1.1rem", fontWeight: 700, color: TEXT, marginBottom: 8 }}>Write-Up Filed</div>
            <div style={{ textAlign: "center", color: MUTED, fontSize: "0.85rem", marginBottom: "1.5rem" }}>
              Send the link below to {form.employeeName} for their acknowledgement.
            </div>
            <div style={{ background: SOFT_BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "0.75rem 1rem", fontSize: "0.82rem", color: TEXT, wordBreak: "break-all", marginBottom: "1rem" }}>
              {respondLink}
            </div>
            <button onClick={() => { navigator.clipboard.writeText(respondLink); }} style={{ ...btnStyle(NAVY), marginBottom: "0.75rem" }}>
              Copy Link
            </button>
            <a href={`sms:&body=You have a disciplinary notice to acknowledge. Please open this link: ${encodeURIComponent(respondLink)}`} style={{ ...btnStyle("#2f6b3a"), display: "block", textAlign: "center", textDecoration: "none" }}>
              Text Link to Officer
            </a>
          </div>
        </div>
      </div>
    );
  }

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
          <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
            <a href="/supervisor/dashboard" style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.75rem", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              Dashboard
            </a>
            <div style={{ textAlign: "right" }}>
              <div style={{ color: WHITE, fontSize: "0.9rem", fontWeight: 700 }}>Coaching – Counseling – Disciplinary Notice</div>
              <div style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.75rem" }}>Security Professionals / Service Employees</div>
            </div>
          </div>
        </div>

        <div style={{ padding: "0 0 2rem" }}>

          <SectionBar label="Employee Information" />
          <div style={{ padding: "1.25rem 2rem 0" }}>
            <Row>
              <Field label="Employee Name" value={form.employeeName} onChange={set("employeeName")} required />
              <Field label="Employee ID" value={form.employeeId} onChange={set("employeeId")} />
            </Row>
            <Row>
              <Field label="Position Title" value={form.positionTitle} onChange={set("positionTitle")} required />
              <Field label="Branch / Dept." value={form.branchDept} onChange={set("branchDept")} />
            </Row>
            <Row>
              <Field label="Client Site" value={form.clientSite} onChange={set("clientSite")} required />
              <Field label="Supervisor" value={form.supervisor} onChange={set("supervisor")} required />
            </Row>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem 2rem", marginBottom: "1rem" }}>
              <CheckboxItem label="Union: Yes" checked={form.unionYes} onChange={toggle("unionYes")} />
              <CheckboxItem label="Union: No" checked={form.unionNo} onChange={toggle("unionNo")} />
              <CheckboxItem label="Currently In Probationary Period" checked={form.probationary} onChange={toggle("probationary")} />
              <CheckboxItem label="Past Union Probationary Period" checked={form.pastProbationary} onChange={toggle("pastProbationary")} />
            </div>
            {form.unionYes && <Field label="Union Name / Local" value={form.unionName} onChange={set("unionName")} />}
          </div>

          <SectionBar label="1. Work History – Prior Coaching / Counseling / Disciplinary Action" />
          <div style={{ padding: "1rem 2rem 0", overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
              <thead>
                <tr style={{ background: DARK }}>
                  {["Type of Action(s)", "Date(s) Given", "Issued By", "Description / Reason"].map((h) => (
                    <th key={h} style={{ padding: "6px 10px", color: WHITE, fontWeight: 700, textAlign: "left", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.04em", border: `1px solid ${BORDER}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {workHistory.map((row, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? WHITE : SOFT_BG }}>
                    <td style={{ padding: "6px 10px", border: `1px solid ${BORDER}`, fontSize: "0.8rem", whiteSpace: "nowrap" }}>{row.type}</td>
                    <td style={{ padding: "4px 6px", border: `1px solid ${BORDER}` }}>
                      <input type="date" value={row.date} onChange={(e) => updateHistory(i, "date", e.target.value)} style={{ ...inlineInputStyle, width: 130 }} />
                    </td>
                    <td style={{ padding: "4px 6px", border: `1px solid ${BORDER}` }}>
                      <input value={row.issuedBy} onChange={(e) => updateHistory(i, "issuedBy", e.target.value)} placeholder="Name" style={inlineInputStyle} />
                    </td>
                    <td style={{ padding: "4px 6px", border: `1px solid ${BORDER}` }}>
                      <input value={row.description} onChange={(e) => updateHistory(i, "description", e.target.value)} placeholder="Description" style={inlineInputStyle} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <SectionBar label="2. Current Situation – Infraction / Performance Issue(s)" />
          <div style={{ padding: "1.25rem 2rem 0" }}>
            {[
              ["workRuleViolation", "workRuleDetail", "Work rule violation:"],
              ["performance", "performanceDetail", "Performance:"],
              ["attendance", "attendanceDetail", "Attendance:"],
            ].map(([checkField, textField, label]) => (
              <div key={checkField} style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "0.75rem" }}>
                <CheckboxItem label={label} checked={form[checkField as keyof typeof form] as boolean} onChange={toggle(checkField)} />
                {form[checkField as keyof typeof form] && (
                  <input value={form[textField as keyof typeof form] as string} onChange={set(textField)} placeholder="Details..." style={{ ...inputStyle, flex: 1, marginBottom: 0 }} />
                )}
              </div>
            ))}
          </div>

          <SectionBar label="3. Facts – Details of the Incident / Situation – WHO, WHAT, WHERE, WHEN, HOW" />
          <div style={{ padding: "1.25rem 2rem 0" }}>
            <textarea value={form.facts} onChange={set("facts")} placeholder="Provide a detailed account of the incident..." rows={8} style={{ ...inputStyle, resize: "vertical" }} />
          </div>

          <SectionBar label="4. Expectation – Details of the Future Behavior We Expect from You" />
          <div style={{ padding: "1.25rem 2rem 0" }}>
            <textarea value={form.expectations} onChange={set("expectations")} placeholder="Describe expected future behavior..." rows={4} style={{ ...inputStyle, resize: "vertical" }} />
            <div style={{ fontSize: "0.78rem", color: TEXT, fontStyle: "italic", fontWeight: 600, background: SOFT_BG, border: `1px solid ${BORDER}`, borderLeft: `3px solid ${NAVY}`, borderRadius: 8, padding: "0.6rem 1rem", marginTop: "0.75rem" }}>
              NOTE: Failure to correct the behavior/performance above may result in further discipline, up to and including termination of employment.
            </div>
          </div>

          <SectionBar label="5. Consequences – Next Steps, Follow Up, and Consequences" />
          <div style={{ padding: "1.25rem 2rem 0" }}>
            <textarea value={form.consequences} onChange={set("consequences")} placeholder="Describe consequences and next steps..." rows={4} style={{ ...inputStyle, resize: "vertical" }} />
          </div>

          <SectionBar label="6. Documentation of Corrective Action" />
          <div style={{ padding: "1.25rem 2rem 0" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem 2rem", marginBottom: "1rem" }}>
              <CheckboxItem label="Verbal Warning" checked={form.actionVerbalWarning} onChange={toggle("actionVerbalWarning")} />
              <CheckboxItem label="Written Warning" checked={form.actionWrittenWarning} onChange={toggle("actionWrittenWarning")} />
              <CheckboxItem label="Final Written Warning" checked={form.actionFinalWrittenWarning} onChange={toggle("actionFinalWrittenWarning")} />
              <CheckboxItem label="Suspension" checked={form.actionSuspension} onChange={toggle("actionSuspension")} />
              <CheckboxItem label="*Termination" checked={form.actionTermination} onChange={toggle("actionTermination")} />
            </div>
            <Row>
              <Field label="Effective Date" value={form.effectiveDate} onChange={set("effectiveDate")} type="date" />
              <Field label="Dates of Suspension" value={form.suspensionDates} onChange={set("suspensionDates")} placeholder="e.g. June 9–10, 2026" />
            </Row>
            {form.actionSuspension && (
              <div style={{ display: "flex", gap: "1.5rem", marginBottom: "1rem" }}>
                <CheckboxItem label="Unpaid" checked={form.suspensionUnpaid} onChange={toggle("suspensionUnpaid")} />
                <CheckboxItem label="Paid" checked={form.suspensionPaid} onChange={toggle("suspensionPaid")} />
              </div>
            )}
            {form.actionTermination && (
              <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderLeft: "3px solid #b91c1c", borderRadius: 8, padding: "0.6rem 1rem", fontSize: "0.78rem", color: "#b91c1c", fontWeight: 600, marginBottom: "1rem" }}>
                * Unpaid disciplinary suspensions of greater than one day require review with Regional HR Manager or Director in advance.
              </div>
            )}
          </div>

          <SectionBar label="Supervisor Signature" />
          <div style={{ padding: "1.25rem 2rem 0" }}>
            <Row>
              <Field label="Supervisor Signature (type full name)" value={form.supervisorSignature} onChange={set("supervisorSignature")} placeholder="Full legal name" required />
              <Field label="Date Signed" value={form.supervisorDateSigned} onChange={set("supervisorDateSigned")} type="date" required />
            </Row>
            <Row>
              <Field label="Witness Signature (if applicable)" value={form.witnessSignature} onChange={set("witnessSignature")} placeholder="Full legal name" />
              <Field label="Witness Name Printed" value={form.witnessName} onChange={set("witnessName")} />
              <Field label="Date Witnessed" value={form.witnessDate} onChange={set("witnessDate")} type="date" />
            </Row>
          </div>

          <div style={{ padding: "1.5rem 2rem 0" }}>
            {error && (
              <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 12, padding: "0.75rem 1rem", fontSize: "0.82rem", color: "#b91c1c", marginBottom: "1rem" }}>
                {error}
              </div>
            )}
            <button onClick={handleSubmit} disabled={!required || submitting} style={{ ...btnStyle(required && !submitting ? NAVY : "#9ca3af"), cursor: required && !submitting ? "pointer" : "not-allowed" }}>
              {submitting ? "Filing..." : "File Disciplinary Notice"}
            </button>
            {!required && <div style={{ fontSize: "0.75rem", color: MUTED, textAlign: "center", marginTop: "0.5rem" }}>Complete required fields: Employee Name, Position, Site, Supervisor, Facts, and your Signature</div>}
          </div>

          <div style={{ borderTop: `1px solid ${BORDER}`, marginTop: "2rem", padding: "0.85rem 2rem 0", fontSize: "0.72rem", color: MUTED, textAlign: "center" }}>
            Allied Universal Security Services &nbsp;·&nbsp; Original – Personnel File &nbsp;·&nbsp; Copy – Employee &nbsp;·&nbsp; Copy – Supervisor &nbsp;·&nbsp; rev 8/1617
          </div>
        </div>
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

function Field({ label, value, onChange, placeholder, type = "text", required: req }: {
  label: string; value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string; type?: string; required?: boolean;
}) {
  return (
    <div style={{ marginBottom: "1rem" }}>
      <Label>{label}{req && <span style={{ color: "#b3261e", marginLeft: 2 }}>*</span>}</Label>
      <input type={type} value={value} onChange={onChange} placeholder={placeholder} style={inputStyle} />
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div className="stack-sm" style={{ display: "flex", gap: "1rem" }}>
      {Array.isArray(children) ? children.map((child, i) => <div key={i} style={{ flex: 1 }}>{child}</div>) : <div style={{ flex: 1 }}>{children}</div>}
    </div>
  );
}

function CheckboxItem({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: "0.85rem", color: "#1a1a2e", fontWeight: checked ? 600 : 400, userSelect: "none", marginBottom: "0.25rem" }}>
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
};

const inlineInputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", padding: "4px 6px",
  border: "1px solid #e5e7eb", borderRadius: 8, fontSize: "0.82rem",
  color: "#1a1a2e", background: "#fff", outline: "none", fontFamily: "inherit",
};

function btnStyle(bg: string): React.CSSProperties {
  return { background: bg, color: "#ffffff", border: "none", borderRadius: 12, padding: "0.7rem 1.75rem", fontSize: "0.85rem", fontWeight: 700, letterSpacing: "0.04em", cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase", width: "100%" };
}
