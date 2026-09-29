"use client";

import { useState, useEffect } from "react";
import { getPublicSupabase } from "@/lib/supabase";
import { getOfficer, rememberOfficer } from "@/lib/officer-memory";

const NAVY = "#1a4480";
const SOFT_BG = "#f2f5fa";
const WHITE = "#ffffff";
const MUTED = "#5b6474";
const BORDER = "#dbe2ec";
const TEXT = "#0f172a";
const SUPERVISOR_PHONE = "8542387112";

export default function AUSTimeOffForm() {
  const [form, setForm] = useState({
    employeeName: "",
    employeeNumber: "",
    account: "",
    manager: "",
    absenceType: "",
    otherType: "",
    reasonForAbsence: "",
    daysAndDates: "",
    employeeSignature: "",
    employeeDate: "",
  });

  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const setAbsence = (val: string) => () =>
    setForm((f) => ({ ...f, absenceType: f.absenceType === val ? "" : val }));

  const formatDate = (iso: string) => {
    if (!iso) return "";
    const [y, m, d] = iso.split("-");
    return `${m}/${d}/${y}`;
  };

  // Show what's missing (in red) once they've tried to submit.
  const [triedSubmit, setTriedSubmit] = useState(false);

  // Fill in the officer's details remembered from their last Allied form.
  useEffect(() => {
    const me = getOfficer();
    if (me.name) setForm((f) => ({ ...f, employeeName: f.employeeName || me.name || "", employeeNumber: f.employeeNumber || me.employeeNumber || "" }));
  }, []);

  const required =
    form.employeeName && form.absenceType && form.daysAndDates && form.employeeSignature;

  const handleSubmit = async () => {
    if (!required) { setTriedSubmit(true); return; }
    setSubmitting(true);
    setError("");

    const supabase = getPublicSupabase();
    const absenceType = form.absenceType === "Other"
      ? `Other: ${form.otherType}`
      : form.absenceType;

    const { error: dbError } = await supabase.from("time_off_requests").insert([{
      officer_name: form.employeeName,
      employee_number: form.employeeNumber || null,
      account: form.account || null,
      manager: form.manager || null,
      absence_type: absenceType,
      reason: form.reasonForAbsence || null,
      dates_requested: form.daysAndDates,
      employee_signature: form.employeeSignature,
      employee_date: form.employeeDate || null,
      status: "pending",
    }]);

    if (dbError) {
      setError("Submission failed. Please try again.");
      setSubmitting(false);
      return;
    }

    generatePDF();
    rememberOfficer({ name: form.employeeName.trim(), employeeNumber: form.employeeNumber.trim() || undefined });
    setSubmitted(true);
    setSubmitting(false);
  };

  const generatePDF = () => {
    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>AUS Time-off Request – ${form.employeeName || "Employee"}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  @page { size: letter; margin: 0.45in 0.5in; }
  body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background: #fff; color: #1a1a2e; font-size: 9.5pt; width: 100%; }
  .header { background: #1f4e79; padding: 10px 18px; display: flex; justify-content: space-between; align-items: center; }
  .brand { color: #fff; font-size: 11pt; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; }
  .brand span { font-weight: 300; }
  .tagline { color: rgba(255,255,255,0.6); font-size: 7pt; margin-top: 1px; }
  .header-right { text-align: right; }
  .header-right .title { color: #fff; font-size: 10.5pt; font-weight: 700; }
  .header-right .subtitle { color: rgba(255,255,255,0.75); font-size: 8pt; }
  .section-bar { background: #1a1a2e; color: #fff; padding: 4px 18px; font-size: 7pt; font-weight: 700; letter-spacing: 0.07em; text-transform: uppercase; margin-top: 10px; }
  .body { padding: 8px 18px 0; }
  .field { margin-bottom: 7px; }
  .field-label { font-size: 6.5pt; font-weight: 700; color: #374151; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 1px; }
  .field-value { border-bottom: 1pt solid #1f4e79; padding: 1px 0 2px 2px; font-size: 9.5pt; min-height: 16px; color: #1a1a2e; }
  .row { display: flex; gap: 16px; }
  .row .field { flex: 1; }
  .absence-row { display: flex; flex-wrap: wrap; gap: 5px 18px; margin: 6px 0 8px; }
  .checkbox-item { display: flex; align-items: center; gap: 5px; font-size: 8.5pt; }
  .box { width: 11px; height: 11px; border: 1pt solid #1f4e79; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; background: #fff; }
  .box.checked { background: #1f4e79; }
  .box.checked::after { content: '✓'; color: #fff; font-size: 7.5pt; line-height: 1; }
  .notice { background: #f4f6f9; border: 1px solid #d1d5db; border-left: 3px solid #1f4e79; border-radius: 2px; padding: 5px 10px; font-size: 7.5pt; font-style: italic; font-weight: 600; color: #1a1a2e; margin: 7px 0; }
  .sig-row { display: flex; gap: 16px; margin-top: 10px; }
  .sig-block { flex: 1; }
  .blank-line { border-bottom: 1pt solid #1a1a2e; min-height: 18px; padding-bottom: 1px; font-size: 9.5pt; margin-bottom: 2px; }
  .sig-label { font-size: 6.5pt; color: #6b7280; font-style: italic; }
  .manager-section { padding: 8px 18px 0; }
  .approval-note { background: #f4f6f9; border: 1px solid #d1d5db; border-left: 3px solid #a06a00; border-radius: 2px; padding: 4px 10px; font-size: 7.5pt; color: #6b4c00; font-weight: 600; margin: 6px 0 8px; }
  .check-row { display: flex; gap: 24px; margin: 5px 0; }
  .footer { border-top: 1px solid #d1d5db; margin-top: 10px; padding: 5px 18px 0; font-size: 7pt; color: #6b7280; text-align: center; }
  .divider { border: none; border-top: 1.5px dashed #d1d5db; margin: 10px 18px; }
</style>
</head>
<body>
<div class="header">
  <div>
    <div class="brand">Allied<span>Universal</span><sup style="font-size:5.5pt;font-weight:300">™</sup></div>
    <div class="tagline">There for you.</div>
  </div>
  <div class="header-right">
    <div class="title">Allied Universal Security Services</div>
    <div class="subtitle">Time-off Request Form</div>
  </div>
</div>
<div class="section-bar">Time Off Information — Employee</div>
<div class="body">
  <div class="row">
    <div class="field" style="flex:2"><div class="field-label">Employee Name</div><div class="field-value">${form.employeeName || ""}</div></div>
    <div class="field" style="flex:1"><div class="field-label">Employee Number</div><div class="field-value">${form.employeeNumber || ""}</div></div>
    <div class="field" style="flex:1"><div class="field-label">Account</div><div class="field-value">${form.account || ""}</div></div>
  </div>
  <div class="field"><div class="field-label">Manager</div><div class="field-value">${form.manager || ""}</div></div>
  <div class="field-label" style="margin-top:6px;">Type of Absence Requested</div>
  <div class="absence-row">
    <div class="checkbox-item"><div class="box ${form.absenceType === "Vacation" ? "checked" : ""}"></div><span>Vacation</span></div>
    <div class="checkbox-item"><div class="box ${form.absenceType === "Sick (If Applicable)" ? "checked" : ""}"></div><span>Sick (If Applicable)</span></div>
    <div class="checkbox-item"><div class="box ${form.absenceType === "Military (Must provide documentation)" ? "checked" : ""}"></div><span>Military (Must provide documentation)</span></div>
    <div class="checkbox-item"><div class="box ${form.absenceType === "Other" ? "checked" : ""}"></div><span>Other: ${form.absenceType === "Other" ? form.otherType : "___________"}</span></div>
  </div>
  <div class="row">
    <div class="field" style="flex:1"><div class="field-label">Reason For Absence</div><div class="field-value">${form.reasonForAbsence || ""}</div></div>
    <div class="field" style="flex:1"><div class="field-label">Day(s) and Date(s) of Absence</div><div class="field-value">${form.daysAndDates || ""}</div></div>
  </div>
  <div class="notice">All requests for time off must be submitted two (2) weeks in advance.</div>
  <div class="sig-row">
    <div class="sig-block"><div class="blank-line">${form.employeeSignature || ""}</div><div class="sig-label">Employee Signature</div></div>
    <div class="sig-block" style="max-width:160px;"><div class="blank-line">${formatDate(form.employeeDate)}</div><div class="sig-label">Date</div></div>
  </div>
</div>
<hr class="divider"/>
<div class="section-bar">Manager / Scheduling Supervisor Approval</div>
<div class="manager-section">
  <div class="row" style="margin-top:6px;align-items:flex-end;">
    <div class="field" style="max-width:220px;"><div class="field-label">Hours Available per Vacation Look-Up</div><div class="blank-line"></div></div>
    <div style="flex:1"></div>
  </div>
  <div class="check-row" style="margin-top:8px;">
    <div class="checkbox-item"><div class="box"></div><span>Time Off / Payout Approved</span></div>
    <div class="checkbox-item"><div class="box"></div><span>Time Off / Payout Rejected</span></div>
  </div>
  <div class="field" style="margin-top:6px;"><div class="field-label">If Rejected, Why:</div><div class="blank-line"></div></div>
  <div class="field-label" style="margin-top:6px;">For Time Off Approvals</div>
  <div style="margin-top:4px;">
    <div class="checkbox-item" style="margin-bottom:4px;"><div class="box"></div><span>Employee and vacation time entered into weekly schedule</span></div>
    <div class="checkbox-item"><div class="box"></div><span>Employee(s) covering shift(s) entered into weekly schedule</span></div>
  </div>
  <div class="approval-note">All shifts should be filled using employees with less than 40 scheduled hours first, as to not incur overtime.</div>
  <div class="sig-row">
    <div class="sig-block"><div class="blank-line"></div><div class="sig-label">Manager Signature</div></div>
    <div class="sig-block" style="max-width:160px;"><div class="blank-line"></div><div class="sig-label">Date</div></div>
  </div>
</div>
<div class="footer">Please keep all completed forms on file for audit purposes. &nbsp;·&nbsp; UPDATED 4/19 &nbsp;·&nbsp; Original – Personnel File &nbsp;·&nbsp; Copy – Employee &nbsp;·&nbsp; Copy – Supervisor</div>
</body>
</html>`;

    const win = window.open("", "_blank");
    if (win) {
      win.document.write(html);
      win.document.close();
      win.onload = () => { win.focus(); win.print(); };
    }
  };

  const openSMS = () => {
    const type = form.absenceType === "Other" ? `Other – ${form.otherType}` : form.absenceType || "unspecified";
    const body = encodeURIComponent(
      `AUS Time-Off Request\n\nEmployee: ${form.employeeName || "—"}\nEmp #: ${form.employeeNumber || "—"}\nAccount: ${form.account || "—"}\nManager: ${form.manager || "—"}\nType: ${type}\nReason: ${form.reasonForAbsence || "—"}\nDate(s): ${form.daysAndDates || "—"}\n\nPDF attached.`
    );
    window.location.href = `sms:${SUPERVISOR_PHONE}&body=${body}`;
  };

  const handleReset = () => {
    setForm({ employeeName: "", employeeNumber: "", account: "", manager: "", absenceType: "", otherType: "", reasonForAbsence: "", daysAndDates: "", employeeSignature: "", employeeDate: "" });
    setSubmitted(false);
    setError("");
  };

  return (
    <div style={{ minHeight: "100vh", background: SOFT_BG, fontFamily: "var(--font-sans)", padding: "2rem 1rem" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", background: WHITE, borderRadius: 12, boxShadow: "0 10px 30px rgba(15,23,42,0.08), 0 1px 3px rgba(15,23,42,0.06)", overflow: "hidden" }}>

        <div style={{ background: "linear-gradient(135deg, #0f2d57 0%, #1d4f91 100%)", padding: "1.5rem 2rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}>
          <div>
            <div style={{ color: WHITE, fontSize: "1.05rem", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Allied<span style={{ fontWeight: 300 }}>Universal</span><sup style={{ fontSize: "0.55rem", fontWeight: 300, marginLeft: 1 }}>™</sup>
            </div>
            <div style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.72rem", marginTop: 2, letterSpacing: "0.04em" }}>There for you.</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ color: WHITE, fontSize: "1rem", fontWeight: 700, lineHeight: 1.2 }}>Allied Universal Security Services</div>
            <div style={{ color: "rgba(255,255,255,0.75)", fontSize: "0.85rem" }}>Time-off Request Form</div>
          </div>
        </div>

        <div style={{ padding: "0 0 2rem" }}>
          <SectionBar label="Time Off Information" />
          <div style={{ padding: "1.5rem 2rem 0" }}>
            <Field label="Employee Name" value={form.employeeName} onChange={set("employeeName")} required />
            <Row>
              <Field label="Employee Number" value={form.employeeNumber} onChange={set("employeeNumber")} />
              <Field label="Account" value={form.account} onChange={set("account")} />
            </Row>
            <Field label="Manager" value={form.manager} onChange={set("manager")} />

            <div style={{ marginTop: "1.25rem", marginBottom: "0.5rem" }}>
              <Label>Type of Absence Requested <span style={{ color: "#b3261e" }}>*</span></Label>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem 1.5rem", marginBottom: "1.25rem" }}>
              {["Vacation", "Sick (If Applicable)", "Military (Must provide documentation)"].map((type) => (
                <CheckboxItem key={type} label={type} checked={form.absenceType === type} onChange={setAbsence(type)} />
              ))}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <CheckboxItem label="Other:" checked={form.absenceType === "Other"} onChange={setAbsence("Other")} />
                {form.absenceType === "Other" && (
                  <input value={form.otherType} onChange={set("otherType")} placeholder="Specify" style={{ ...inputStyle, width: 130 }} />
                )}
              </div>
            </div>

            <Field label="Reason For Absence" value={form.reasonForAbsence} onChange={set("reasonForAbsence")} />
            <Field label="Day(s) and Date(s) of Absence" value={form.daysAndDates} onChange={set("daysAndDates")} placeholder="e.g. Monday, June 9, 2026" required />

            <div style={{ background: SOFT_BG, border: `1px solid ${BORDER}`, borderLeft: `3px solid ${NAVY}`, borderRadius: 12, padding: "0.75rem 1rem", margin: "1.5rem 0", fontSize: "0.82rem", color: TEXT, fontStyle: "italic", fontWeight: 600 }}>
              All requests for time off must be submitted two (2) weeks in advance.
            </div>

            <Row>
              <Field label="Employee Signature (type full name)" value={form.employeeSignature} onChange={set("employeeSignature")} placeholder="Full legal name" required />
              <Field label="Date" value={form.employeeDate} onChange={set("employeeDate")} type="date" />
            </Row>
          </div>

          <SectionBar label="Manager / Scheduling Supervisor Approval" />
          <div style={{ padding: "1.25rem 2rem 0" }}>
            <div style={{ background: "#f9f9f9", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "1rem 1.25rem", color: MUTED, fontSize: "0.82rem", fontStyle: "italic" }}>
              This section is completed by your supervisor after receiving your request. It will appear blank and ready to fill on the printed PDF.
            </div>
          </div>

          <div style={{ padding: "1.75rem 2rem 0", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {error && (
              <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 12, padding: "0.75rem 1rem", fontSize: "0.82rem", color: "#b91c1c" }}>
                {error}
              </div>
            )}

            {!submitted ? (
              <>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  style={{ ...btnStyle(!submitting ? NAVY : "#9ca3af"), cursor: !submitting ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="12" y1="18" x2="12" y2="12" />
                    <line x1="9" y1="15" x2="15" y2="15" />
                  </svg>
                  {submitting ? "Submitting..." : "Submit & Generate PDF"}
                </button>
                {!required && (
                  <div style={{ fontSize: "0.76rem", color: triedSubmit ? "#b91c1c" : MUTED, fontWeight: triedSubmit ? 600 : 400, textAlign: "center" }}>
                    Complete required fields: Employee Name, Absence Type, Date(s), and Signature
                  </div>
                )}
              </>
            ) : (
              <>
                <div style={{ background: "#e8f5e9", border: "1px solid #a5d6a7", borderRadius: 12, padding: "0.75rem 1rem", fontSize: "0.83rem", color: "#2f6b3a", fontWeight: 600, textAlign: "center" }}>
                  Request submitted — PDF is ready. Save it from the print dialog, then text it to your supervisor.
                </div>
                <button onClick={openSMS} style={{ ...btnStyle("#2f6b3a"), display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  Text to Supervisor
                </button>
                <button onClick={generatePDF} style={{ ...btnStyle("transparent"), color: NAVY, border: `1px solid ${NAVY}`, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  Re-generate PDF
                </button>
                <button onClick={handleReset} style={{ ...btnStyle("transparent"), color: MUTED, border: `1px solid ${BORDER}`, fontSize: "0.78rem" }}>
                  Start New Form
                </button>
              </>
            )}
          </div>

          <div style={{ borderTop: `1px solid ${BORDER}`, marginTop: "2rem", padding: "0.85rem 2rem 0", fontSize: "0.73rem", color: MUTED, textAlign: "center" }}>
            Please keep all completed forms on file for audit purposes. &nbsp;·&nbsp; UPDATED 4/19
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
      {Array.isArray(children)
        ? children.map((child, i) => <div key={i} style={{ flex: 1 }}>{child}</div>)
        : <div style={{ flex: 1 }}>{children}</div>}
    </div>
  );
}

function CheckboxItem({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: "0.85rem", color: TEXT, fontWeight: checked ? 600 : 400, userSelect: "none" }}>
      <div onClick={onChange} style={{ width: 16, height: 16, border: `2px solid ${checked ? NAVY : BORDER}`, borderRadius: 2, background: checked ? NAVY : WHITE, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, cursor: "pointer", transition: "all 0.15s" }}>
        {checked && (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <polyline points="1.5,5 4,7.5 8.5,2.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
      <span onClick={onChange}>{label}</span>
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", padding: "0.75rem 0.9rem",
  border: "1px solid #d1d5db", borderRadius: 12, fontSize: "1rem",
  color: TEXT, background: "#ffffff", outline: "none", fontFamily: "inherit",
};

function btnStyle(bg: string): React.CSSProperties {
  return {
    background: bg, color: WHITE, border: "none", borderRadius: 12,
    padding: "0.7rem 1.75rem", fontSize: "0.85rem", fontWeight: 700,
    letterSpacing: "0.04em", cursor: "pointer", fontFamily: "inherit",
    textTransform: "uppercase", width: "100%",
  };
}
