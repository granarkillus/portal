"use client";

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { getOfficer, rememberOfficer, forgetOfficer } from "@/lib/officer-memory";

const getSupabase = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

const NAVY = "#1a4480";
const SOFT_BG = "#f2f5fa";
const WHITE = "#ffffff";
const MUTED = "#5b6474";
const BORDER = "#dbe2ec";
const TEXT = "#0f172a";
const GREEN = "#15803d";
const RED = "#b91c1c";

// Most-used posts (from past submissions), so officers can tap instead of type.
const POSTS = ["Lofts", "Lofts Enright", "Ackert Walkway", "Greenway Walk", "West Campus", "North Campus", "South Campus", "McPherson", "Core"];
const REASONS = ["Illness", "Family emergency", "Personal emergency", "Bereavement", "Medical appointment", "Other"];

// These exact phrases are what's stored and emailed; don't reword them.
const NOTICE_4PLUS = "4+ hours advance notice";
const NOTICE_UNDER4 = "Less than 4 hours notice";

// Minutes from now until the shift starts, both measured in St. Louis time.
function minutesUntilShift(date: string, start: string): number | null {
  if (!date || !start) return null;
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date()).map((p) => [p.type, p.value])
  );
  const nowCT = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = start.split(":").map(Number);
  if ([y, m, d, hh, mm].some((n) => Number.isNaN(n))) return null;
  return Math.round((Date.UTC(y, m - 1, d, hh, mm) - nowCT) / 60000);
}

function formatDuration(mins: number): string {
  const h = Math.floor(Math.abs(mins) / 60);
  const m = Math.abs(mins) % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function CallOffForm() {
  // Today's date in St. Louis (toISOString is UTC, which rolls to tomorrow in the evening).
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
  const tomorrow = addDays(today, 1);

  const emptyForm = {
    officerName: "",
    employeeNumber: "",
    post: "",
    shiftDate: today,
    shiftStart: "",
    shiftEnd: "",
    reason: "",
    otherReason: "",
    coverageFound: "",
    coverageName: "",
    comments: "",
  };
  const [form, setForm] = useState(emptyForm);
  const [otherPost, setOtherPost] = useState(false);
  const [otherDate, setOtherDate] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [remembered, setRemembered] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [copySuccess, setCopySuccess] = useState(false);
  const [submittedData, setSubmittedData] = useState<{
    name: string; post: string; shiftDate: string; shiftStart: string;
    shiftEnd: string; noticeType: string; reason: string; timestamp: string;
  } | null>(null);

  // Fill in the officer's details if this phone has submitted a form before.
  const applyRemembered = () => {
    const me = getOfficer();
    if (!me.name) return;
    setRemembered(true);
    setForm((f) => ({ ...f, officerName: me.name || "", employeeNumber: me.employeeNumber || "", post: me.post || "" }));
    setOtherPost(!!me.post && !POSTS.includes(me.post));
  };
  useEffect(applyRemembered, []);

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const formatDate = (iso: string) => {
    if (!iso) return "";
    const [y, m, d] = iso.split("-");
    return `${m}/${d}/${y}`;
  };

  // Notice type is worked out from the shift start, not picked by hand.
  const minsUntil = minutesUntilShift(form.shiftDate, form.shiftStart);
  const noticeType = minsUntil === null ? "" : minsUntil >= 240 ? NOTICE_4PLUS : NOTICE_UNDER4;

  const reasonText = form.reason === "Other" ? form.otherReason.trim() : form.reason;
  const missing: { id: string; msg: string }[] = [];
  if (!form.officerName.trim()) missing.push({ id: "officerName", msg: "Enter your name" });
  if (!form.post.trim()) missing.push({ id: "post", msg: "Pick your post" });
  if (!form.shiftDate) missing.push({ id: "shiftDate", msg: "Pick the date you're missing" });
  if (!form.shiftStart) missing.push({ id: "shiftStart", msg: "Enter your shift start time" });
  if (!reasonText) missing.push({ id: "reason", msg: form.reason === "Other" ? "Describe your reason" : "Pick a reason" });
  if (!confirmed) missing.push({ id: "confirm", msg: "Tick the box to confirm and sign" });
  const errorFor = (id: string) => (showErrors ? missing.find((m) => m.id === id)?.msg : undefined);

  const handleSubmit = async () => {
    if (submitting) return;
    if (missing.length > 0) {
      setShowErrors(true);
      document.getElementById(missing[0].id)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setSubmitting(true);
    setError("");

    const supabase = getSupabase();
    const timestamp = new Date().toISOString();
    const officerName = form.officerName.trim().replace(/\s+/g, " ");
    let docUrl: string | null = null;

    if (file) {
      // Documents are private: store the file's path; supervisors open it with a signed link.
      const fileExt = (file.name.split(".").pop() || "").replace(/[^A-Za-z0-9]/g, "");
      const safeName = officerName.replace(/[^A-Za-z0-9]+/g, "-");
      const fileName = `calloff-${Date.now()}-${safeName}.${fileExt}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("calloff-documents")
        .upload(fileName, file, { cacheControl: "3600", upsert: false });
      if (uploadError || !uploadData) {
        setError("Your document didn't upload. Try again, or remove it to submit without it.");
        setSubmitting(false);
        return;
      }
      docUrl = fileName;
    }

    const { error: dbError } = await supabase.from("calloff_submissions").insert([{
      officer_name: officerName,
      employee_number: form.employeeNumber.trim() || null,
      post: form.post.trim(),
      shift_date: form.shiftDate,
      shift_start: form.shiftStart,
      shift_end: form.shiftEnd || null,
      notice_type: noticeType,
      reason: reasonText,
      coverage_found: form.coverageFound === "yes",
      coverage_name: form.coverageName.trim() || null,
      comments: form.comments.trim() || null,
      // Confirming the box signs with the officer's name.
      signature: officerName,
      document_url: docUrl,
      submitted_at: timestamp,
    }]);

    if (dbError) {
      setError("Submission failed. Please check your connection and try again.");
      setSubmitting(false);
      return;
    }

    rememberOfficer({ name: officerName, employeeNumber: form.employeeNumber.trim(), post: form.post.trim() });

    setSubmittedData({
      name: officerName, post: form.post.trim(), shiftDate: formatDate(form.shiftDate),
      shiftStart: form.shiftStart, shiftEnd: form.shiftEnd, noticeType,
      reason: reasonText,
      timestamp: new Date(timestamp).toLocaleString("en-US", { month: "numeric", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true }),
    });

    setSubmitted(true);
    setSubmitting(false);
    window.scrollTo(0, 0);
  };

  const getCopyMessage = () => {
    if (!submittedData) return "";
    return `CALL-OFF RECEIPT — ${submittedData.shiftDate}

Name: ${submittedData.name}
Post: ${submittedData.post}
Shift: ${submittedData.shiftStart}${submittedData.shiftEnd ? ` – ${submittedData.shiftEnd}` : ""}
Reason: ${submittedData.reason}
Notice Type: ${submittedData.noticeType}
Submitted: ${submittedData.timestamp}

Your supervisor has been notified by email.`;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getCopyMessage()).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2500);
    });
  };

  const handleReset = () => {
    setForm(emptyForm);
    setOtherPost(false); setOtherDate(false); setConfirmed(false); setShowErrors(false);
    setFile(null); setSubmitted(false); setSubmittedData(null); setError("");
    applyRemembered();
  };

  const notForgetMe = () => {
    forgetOfficer();
    setRemembered(false);
    setForm((f) => ({ ...f, officerName: "", employeeNumber: "", post: "" }));
    setOtherPost(false);
  };

  if (submitted && submittedData) {
    return (
      <div style={{ minHeight: "100vh", background: SOFT_BG, fontFamily: "var(--font-sans)", padding: "2rem 1rem", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ maxWidth: 560, width: "100%", background: WHITE, borderRadius: 12, boxShadow: "0 10px 30px rgba(15,23,42,0.08), 0 1px 3px rgba(15,23,42,0.06)", overflow: "hidden" }}>
          <div className="hdr" style={{ background: "linear-gradient(135deg, #0f2d57 0%, #1d4f91 100%)", padding: "1.25rem 2rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ color: WHITE, fontSize: "1rem", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase" }}>Allied<span style={{ fontWeight: 300 }}>Universal</span><sup style={{ fontSize: "0.5rem", fontWeight: 300, marginLeft: 1 }}>™</sup></div>
              <div style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.68rem", marginTop: 2 }}>Security Services</div>
            </div>
            <div style={{ textAlign: "right" }}><div style={{ color: WHITE, fontSize: "0.88rem", fontWeight: 700 }}>Call-Off Submitted</div></div>
          </div>
          <div style={{ padding: "1.5rem 2rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.25rem" }}>
              <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#e8f5e9", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2f6b3a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: "0.95rem", color: TEXT }}>Call-off recorded</div>
                <div style={{ fontSize: "0.78rem", color: MUTED }}>{submittedData.timestamp}</div>
              </div>
            </div>
            <div style={{ background: "#e8f5e9", border: "1px solid #b7dcbf", borderLeft: `4px solid ${GREEN}`, borderRadius: 12, padding: "0.85rem 1rem", marginBottom: "1rem", fontSize: "0.85rem", color: "#1e4d27", lineHeight: 1.5 }}>
              Your supervisor has been emailed your call-off. Thank you for your submission. Keep the receipt below for your records.
            </div>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Your Receipt</div>
            <div style={{ background: SOFT_BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "1rem", marginBottom: "1rem", fontSize: "0.82rem", color: TEXT, lineHeight: 1.7, whiteSpace: "pre-wrap", fontFamily: "monospace" }}>
              {getCopyMessage()}
            </div>
            <button onClick={handleCopy} style={{ ...btnStyle(copySuccess ? GREEN : NAVY), marginBottom: "1rem", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              {copySuccess ? "✓ Receipt Copied" : "Copy Receipt"}
            </button>
            <button onClick={handleReset} style={{ ...btnStyle("transparent"), color: MUTED, border: `1px solid ${BORDER}`, fontSize: "0.78rem" }}>Submit Another</button>
          </div>
        </div>
      </div>
    );
  }

  const isLate = noticeType === NOTICE_UNDER4;

  return (
    <div style={{ minHeight: "100vh", background: SOFT_BG, fontFamily: "var(--font-sans)", padding: "1rem 0.75rem 0" }}>
      <div style={{ maxWidth: 640, margin: "0 auto", background: WHITE, borderRadius: 16, boxShadow: "0 10px 30px rgba(15,23,42,0.08), 0 1px 3px rgba(15,23,42,0.06)", overflow: "hidden" }}>
        <div style={{ background: "linear-gradient(135deg, #0f2d57 0%, #1d4f91 100%)", padding: "1.25rem 1.5rem" }}>
          <div style={{ color: WHITE, fontSize: "0.95rem", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase" }}>Allied<span style={{ fontWeight: 300 }}>Universal</span><sup style={{ fontSize: "0.5rem", fontWeight: 300, marginLeft: 1 }}>™</sup></div>
          <div style={{ color: WHITE, fontSize: "1.5rem", fontWeight: 700, marginTop: "0.6rem", lineHeight: 1.2 }}>Can&apos;t make your shift?</div>
          <div style={{ color: "rgba(255,255,255,0.8)", fontSize: "0.95rem", marginTop: 4 }}>Call off here. Your supervisor is emailed right away.</div>
        </div>

        <div style={{ padding: "0.25rem 1.25rem 1.5rem" }}>

          <Section title="About you">
            <div id="officerName">
              <Label>Your name <Req /></Label>
              <input value={form.officerName} onChange={set("officerName")} placeholder="First and last name" autoComplete="name" style={inputStyle(!!errorFor("officerName"))} />
              <FieldError msg={errorFor("officerName")} />
              {remembered && (
                <div style={{ fontSize: "0.85rem", color: MUTED, marginTop: 6 }}>
                  Filled in from your last form. <button type="button" onClick={notForgetMe} style={linkBtn}>Not you?</button>
                </div>
              )}
            </div>

            <div id="post" style={{ marginTop: "1.25rem" }}>
              <Label>Your post <Req /></Label>
              <div style={chipWrap}>
                {POSTS.map((p) => (
                  <Chip key={p} selected={!otherPost && form.post === p} onClick={() => { setOtherPost(false); setForm((f) => ({ ...f, post: p })); }}>{p}</Chip>
                ))}
                <Chip selected={otherPost} onClick={() => { setOtherPost(true); setForm((f) => ({ ...f, post: POSTS.includes(f.post) ? "" : f.post })); }}>Other</Chip>
              </div>
              {otherPost && (
                <input value={form.post} onChange={set("post")} placeholder="Type your post" style={{ ...inputStyle(!!errorFor("post")), marginTop: "0.6rem" }} autoFocus />
              )}
              <FieldError msg={errorFor("post")} />
            </div>

            <div style={{ marginTop: "1.25rem" }}>
              <Label>Employee number <Optional /></Label>
              <input value={form.employeeNumber} onChange={set("employeeNumber")} inputMode="numeric" placeholder="If you know it" style={inputStyle(false)} />
            </div>
          </Section>

          <Section title="Your shift">
            <div id="shiftDate">
              <Label>Which day? <Req /></Label>
              <div style={chipWrap}>
                <Chip selected={!otherDate && form.shiftDate === today} onClick={() => { setOtherDate(false); setForm((f) => ({ ...f, shiftDate: today })); }}>Today</Chip>
                <Chip selected={!otherDate && form.shiftDate === tomorrow} onClick={() => { setOtherDate(false); setForm((f) => ({ ...f, shiftDate: tomorrow })); }}>Tomorrow</Chip>
                <Chip selected={otherDate} onClick={() => setOtherDate(true)}>Another day</Chip>
              </div>
              {otherDate && (
                <input type="date" value={form.shiftDate} min={today} onChange={set("shiftDate")} style={{ ...inputStyle(!!errorFor("shiftDate")), marginTop: "0.6rem" }} />
              )}
              <FieldError msg={errorFor("shiftDate")} />
            </div>

            <div className="stack-sm" style={{ display: "flex", gap: "0.75rem", marginTop: "1.25rem" }}>
              <div id="shiftStart" style={{ flex: 1 }}>
                <Label>Shift starts <Req /></Label>
                <input type="time" value={form.shiftStart} onChange={set("shiftStart")} style={inputStyle(!!errorFor("shiftStart"))} />
                <FieldError msg={errorFor("shiftStart")} />
              </div>
              <div style={{ flex: 1 }}>
                <Label>Shift ends <Optional /></Label>
                <input type="time" value={form.shiftEnd} onChange={set("shiftEnd")} style={inputStyle(false)} />
              </div>
            </div>

            {minsUntil !== null && (
              <div style={{ marginTop: "1rem", borderRadius: 12, padding: "0.9rem 1rem", display: "flex", gap: "0.75rem", alignItems: "flex-start", background: isLate ? "#fff7ed" : "#ecfdf3", border: `1px solid ${isLate ? "#fdba74" : "#a7f3c0"}` }}>
                <div style={{ fontSize: "1.25rem", lineHeight: 1 }}>{isLate ? "⚠️" : "✅"}</div>
                <div>
                  <div style={{ fontWeight: 700, color: isLate ? "#9a3412" : "#166534", fontSize: "0.98rem" }}>
                    {isLate ? "Less than 4 hours' notice" : "4+ hours' notice"}
                  </div>
                  <div style={{ fontSize: "0.9rem", color: isLate ? "#9a3412" : "#166534", marginTop: 2, lineHeight: 1.45 }}>
                    {minsUntil < 0
                      ? `Your shift started ${formatDuration(minsUntil)} ago.`
                      : `Your shift starts in ${formatDuration(minsUntil)}.`}
                    {isLate ? " Short-notice call-offs may lead to discipline under AUS attendance policy." : " This counts as a standard call-off."}
                  </div>
                </div>
              </div>
            )}
          </Section>

          <Section title="Why are you calling off?">
            <div id="reason">
              <div style={chipWrap}>
                {REASONS.map((r) => (
                  <Chip key={r} selected={form.reason === r} onClick={() => setForm((f) => ({ ...f, reason: r }))}>{r}</Chip>
                ))}
              </div>
              {form.reason === "Other" && (
                <input value={form.otherReason} onChange={set("otherReason")} placeholder="Briefly, what's the reason?" style={{ ...inputStyle(!!errorFor("reason")), marginTop: "0.6rem" }} autoFocus />
              )}
              <FieldError msg={errorFor("reason")} />
            </div>
          </Section>

          <Section title="Anything else?" subtitle="Optional">
            <Label>Did you find someone to cover?</Label>
            <div style={chipWrap}>
              <Chip selected={form.coverageFound === "yes"} onClick={() => setForm((f) => ({ ...f, coverageFound: f.coverageFound === "yes" ? "" : "yes" }))}>Yes</Chip>
              <Chip selected={form.coverageFound === "no"} onClick={() => setForm((f) => ({ ...f, coverageFound: f.coverageFound === "no" ? "" : "no" }))}>No</Chip>
            </div>
            {form.coverageFound === "yes" && (
              <input value={form.coverageName} onChange={set("coverageName")} placeholder="Who is covering?" style={{ ...inputStyle(false), marginTop: "0.6rem" }} />
            )}

            <div style={{ marginTop: "1.25rem" }}>
              <Label>Note for your supervisor</Label>
              <textarea value={form.comments} onChange={set("comments")} placeholder="Anything they should know" rows={3} style={{ ...inputStyle(false), resize: "vertical", minHeight: 88 }} />
            </div>

            <div style={{ marginTop: "1.25rem" }}>
              <Label>Doctor&apos;s note or document</Label>
              <div style={{ fontSize: "0.85rem", color: MUTED, marginBottom: "0.5rem" }}>Needed if you&apos;re out 3 or more days in a row. Photo or PDF.</div>
              <input id="doc-upload" type="file" accept=".jpg,.jpeg,.png,.pdf,image/*" style={{ display: "none" }} onChange={(e) => setFile(e.target.files?.[0] || null)} />
              {file ? (
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", border: `1.5px solid ${NAVY}`, background: "#eaf1fb", borderRadius: 12, padding: "0.75rem 1rem" }}>
                  <span style={{ fontSize: "1.1rem" }}>📎</span>
                  <span style={{ flex: 1, fontSize: "0.92rem", color: NAVY, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.name}</span>
                  <button type="button" onClick={() => setFile(null)} style={linkBtn}>Remove</button>
                </div>
              ) : (
                <button type="button" onClick={() => document.getElementById("doc-upload")?.click()} style={{ width: "100%", border: `2px dashed ${BORDER}`, background: WHITE, borderRadius: 12, padding: "1rem", fontSize: "0.95rem", color: NAVY, fontWeight: 600, fontFamily: "inherit" }}>
                  📷 Add a photo or file
                </button>
              )}
            </div>
          </Section>

          <div id="confirm" style={{ marginTop: "1.75rem" }}>
            <label style={{ display: "flex", gap: "0.85rem", alignItems: "flex-start", cursor: "pointer", border: `1.5px solid ${errorFor("confirm") ? RED : confirmed ? NAVY : BORDER}`, background: confirmed ? "#eaf1fb" : WHITE, borderRadius: 12, padding: "1rem" }}>
              <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} style={{ width: 24, height: 24, marginTop: 1, accentColor: NAVY, flexShrink: 0 }} />
              <span style={{ fontSize: "0.95rem", color: TEXT, lineHeight: 1.5 }}>
                I confirm this is accurate and submitted under AUS attendance policy.
                {form.officerName.trim() && <span style={{ display: "block", marginTop: 4, color: MUTED, fontSize: "0.88rem" }}>Signed: <strong style={{ color: TEXT }}>{form.officerName.trim()}</strong></span>}
              </span>
            </label>
            <FieldError msg={errorFor("confirm")} />
          </div>

          {error && <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 12, padding: "0.85rem 1rem", fontSize: "0.92rem", color: RED, marginTop: "1rem" }}>{error}</div>}
        </div>

        <div style={{ position: "sticky", bottom: 0, background: "rgba(255,255,255,0.97)", borderTop: `1px solid ${BORDER}`, padding: "0.85rem 1.25rem calc(0.85rem + env(safe-area-inset-bottom))", backdropFilter: "blur(6px)" }}>
          {showErrors && missing.length > 0 && (
            <div style={{ fontSize: "0.88rem", color: RED, fontWeight: 600, marginBottom: "0.6rem", textAlign: "center" }}>
              {missing.length === 1 ? missing[0].msg : `${missing.length} things left: ${missing.map((m) => m.msg.toLowerCase()).join(", ")}`}
            </div>
          )}
          <button type="button" onClick={handleSubmit} disabled={submitting} style={{ width: "100%", minHeight: 54, background: submitting ? "#94a3b8" : NAVY, color: WHITE, border: "none", borderRadius: 12, fontSize: "1.05rem", fontWeight: 700, fontFamily: "inherit" }}>
            {submitting ? "Sending…" : "Submit call-off"}
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "1rem 0.5rem 2rem", fontSize: "0.8rem", color: MUTED, textAlign: "center" }}>
        Allied Universal Security Services · Washington University · All submissions are timestamped and logged.
      </div>
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: "1.75rem" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem", marginBottom: "0.9rem" }}>
        <div style={{ fontSize: "1.15rem", fontWeight: 700, color: TEXT }}>{title}</div>
        {subtitle && <div style={{ fontSize: "0.85rem", color: MUTED }}>{subtitle}</div>}
      </div>
      {children}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: "0.95rem", fontWeight: 600, color: "#334155", marginBottom: 8 }}>{children}</div>;
}

function Req() {
  return <span style={{ color: RED }} aria-label="required">*</span>;
}

function Optional() {
  return <span style={{ color: MUTED, fontWeight: 400, fontSize: "0.85rem" }}>(optional)</span>;
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <div style={{ color: RED, fontSize: "0.88rem", fontWeight: 600, marginTop: 6 }}>{msg}</div>;
}

function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      style={{
        minHeight: 46, padding: "0.55rem 1rem", borderRadius: 999, fontFamily: "inherit",
        fontSize: "0.95rem", fontWeight: 600,
        border: `1.5px solid ${selected ? NAVY : BORDER}`,
        background: selected ? NAVY : WHITE,
        color: selected ? WHITE : TEXT,
        boxShadow: selected ? "0 2px 8px rgba(26,68,128,0.25)" : "none",
      }}
    >
      {selected && "✓ "}{children}
    </button>
  );
}

const chipWrap: React.CSSProperties = { display: "flex", flexWrap: "wrap", gap: "0.5rem" };

const linkBtn: React.CSSProperties = { background: "none", border: "none", padding: 0, minHeight: 0, color: NAVY, fontWeight: 600, textDecoration: "underline", cursor: "pointer", fontFamily: "inherit", fontSize: "inherit" };

function inputStyle(hasError: boolean): React.CSSProperties {
  return { width: "100%", boxSizing: "border-box", padding: "0.75rem 0.9rem", border: `1.5px solid ${hasError ? RED : BORDER}`, borderRadius: 12, fontSize: "1rem", color: TEXT, background: WHITE, fontFamily: "inherit" };
}

function btnStyle(bg: string): React.CSSProperties {
  return { background: bg, color: "#ffffff", border: "none", borderRadius: 12, padding: "0.85rem 1.75rem", fontSize: "0.95rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", width: "100%" };
}
