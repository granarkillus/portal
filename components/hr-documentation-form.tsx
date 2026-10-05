"use client";

import { useState, useEffect } from "react";
import { getPublicSupabase } from "@/lib/supabase";
import { getOfficer, rememberOfficer } from "@/lib/officer-memory";
import {
  C, SUPERVISORS, FormShell, Section, Label, Req, FieldError, TextField, ChoiceField, FixedLine,
  SignBox, StickyBar, PrimaryButton, MissingNote, DoneCard, Chip, chipWrap, inputStyle, todayIso, outlineButton,
} from "@/components/ui";

// Every past acknowledgement used these, so they start filled in (editable).
const DEFAULT_POSITION = "Security Officer";
const DEFAULT_SITE = "Washington University";

export default function AUSAcknowledgement() {
  const blank = () => ({
    employeeName: "",
    employeeId: "",
    position: DEFAULT_POSITION,
    clientSite: DEFAULT_SITE,
    supervisor: "",
    noticeDate: todayIso(),
    infraction: "",
    agreement: "",
    comments: "",
    signature: "",
    dateSigned: todayIso(),
  });
  const [form, setForm] = useState(blank);
  const [editDetails, setEditDetails] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [triedSubmit, setTriedSubmit] = useState(false);

  const setField = (field: keyof ReturnType<typeof blank>) => (v: string) => setForm((f) => ({ ...f, [field]: v }));

  // Fill in the officer's details remembered from their last Allied form.
  const applyRemembered = () => {
    const me = getOfficer();
    if (me.name) setForm((f) => ({ ...f, employeeName: f.employeeName || me.name || "", employeeId: f.employeeId || me.employeeNumber || "" }));
  };
  useEffect(applyRemembered, []);

  // Signing follows the name if they edit it afterwards.
  useEffect(() => {
    setForm((f) => (f.signature && f.signature !== f.employeeName.trim() ? { ...f, signature: f.employeeName.trim() } : f));
  }, [form.employeeName]);

  const missing: { id: string; msg: string }[] = [];
  if (!form.employeeName.trim()) missing.push({ id: "employeeName", msg: "your name" });
  if (!form.position.trim()) missing.push({ id: "details", msg: "position title" });
  if (!form.clientSite.trim()) missing.push({ id: "details", msg: "client site" });
  if (!form.supervisor.trim()) missing.push({ id: "supervisor", msg: "supervisor" });
  if (!form.noticeDate) missing.push({ id: "noticeDate", msg: "notice date" });
  if (!form.agreement) missing.push({ id: "agreement", msg: "agree or disagree" });
  if (!form.signature) missing.push({ id: "sign-box", msg: "tick the box to sign" });
  if (!form.dateSigned) missing.push({ id: "sign-box", msg: "date signed" });
  const err = (id: string) => triedSubmit && missing.some((m) => m.id === id);

  const handleSubmit = async () => {
    if (submitting) return;
    if (missing.length > 0) {
      setTriedSubmit(true);
      if (missing[0].id === "details") setEditDetails(true);
      document.getElementById(missing[0].id)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setSubmitting(true);
    setError("");

    const supabase = getPublicSupabase();
    const { error: dbError } = await supabase.from("disciplinary_records").insert([{
      officer_name: form.employeeName.trim(),
      employee_id: form.employeeId.trim() || null,
      position: form.position.trim(),
      client_site: form.clientSite.trim(),
      supervisor: form.supervisor.trim(),
      notice_date: form.noticeDate,
      infraction: form.infraction.trim() || null,
      agreement: form.agreement,
      officer_comments: form.comments.trim() || null,
      signature: form.signature,
      date_signed: form.dateSigned,
    }]);

    if (dbError) {
      setError("Submission failed. Please check your connection and try again.");
      setSubmitting(false);
      return;
    }

    rememberOfficer({ name: form.employeeName.trim(), employeeNumber: form.employeeId.trim() || undefined });
    setSubmitted(true);
    setSubmitting(false);
    window.scrollTo(0, 0);
  };

  const handleReset = () => {
    setForm(blank());
    setSubmitted(false);
    setTriedSubmit(false);
    setEditDetails(false);
    setError("");
    applyRemembered();
  };

  if (submitted) {
    return (
      <DoneCard title="Response submitted">
        <div style={{ color: C.muted, fontSize: "0.95rem", marginBottom: "1.5rem", lineHeight: 1.6 }}>
          Your acknowledgement has been recorded and will be placed in your personnel file.
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          <a href="/forms" style={{ ...outlineButton, background: C.navy, color: C.white }}>Done</a>
          <button type="button" onClick={handleReset} style={{ ...outlineButton, color: C.muted, borderColor: C.border }}>Submit another response</button>
        </div>
      </DoneCard>
    );
  }

  return (
    <FormShell
      title="Respond to a write-up"
      subtitle="Coaching – Counseling – Disciplinary Notice acknowledgement"
      footer="Allied Universal Security Services · Please keep all completed forms on file for audit purposes. · rev 8/1617"
      bar={
        <StickyBar>
          {triedSubmit && <MissingNote items={Array.from(new Set(missing.map((m) => m.msg)))} />}
          {error && <div style={{ fontSize: "0.88rem", color: C.red, fontWeight: 600, marginBottom: "0.6rem", textAlign: "center" }}>{error}</div>}
          <PrimaryButton onClick={handleSubmit} disabled={submitting}>{submitting ? "Sending…" : "Submit acknowledgement"}</PrimaryButton>
        </StickyBar>
      }
    >
      <Section title="About you">
        <TextField id="employeeName" label="Your name" value={form.employeeName} onChange={setField("employeeName")} required placeholder="First and last name" autoComplete="name" error={err("employeeName") && "Enter your name"} />
        <TextField label="Employee ID" value={form.employeeId} onChange={setField("employeeId")} optional inputMode="numeric" placeholder="If you know it" />
        <div id="details">
          <FixedLine text={`${form.position || "—"} · ${form.clientSite || "—"}`} editing={editDetails} onToggle={() => setEditDetails((v) => !v)} />
          {editDetails && (
            <>
              <TextField label="Position title" value={form.position} onChange={setField("position")} required error={err("details") && !form.position.trim() && "Enter your position"} />
              <TextField label="Client site" value={form.clientSite} onChange={setField("clientSite")} required error={err("details") && !form.clientSite.trim() && "Enter the client site"} />
            </>
          )}
        </div>
      </Section>

      <Section title="About the notice">
        <ChoiceField id="supervisor" label="Supervisor who gave the notice" options={SUPERVISORS} value={form.supervisor} onChange={setField("supervisor")} required otherPlaceholder="Supervisor's name" error={err("supervisor") && "Pick your supervisor"} />
        <div id="noticeDate" style={{ marginBottom: "1.25rem" }}>
          <Label>Date of the notice<Req /></Label>
          <input type="date" value={form.noticeDate} max={todayIso()} onChange={(e) => setField("noticeDate")(e.target.value)} style={inputStyle(err("noticeDate"))} />
          <FieldError msg={err("noticeDate") && "Pick the date of the notice"} />
        </div>
        <TextField label="Infraction / reason" value={form.infraction} onChange={setField("infraction")} optional placeholder="e.g. Post abandonment" />
      </Section>

      <Section title="Your acknowledgement">
        <p style={{ fontSize: "0.95rem", lineHeight: 1.6, color: C.text, margin: "0 0 0.9rem" }}>
          I acknowledge that this Coaching-Counseling-Disciplinary Notice has been reviewed with me. By signing below I acknowledge a copy has been given to me, and that a copy will be placed in my personnel file.
        </p>
        <div style={{ fontSize: "0.92rem", lineHeight: 1.55, color: C.text, fontWeight: 600, background: C.softBg, border: `1px solid ${C.border}`, borderLeft: `3px solid ${C.navy}`, borderRadius: 10, padding: "0.75rem 1rem", marginBottom: "1.25rem" }}>
          I understand that signing this document does not constitute agreement and I may provide a rebuttal statement which will also be placed in my personnel file.
        </div>

        <div id="agreement" style={{ marginBottom: "1.25rem" }}>
          <Label>Do you agree with the notice?<Req /></Label>
          <div style={chipWrap}>
            <Chip selected={form.agreement === "agreed"} onClick={() => setForm((f) => ({ ...f, agreement: f.agreement === "agreed" ? "" : "agreed" }))}>Agreed</Chip>
            <Chip selected={form.agreement === "disagreed"} onClick={() => setForm((f) => ({ ...f, agreement: f.agreement === "disagreed" ? "" : "disagreed" }))}>Disagreed</Chip>
          </div>
          <FieldError msg={err("agreement") && "Pick one"} />
        </div>

        <div style={{ marginBottom: "1.25rem" }}>
          <Label>Your comments or rebuttal <span style={{ color: C.muted, fontWeight: 400, fontSize: "0.85rem" }}>(optional, placed in your personnel file)</span></Label>
          <textarea value={form.comments} onChange={(e) => setField("comments")(e.target.value)} placeholder={form.agreement === "disagreed" ? "Explain why you disagree" : "Anything you want on record"} rows={4} style={{ ...inputStyle(false), resize: "vertical", minHeight: 100, lineHeight: 1.5 }} />
        </div>

        <SignBox name={form.employeeName} signed={!!form.signature} onChange={(s) => setForm((f) => ({ ...f, signature: s ? f.employeeName.trim() : "" }))} error={err("sign-box") && !form.signature} />
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginTop: "0.75rem", fontSize: "0.9rem", color: C.muted }}>
          <span>Date signed</span>
          <input type="date" value={form.dateSigned} max={todayIso()} onChange={(e) => setField("dateSigned")(e.target.value)} style={{ ...inputStyle(err("sign-box") && !form.dateSigned), width: "auto", padding: "0.5rem 0.7rem", fontSize: "0.95rem" }} />
        </div>
      </Section>
    </FormShell>
  );
}
