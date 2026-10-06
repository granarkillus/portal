"use client";

import { useState, useEffect } from "react";
import { getSupabase, requireSupervisor } from "@/lib/supabase";
import SupervisorHeader from "@/components/supervisor-header";
import WriteUpFields, { WorkHistoryRow, WriteUpFormState, WORK_HISTORY_TYPES, blankWriteUp, writeUpMissing } from "@/components/writeup-fields";
import { C, StickyBar, PrimaryButton, MissingNote, outlineButton } from "@/components/ui";

export default function WriteUpForm() {
  const [form, setForm] = useState<WriteUpFormState>(blankWriteUp);
  const [workHistory, setWorkHistory] = useState<WorkHistoryRow[]>(WORK_HISTORY_TYPES.map((type) => ({ type, date: "", issuedBy: "", description: "" })));
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [triedSubmit, setTriedSubmit] = useState(false);
  const [copied, setCopied] = useState(false);

  // Supervisors only.
  useEffect(() => { requireSupervisor(); }, []);
  const [respondLink, setRespondLink] = useState("");
  const [error, setError] = useState("");

  const missing = writeUpMissing(form);

  const handleSubmit = async () => {
    if (submitting) return;
    if (missing.length) { setTriedSubmit(true); document.getElementById(missing[0].id)?.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
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
      <div style={{ minHeight: "100vh", background: C.softBg, fontFamily: "var(--font-sans)", padding: "1rem 0.75rem 2rem" }}>
        <div style={{ maxWidth: 640, margin: "0 auto", background: C.white, borderRadius: 16, boxShadow: "0 10px 30px rgba(15,23,42,0.08), 0 1px 3px rgba(15,23,42,0.06)", overflow: "clip" }}>
          <SupervisorHeader title="Write-up filed" active="writeups" />
          <div style={{ padding: "1.5rem 1.25rem" }}>
            <div style={{ fontSize: "1rem", color: C.text, lineHeight: 1.55, marginBottom: "1rem" }}>
              Send this link to <strong>{form.employeeName}</strong> so they can read and acknowledge it.
            </div>
            <div style={{ background: C.softBg, border: `1px solid ${C.border}`, borderRadius: 12, padding: "0.75rem 1rem", fontSize: "0.88rem", color: C.text, wordBreak: "break-all", marginBottom: "1rem" }}>
              {respondLink}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              <a href={`sms:&body=You have a disciplinary notice to acknowledge. Please open this link: ${encodeURIComponent(respondLink)}`} style={{ ...outlineButton, background: C.green, borderColor: C.green, color: C.white }}>Text link to officer</a>
              <button type="button" onClick={() => { navigator.clipboard.writeText(respondLink); setCopied(true); setTimeout(() => setCopied(false), 2000); }} style={outlineButton}>{copied ? "✓ Copied" : "Copy link"}</button>
              <a href="/writeup/records" style={{ ...outlineButton, color: C.muted, borderColor: C.border }}>Back to write-ups</a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: C.softBg, fontFamily: "var(--font-sans)", padding: "1rem 0.75rem 2rem" }}>
      <div style={{ maxWidth: 640, margin: "0 auto", background: C.white, borderRadius: 16, boxShadow: "0 10px 30px rgba(15,23,42,0.08), 0 1px 3px rgba(15,23,42,0.06)", overflow: "clip" }}>
        <SupervisorHeader title="New write-up" subtitle="Coaching – Counseling – Disciplinary Notice" active="writeups" />
        <div style={{ padding: "0.25rem 1.25rem 1.5rem" }}>
          <WriteUpFields form={form} setForm={setForm} workHistory={workHistory} setWorkHistory={setWorkHistory} showErrors={triedSubmit} />
        </div>
        <StickyBar>
          {triedSubmit && <MissingNote items={Array.from(new Set(missing.map((m) => m.msg)))} />}
          {error && <div style={{ fontSize: "0.88rem", color: C.red, fontWeight: 600, marginBottom: "0.6rem", textAlign: "center" }}>{error}</div>}
          <PrimaryButton onClick={handleSubmit} disabled={submitting}>{submitting ? "Filing…" : "File write-up"}</PrimaryButton>
        </StickyBar>
      </div>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "1rem 0.5rem", fontSize: "0.8rem", color: C.muted, textAlign: "center" }}>
        Allied Universal Security Services · Original – Personnel File · Copy – Employee · Copy – Supervisor · rev 8/1617
      </div>
    </div>
  );
}
