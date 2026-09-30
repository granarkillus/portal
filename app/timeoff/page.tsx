"use client";

import { useState, useEffect } from "react";
import { getOfficer, rememberOfficer } from "@/lib/officer-memory";
import { useDraft, clearDraft } from "@/lib/drafts";
import { newId, sendOrQueue } from "@/lib/outbox";
import DraftNotice from "@/components/draft-notice";
import { describeDates, parseRequestedDates } from "@/lib/parse-dates";
import { buildTimeOffFormDocument, TimeOffRequest } from "./requests/timeoff-form-template";

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
    pickedDates: [] as string[],
    useVacation: "" as "" | "yes" | "no",
    vacationInitials: "",
  });

  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const setAbsence = (val: string) => () =>
    setForm((f) => ({ ...f, absenceType: f.absenceType === val ? "" : val }));

  // Show what's missing (in red) once they've tried to submit.
  const [triedSubmit, setTriedSubmit] = useState(false);

  // Fill in the officer's details remembered from their last Allied form.
  useEffect(() => {
    const me = getOfficer();
    if (me.name) setForm((f) => ({ ...f, employeeName: f.employeeName || me.name || "", employeeNumber: f.employeeNumber || me.employeeNumber || "" }));
  }, []);

  // Keep an unsent request on this phone if the tab is closed or the screen locks.
  const [queued, setQueued] = useState(false);
  const draftHasContent = !!(form.absenceType || form.useVacation || form.reasonForAbsence.trim() || form.daysAndDates.trim() || form.employeeSignature.trim() || form.account.trim() || form.manager.trim());
  const draftRestored = useDraft("timeoff", form, (saved) => setForm((f) => ({ ...f, ...saved, pickedDates: Array.isArray(saved.pickedDates) ? saved.pickedDates : [], useVacation: saved.useVacation || "", vacationInitials: saved.vacationInitials || "" })), draftHasContent && !submitted);

  // Initials for the vacation-time answer default to the officer's initials.
  const autoInitials = form.employeeName.trim().split(/\s+/).filter(Boolean).map((w) => w[0].toUpperCase()).join("").slice(0, 4);
  const vacationInitials = (form.vacationInitials.trim() || autoInitials).toUpperCase();

  const required =
    form.employeeName && form.absenceType && form.useVacation && form.daysAndDates && form.employeeSignature;

  const handleSubmit = async () => {
    if (!required) { setTriedSubmit(true); return; }
    setSubmitting(true);
    setError("");

    const absenceType = form.absenceType === "Other"
      ? `Other: ${form.otherType}`
      : form.absenceType;

    // Real calendar dates for the supervisor calendar: the picked dates, or
    // what we can read from the typed text (flagged if we're not sure).
    const picked = form.pickedDates.length > 0 && form.daysAndDates === describeDates(form.pickedDates);
    const parsed = picked ? { dates: form.pickedDates, confident: true } : parseRequestedDates(form.daysAndDates);

    const result = await sendOrQueue("timeoff", "time_off_requests", {
      id: newId(),
      officer_name: form.employeeName,
      employee_number: form.employeeNumber || null,
      account: form.account || null,
      manager: form.manager || null,
      absence_type: absenceType,
      reason: form.reasonForAbsence || null,
      dates_requested: form.daysAndDates,
      requested_dates: parsed.dates.length ? parsed.dates : null,
      dates_need_review: !parsed.confident,
      employee_signature: form.employeeSignature,
      employee_date: form.employeeDate || null,
      use_vacation: form.useVacation === "yes",
      vacation_initials: vacationInitials || null,
      status: "pending",
    }, `Time-off request: ${form.daysAndDates}`);

    if (result.status === "failed") {
      setError("Submission failed. Please try again.");
      setSubmitting(false);
      return;
    }

    clearDraft("timeoff");
    setQueued(result.status === "queued");
    generatePDF();
    rememberOfficer({ name: form.employeeName.trim(), employeeNumber: form.employeeNumber.trim() || undefined });
    setSubmitted(true);
    setSubmitting(false);
  };

  // Prints the officer's copy on the official Allied Universal Time-off
  // Request Form (the same template supervisors print from Requests). A new
  // request has no decision yet, so the manager section prints blank.
  const generatePDF = () => {
    const request: TimeOffRequest = {
      id: "",
      officer_name: form.employeeName,
      employee_number: form.employeeNumber,
      account: form.account,
      manager: form.manager,
      absence_type: form.absenceType === "Other" ? `Other: ${form.otherType}` : form.absenceType,
      reason: form.reasonForAbsence,
      dates_requested: form.daysAndDates,
      employee_signature: form.employeeSignature,
      employee_date: form.employeeDate,
      use_vacation: form.useVacation === "yes",
      vacation_initials: vacationInitials,
      status: "pending",
      hours_available: null,
      approval_decision: null,
      rejection_reason: null,
      vacation_entered: null,
      covering_entered: null,
      manager_signature: null,
      manager_date: null,
      submitted_at: new Date().toISOString(),
    };
    const html = buildTimeOffFormDocument(request);
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
      `AUS Time-Off Request\n\nEmployee: ${form.employeeName || "—"}\nEmp #: ${form.employeeNumber || "—"}\nAccount: ${form.account || "—"}\nManager: ${form.manager || "—"}\nType: ${type}\nUse vacation time: ${form.useVacation === "yes" ? "Yes" : form.useVacation === "no" ? "No" : "—"}\nReason: ${form.reasonForAbsence || "—"}\nDate(s): ${form.daysAndDates || "—"}\n\nPDF attached.`
    );
    window.location.href = `sms:${SUPERVISOR_PHONE}&body=${body}`;
  };

  const handleReset = () => {
    setForm({ employeeName: "", employeeNumber: "", account: "", manager: "", absenceType: "", otherType: "", reasonForAbsence: "", daysAndDates: "", employeeSignature: "", employeeDate: "", pickedDates: [], useVacation: "", vacationInitials: "" });
    setSubmitted(false);
    setQueued(false);
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
          {draftRestored && !submitted && <div style={{ padding: "1.25rem 2rem 0" }}><DraftNotice what="time-off request" onStartOver={() => { clearDraft("timeoff"); handleReset(); const me = getOfficer(); if (me.name) setForm((f) => ({ ...f, employeeName: me.name || "", employeeNumber: me.employeeNumber || "" })); }} /></div>}

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

            <div style={{ background: SOFT_BG, border: `1px solid ${triedSubmit && !form.useVacation ? "#b91c1c" : BORDER}`, borderRadius: 12, padding: "0.9rem 1rem", marginBottom: "1.25rem" }}>
              <Label>Do you want to use vacation time if available? <span style={{ color: "#b3261e" }}>*</span></Label>
              <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", alignItems: "center" }}>
                {(["yes", "no"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={form.useVacation === v}
                    onClick={() => setForm((f) => ({ ...f, useVacation: v }))}
                    style={{ minWidth: 88, minHeight: 46, borderRadius: 999, fontFamily: "inherit", fontSize: "0.98rem", fontWeight: 700, cursor: "pointer", border: `1.5px solid ${form.useVacation === v ? NAVY : BORDER}`, background: form.useVacation === v ? NAVY : WHITE, color: form.useVacation === v ? WHITE : TEXT }}
                  >
                    {form.useVacation === v ? "✓ " : ""}{v === "yes" ? "Yes" : "No"}
                  </button>
                ))}
                {form.useVacation && (
                  <label style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto", fontSize: "0.9rem", color: MUTED }}>
                    Initials
                    <input value={form.vacationInitials} onChange={set("vacationInitials")} placeholder={autoInitials || "AB"} maxLength={4} style={{ ...inputStyle, width: 80, textAlign: "center", textTransform: "uppercase" }} />
                  </label>
                )}
              </div>
              {triedSubmit && !form.useVacation && <div style={{ color: "#b91c1c", fontSize: "0.85rem", fontWeight: 600, marginTop: 6 }}>Pick Yes or No</div>}
            </div>

            <Field label="Reason For Absence" value={form.reasonForAbsence} onChange={set("reasonForAbsence")} />
            <DatePicker
              picked={form.pickedDates}
              onChange={(dates) => setForm((f) => ({ ...f, pickedDates: dates, daysAndDates: describeDates(dates) }))}
            />
            <Field label="Day(s) and Date(s) of Absence" value={form.daysAndDates} onChange={set("daysAndDates")} placeholder="Pick dates above, or type them, e.g. Monday, June 9, 2026" required />

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
                    Complete required fields: Employee Name, Absence Type, Use Vacation Time, Date(s), and Signature
                  </div>
                )}
              </>
            ) : (
              <>
                {queued ? (
                  <div style={{ background: "#fff7ed", border: "1px solid #fdba74", borderRadius: 12, padding: "0.75rem 1rem", fontSize: "0.83rem", color: "#7c2d12", fontWeight: 600, textAlign: "center", lineHeight: 1.5 }}>
                    No signal, so your request is saved on this phone and will send automatically when you&apos;re back online. Your PDF is ready to save now.
                  </div>
                ) : (
                  <div style={{ background: "#e8f5e9", border: "1px solid #a5d6a7", borderRadius: 12, padding: "0.75rem 1rem", fontSize: "0.83rem", color: "#2f6b3a", fontWeight: 600, textAlign: "center" }}>
                    Request submitted — PDF is ready. Save it from the print dialog, then text it to your supervisor.
                  </div>
                )}
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

// Tap-to-pick dates: fills in "Day(s) and Date(s)" so the supervisor calendar
// knows exactly which days are requested. Typing the dates still works.
function DatePicker({ picked, onChange }: { picked: string[]; onChange: (dates: string[]) => void }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });

  const add = () => {
    if (!from) return;
    const end = to && to >= from ? to : from;
    const out = new Set(picked);
    for (let t = Date.parse(`${from}T12:00:00Z`); t <= Date.parse(`${end}T12:00:00Z`) && out.size < 400; t += 86400000) {
      out.add(new Date(t).toISOString().slice(0, 10));
    }
    onChange(Array.from(out).sort());
    setFrom(""); setTo("");
  };

  const groups: string[][] = [];
  for (const d of picked) {
    const last = groups[groups.length - 1];
    if (last && Date.parse(d) - Date.parse(last[last.length - 1]) === 86400000) last.push(d);
    else groups.push([d]);
  }
  const short = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

  return (
    <div style={{ background: SOFT_BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "0.9rem 1rem", marginBottom: "0.75rem" }}>
      <Label>📅 Pick your dates <span style={{ color: "#b3261e" }}>*</span></Label>
      <div className="picker-row" style={{ display: "flex", gap: "0.6rem", alignItems: "flex-end" }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "0.8rem", color: MUTED, marginBottom: 4 }}>First day off</div>
          <input type="date" value={from} min={today} onChange={(e) => { setFrom(e.target.value); if (to && to < e.target.value) setTo(""); }} style={inputStyle} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "0.8rem", color: MUTED, marginBottom: 4 }}>Last day off <span style={{ opacity: 0.8 }}>(if more than one)</span></div>
          <input type="date" value={to} min={from || today} onChange={(e) => setTo(e.target.value)} style={inputStyle} />
        </div>
        <button type="button" onClick={add} disabled={!from} style={{ background: from ? NAVY : "#94a3b8", color: WHITE, border: "none", borderRadius: 12, padding: "0.75rem 1.1rem", fontWeight: 700, fontFamily: "inherit", fontSize: "0.95rem", cursor: from ? "pointer" : "not-allowed", minHeight: 48 }}>
          Add
        </button>
      </div>
      {groups.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.45rem", marginTop: "0.75rem" }}>
          {groups.map((g) => (
            <span key={g[0]} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: WHITE, border: `1.5px solid ${NAVY}`, color: NAVY, borderRadius: 999, padding: "0.35rem 0.5rem 0.35rem 0.8rem", fontSize: "0.88rem", fontWeight: 600 }}>
              {g.length === 1 ? short(g[0]) : `${short(g[0])} – ${short(g[g.length - 1])}`}
              <button type="button" aria-label="Remove" onClick={() => onChange(picked.filter((d) => !g.includes(d)))} style={{ background: "none", border: "none", color: MUTED, cursor: "pointer", fontSize: "0.95rem", padding: "0 0.2rem", minHeight: 0, lineHeight: 1 }}>✕</button>
            </span>
          ))}
        </div>
      )}
      <div style={{ fontSize: "0.8rem", color: MUTED, marginTop: "0.6rem" }}>Add each day or stretch of days you need off. You can add more than one.</div>
    </div>
  );
}
