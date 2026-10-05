"use client";

import { useState, useEffect, useRef } from "react";
import { getOfficer, rememberOfficer } from "@/lib/officer-memory";
import { useDraft, clearDraft } from "@/lib/drafts";
import { newId, sendOrQueue } from "@/lib/outbox";
import DraftNotice from "@/components/draft-notice";
import { describeDates, parseRequestedDates } from "@/lib/parse-dates";
import { buildTimeOffFormDocument, TimeOffRequest } from "./requests/timeoff-form-template";
import {
  C, SUPERVISORS, FormShell, Section, Label, Req, FieldError, TextField, ChoiceField, FixedLine,
  SignBox, StickyBar, PrimaryButton, MissingNote, DoneCard, Chip, chipWrap, inputStyle, todayIso, outlineButton,
} from "@/components/ui";

const SUPERVISOR_PHONE = "8542387112";
const DEFAULT_ACCOUNT = "Washington University";

// Stored values must match the printed form's checkbox labels exactly.
const ABSENCE_TYPES: [string, string][] = [
  ["Vacation", "Vacation"],
  ["Sick (If Applicable)", "Sick"],
  ["Military (Must provide documentation)", "Military"],
  ["Other", "Other"],
];

export default function AUSTimeOffForm() {
  const blank = () => ({
    employeeName: "",
    employeeNumber: "",
    account: DEFAULT_ACCOUNT,
    manager: "",
    absenceType: "",
    otherType: "",
    reasonForAbsence: "",
    daysAndDates: "",
    employeeSignature: "",
    employeeDate: todayIso(),
    pickedDates: [] as string[],
    useVacation: "" as "" | "yes" | "no",
    vacationInitials: "",
  });
  const [form, setForm] = useState(blank);
  const [editAccount, setEditAccount] = useState(false);
  const [typeDates, setTypeDates] = useState(false);

  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [triedSubmit, setTriedSubmit] = useState(false);

  const setField = (field: "employeeName" | "employeeNumber" | "account" | "manager" | "otherType" | "reasonForAbsence" | "daysAndDates" | "employeeDate" | "vacationInitials") =>
    (v: string) => setForm((f) => ({ ...f, [field]: v }));

  // Fill in the officer's details remembered from their last Allied form.
  const applyRemembered = () => {
    const me = getOfficer();
    if (me.name) setForm((f) => ({ ...f, employeeName: f.employeeName || me.name || "", employeeNumber: f.employeeNumber || me.employeeNumber || "" }));
  };
  useEffect(applyRemembered, []);

  // Signing follows the name if they edit it afterwards.
  useEffect(() => {
    setForm((f) => (f.employeeSignature && f.employeeSignature !== f.employeeName.trim() ? { ...f, employeeSignature: f.employeeName.trim() } : f));
  }, [form.employeeName]);

  // Keep an unsent request on this phone if the tab is closed or the screen locks.
  const [queued, setQueued] = useState(false);
  const draftHasContent = !!(form.absenceType || form.useVacation || form.reasonForAbsence.trim() || form.daysAndDates.trim() || form.manager.trim());
  const draftRestored = useDraft("timeoff", form, (saved) => setForm((f) => ({
    ...f, ...saved,
    pickedDates: Array.isArray(saved.pickedDates) ? saved.pickedDates : [],
    useVacation: saved.useVacation || "",
    vacationInitials: saved.vacationInitials || "",
    account: saved.account || DEFAULT_ACCOUNT,
    employeeDate: saved.employeeDate || todayIso(),
  })), draftHasContent && !submitted);

  // Initials for the vacation-time answer default to the officer's initials.
  const autoInitials = form.employeeName.trim().split(/\s+/).filter(Boolean).map((w) => w[0].toUpperCase()).join("").slice(0, 4);
  const vacationInitials = (form.vacationInitials.trim() || autoInitials).toUpperCase();

  const showTypedDates = typeDates || (!!form.daysAndDates && form.pickedDates.length === 0);

  const missing: { id: string; msg: string }[] = [];
  if (!form.employeeName.trim()) missing.push({ id: "employeeName", msg: "your name" });
  if (!form.absenceType) missing.push({ id: "absenceType", msg: "type of absence" });
  else if (form.absenceType === "Other" && !form.otherType.trim()) missing.push({ id: "absenceType", msg: "describe the other absence type" });
  if (!form.useVacation) missing.push({ id: "useVacation", msg: "use vacation time? yes or no" });
  if (!form.daysAndDates.trim()) missing.push({ id: "dates", msg: "the dates you need off" });
  if (!form.employeeSignature) missing.push({ id: "sign-box", msg: "tick the box to sign" });
  const err = (id: string) => triedSubmit && missing.some((m) => m.id === id);

  const handleSubmit = async () => {
    if (submitting) return;
    if (missing.length > 0) {
      setTriedSubmit(true);
      document.getElementById(missing[0].id)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
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
      setError("Submission failed. Please check your connection and try again.");
      setSubmitting(false);
      return;
    }

    clearDraft("timeoff");
    setQueued(result.status === "queued");
    generatePDF();
    rememberOfficer({ name: form.employeeName.trim(), employeeNumber: form.employeeNumber.trim() || undefined });
    setSubmitted(true);
    setSubmitting(false);
    window.scrollTo(0, 0);
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
    setForm(blank());
    setSubmitted(false);
    setQueued(false);
    setTriedSubmit(false);
    setTypeDates(false);
    setEditAccount(false);
    setError("");
    applyRemembered();
  };

  const startOver = () => { clearDraft("timeoff"); handleReset(); };

  if (submitted) {
    return (
      <DoneCard title={queued ? "Request saved" : "Request submitted"} tone={queued ? "wait" : "ok"}>
        <div style={{ color: C.muted, fontSize: "0.95rem", marginBottom: "1.25rem", lineHeight: 1.6 }}>
          {queued
            ? <>No signal, so your request is saved on this phone and will send automatically when you&apos;re back online. Your PDF is ready to save now.</>
            : <>Your request for <strong style={{ color: C.text }}>{form.daysAndDates}</strong> was sent. Save the PDF from the print screen, then text it to your supervisor.</>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          <button type="button" onClick={openSMS} style={{ ...outlineButton, background: C.green, borderColor: C.green, color: C.white }}>Text to supervisor</button>
          <button type="button" onClick={generatePDF} style={outlineButton}>Print / save PDF again</button>
          <a href="/forms" style={{ ...outlineButton, color: C.muted, borderColor: C.border }}>Back to all forms</a>
          <button type="button" onClick={handleReset} style={{ ...outlineButton, color: C.muted, borderColor: C.border }}>Start a new request</button>
        </div>
      </DoneCard>
    );
  }

  return (
    <FormShell
      title="Request time off"
      subtitle="Vacation, sick or personal time. Requests must be in two (2) weeks ahead."
      footer="Allied Universal Security Services · Please keep all completed forms on file for audit purposes. · UPDATED 4/19"
      bar={
        <StickyBar>
          {triedSubmit && <MissingNote items={missing.map((m) => m.msg)} />}
          {error && <div style={{ fontSize: "0.88rem", color: C.red, fontWeight: 600, marginBottom: "0.6rem", textAlign: "center" }}>{error}</div>}
          <PrimaryButton onClick={handleSubmit} disabled={submitting}>{submitting ? "Sending…" : "Submit & get PDF"}</PrimaryButton>
        </StickyBar>
      }
    >
      {draftRestored && <div style={{ marginTop: "1.25rem" }}><DraftNotice what="time-off request" onStartOver={startOver} /></div>}

      <Section title="About you">
        <TextField id="employeeName" label="Your name" value={form.employeeName} onChange={setField("employeeName")} required placeholder="First and last name" autoComplete="name" error={err("employeeName") && "Enter your name"} />
        <TextField label="Employee number" value={form.employeeNumber} onChange={setField("employeeNumber")} optional inputMode="numeric" placeholder="If you know it" />
        <FixedLine text={`Account: ${form.account || "—"}`} editing={editAccount} onToggle={() => setEditAccount((v) => !v)} />
        {editAccount && <TextField label="Account" value={form.account} onChange={setField("account")} placeholder="e.g. Washington University" />}
        <ChoiceField label="Your manager" options={SUPERVISORS} value={form.manager} onChange={setField("manager")} optional otherPlaceholder="Manager's name" />
      </Section>

      <Section title="Your time off">
        <div id="absenceType" style={{ marginBottom: "1.25rem" }}>
          <Label>Type of absence<Req /></Label>
          <div style={chipWrap}>
            {ABSENCE_TYPES.map(([value, label]) => (
              <Chip key={value} selected={form.absenceType === value} onClick={() => setForm((f) => ({ ...f, absenceType: f.absenceType === value ? "" : value }))}>{label}</Chip>
            ))}
          </div>
          {form.absenceType === "Military (Must provide documentation)" && <div style={{ fontSize: "0.85rem", color: C.muted, marginTop: 6 }}>Military leave needs documentation.</div>}
          {form.absenceType === "Sick (If Applicable)" && <div style={{ fontSize: "0.85rem", color: C.muted, marginTop: 6 }}>Sick time if applicable.</div>}
          {form.absenceType === "Other" && (
            <input value={form.otherType} onChange={(e) => setField("otherType")(e.target.value)} placeholder="What kind of absence?" style={{ ...inputStyle(err("absenceType")), marginTop: "0.6rem" }} autoFocus />
          )}
          <FieldError msg={err("absenceType") && (form.absenceType === "Other" ? "Describe the absence type" : "Pick a type")} />
        </div>

        <div id="useVacation" style={{ marginBottom: "1.25rem" }}>
          <Label>Use vacation time if available?<Req /></Label>
          <div style={{ ...chipWrap, alignItems: "center" }}>
            <Chip selected={form.useVacation === "yes"} onClick={() => setForm((f) => ({ ...f, useVacation: "yes" }))}>Yes</Chip>
            <Chip selected={form.useVacation === "no"} onClick={() => setForm((f) => ({ ...f, useVacation: "no" }))}>No</Chip>
            {form.useVacation && (
              <label style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto", fontSize: "0.9rem", color: C.muted }}>
                Initials
                <input value={form.vacationInitials} onChange={(e) => setField("vacationInitials")(e.target.value)} placeholder={autoInitials || "AB"} maxLength={4} style={{ ...inputStyle(false), width: 76, textAlign: "center", textTransform: "uppercase", padding: "0.6rem 0.5rem" }} />
              </label>
            )}
          </div>
          <FieldError msg={err("useVacation") && "Pick Yes or No"} />
        </div>

        <TextField label="Reason for absence" value={form.reasonForAbsence} onChange={setField("reasonForAbsence")} optional placeholder="e.g. Family trip" />

        <div id="dates" style={{ marginBottom: "0.5rem" }}>
          <DatePicker
            picked={form.pickedDates}
            error={err("dates") && !showTypedDates}
            onChange={(dates) => { setTypeDates(false); setForm((f) => ({ ...f, pickedDates: dates, daysAndDates: describeDates(dates) })); }}
          />
          {showTypedDates ? (
            <div style={{ marginTop: "0.75rem" }}>
              <Label>Day(s) and date(s) of absence<Req /></Label>
              <input value={form.daysAndDates} onChange={(e) => setForm((f) => ({ ...f, daysAndDates: e.target.value, pickedDates: [] }))} placeholder="e.g. Monday, June 9, 2026" style={inputStyle(err("dates"))} />
            </div>
          ) : form.daysAndDates ? (
            <div style={{ marginTop: "0.6rem", fontSize: "0.9rem", color: C.muted, lineHeight: 1.5 }}>
              Prints as: <span style={{ color: C.text, fontWeight: 600 }}>{form.daysAndDates}</span>
            </div>
          ) : (
            <button type="button" onClick={() => setTypeDates(true)} style={{ marginTop: "0.6rem", background: "none", border: "none", padding: 0, minHeight: 0, color: C.navy, fontWeight: 700, textDecoration: "underline", cursor: "pointer", fontFamily: "inherit", fontSize: "0.9rem" }}>
              Type the dates instead
            </button>
          )}
          <FieldError msg={err("dates") && "Add the dates you need off"} />
        </div>
      </Section>

      <Section title="Sign">
        <SignBox
          name={form.employeeName}
          signed={!!form.employeeSignature}
          onChange={(s) => setForm((f) => ({ ...f, employeeSignature: s ? f.employeeName.trim() : "" }))}
          error={err("sign-box")}
          statement={<span style={{ color: C.muted, fontSize: "0.88rem" }}>Your supervisor completes the approval section after receiving your request.</span>}
        />
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginTop: "0.75rem", fontSize: "0.9rem", color: C.muted }}>
          <span>Date</span>
          <input type="date" value={form.employeeDate} onChange={(e) => setField("employeeDate")(e.target.value)} style={{ ...inputStyle(false), width: "auto", padding: "0.5rem 0.7rem", fontSize: "0.95rem" }} />
        </div>
      </Section>
    </FormShell>
  );
}

// Tap-to-pick dates: fills in "Day(s) and Date(s)" so the supervisor calendar
// knows exactly which days are requested. Typing the dates still works.
function DatePicker({ picked, onChange, error }: { picked: string[]; onChange: (dates: string[]) => void; error?: boolean }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const today = todayIso();
  // Dates add themselves as soon as they're picked; this remembers which ones
  // came from the current First/Last boxes so changing them replaces those.
  const current = useRef<string[]>([]);

  const daysBetween = (a: string, b: string) => {
    const out: string[] = [];
    for (let t = Date.parse(`${a}T12:00:00Z`); t <= Date.parse(`${b}T12:00:00Z`) && out.length < 400; t += 86400000) out.push(new Date(t).toISOString().slice(0, 10));
    return out;
  };
  const apply = (a: string, b: string) => {
    const keep = picked.filter((d) => !current.current.includes(d));
    const added = a ? daysBetween(a, b && b >= a ? b : a) : [];
    current.current = added.filter((d) => !keep.includes(d));
    onChange(Array.from(new Set([...keep, ...added])).sort());
  };
  const another = () => { current.current = []; setFrom(""); setTo(""); };

  const groups: string[][] = [];
  for (const d of picked) {
    const last = groups[groups.length - 1];
    if (last && Date.parse(d) - Date.parse(last[last.length - 1]) === 86400000) last.push(d);
    else groups.push([d]);
  }
  const short = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

  return (
    <div style={{ background: C.softBg, border: `1.5px solid ${error ? C.red : C.border}`, borderRadius: 14, padding: "0.9rem 1rem" }}>
      <Label>Dates you need off<Req /></Label>
      <div className="picker-row" style={{ display: "flex", gap: "0.6rem", alignItems: "flex-end" }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "0.82rem", color: C.muted, marginBottom: 4 }}>First day off</div>
          <input type="date" value={from} min={today} onChange={(e) => { const v = e.target.value; const t = to && to >= v ? to : ""; setFrom(v); setTo(t); apply(v, t); }} style={inputStyle(false)} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "0.82rem", color: C.muted, marginBottom: 4 }}>Last day off <span style={{ opacity: 0.8 }}>(if more than one)</span></div>
          <input type="date" value={to} min={from || today} disabled={!from} onChange={(e) => { setTo(e.target.value); apply(from, e.target.value); }} style={{ ...inputStyle(false), opacity: from ? 1 : 0.55 }} />
        </div>
      </div>
      {groups.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.45rem", marginTop: "0.75rem", alignItems: "center" }}>
          {groups.map((g) => (
            <span key={g[0]} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: C.white, border: `1.5px solid ${C.navy}`, color: C.navy, borderRadius: 999, padding: "0.35rem 0.5rem 0.35rem 0.8rem", fontSize: "0.9rem", fontWeight: 600 }}>
              {g.length === 1 ? short(g[0]) : `${short(g[0])} – ${short(g[g.length - 1])}`}
              <button type="button" aria-label="Remove" onClick={() => { current.current = current.current.filter((d) => !g.includes(d)); onChange(picked.filter((d) => !g.includes(d))); }} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: "0.95rem", padding: "0 0.2rem", minHeight: 0, lineHeight: 1 }}>✕</button>
            </span>
          ))}
          {from && <button type="button" onClick={another} style={{ background: "none", border: `1.5px dashed ${C.navy}`, color: C.navy, borderRadius: 999, padding: "0.35rem 0.8rem", fontSize: "0.88rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", minHeight: 0 }}>+ Another date</button>}
        </div>
      )}
    </div>
  );
}
