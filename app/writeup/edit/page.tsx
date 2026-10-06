"use client";

import { useState, useEffect } from "react";
import { getSupabase, requireSupervisor } from "@/lib/supabase";
import SupervisorHeader, { headerButton } from "@/components/supervisor-header";
import WriteUpFields, { WriteUpFormState, blankWriteUp, writeUpMissing } from "@/components/writeup-fields";
import { C, StickyBar, PrimaryButton, MissingNote } from "@/components/ui";
import { btnStyle } from "@/lib/theme";
import { PageSkeleton } from "@/components/feedback";

interface WorkHistoryRow {
  type: string;
  date: string;
  issuedBy: string;
  description: string;
}

const WORK_HISTORY_TYPES = [
  "Coaching / Counseling / Training",
  "Verbal Warning",
  "Written Warning",
  "Final Warning / Suspension",
];

function normalize(s?: string): string {
  return (s || "").toLowerCase().replace(/\s+/g, " ").replace(/\s*\/\s*/g, "/").trim();
}

// Reverses the "; "-joined infraction string (e.g. "Work Rule Violation: x; Attendance: y")
// back into checkbox state + detail text for each Section 2 category.
function parseInfraction(infraction: string | null) {
  const result = {
    workRuleViolation: false, workRuleDetail: "",
    performance: false, performanceDetail: "",
    attendance: false, attendanceDetail: "",
  };
  if (!infraction) return result;
  for (const segment of infraction.split(";").map((s) => s.trim()).filter(Boolean)) {
    const wr = segment.match(/^work rule violation\s*:\s*(.*)$/i);
    if (wr) { result.workRuleViolation = true; result.workRuleDetail = wr[1]; continue; }
    const perf = segment.match(/^performance\s*:\s*(.*)$/i);
    if (perf) { result.performance = true; result.performanceDetail = perf[1]; continue; }
    const att = segment.match(/^attendance\s*:\s*(.*)$/i);
    if (att) { result.attendance = true; result.attendanceDetail = att[1]; continue; }
  }
  return result;
}

// Reverses the ", "-joined action_type string back into Section 6 checkboxes.
function parseActionType(actionType: string | null) {
  const result = {
    actionVerbalWarning: false, actionWrittenWarning: false,
    actionFinalWrittenWarning: false, actionSuspension: false, actionTermination: false,
  };
  if (!actionType) return result;
  const types = actionType.split(",").map((s) => normalize(s.replace(/^\*/, "")));
  result.actionVerbalWarning = types.includes("verbal warning");
  result.actionWrittenWarning = types.includes("written warning");
  result.actionFinalWrittenWarning = types.includes("final written warning");
  result.actionSuspension = types.includes("suspension");
  result.actionTermination = types.includes("termination");
  return result;
}

// Fills the 4 fixed Section 1 rows with any saved work history matching each type.
function buildWorkHistory(saved: WorkHistoryRow[] | null): WorkHistoryRow[] {
  return WORK_HISTORY_TYPES.map((type) => {
    const match = (saved || []).find((w) => normalize(w.type) === normalize(type));
    return match
      ? { type, date: match.date || "", issuedBy: match.issuedBy || "", description: match.description || "" }
      : { type, date: "", issuedBy: "", description: "" };
  });
}

export default function EditWriteUpForm() {
  const [recordId, setRecordId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [locked, setLocked] = useState(false);

  const [form, setForm] = useState<WriteUpFormState>(() => ({ ...blankWriteUp(), positionTitle: "", clientSite: "", supervisorDateSigned: "" }));
  const [triedSubmit, setTriedSubmit] = useState(false);

  const [workHistory, setWorkHistory] = useState<WorkHistoryRow[]>(buildWorkHistory(null));

  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    if (!id) { setNotFound(true); setLoading(false); return; }
    setRecordId(id);

    requireSupervisor().then((u) => {
    if (!u) return;
    getSupabase().from("disciplinary_records").select("*").eq("id", id).single()
      .then(({ data, error: dbError }) => {
        if (dbError || !data) { setNotFound(true); setLoading(false); return; }

        if (data.signature) { setLocked(true); setLoading(false); return; }

        const infraction = parseInfraction(data.infraction);
        const actionType = parseActionType(data.action_type);

        setForm({
          employeeName: data.officer_name || "",
          employeeId: data.employee_id || "",
          positionTitle: data.position || "",
          branchDept: data.branch_dept || "",
          clientSite: data.client_site || "",
          supervisor: data.supervisor || "",
          ...infraction,
          facts: data.facts || "",
          expectations: data.expectations || "",
          consequences: data.consequences || "",
          ...actionType,
          effectiveDate: data.effective_date || "",
          suspensionDates: data.suspension_dates || "",
          suspensionUnpaid: data.suspension_type === "Unpaid",
          suspensionPaid: data.suspension_type === "Paid",
          supervisorSignature: data.supervisor_signature || "",
          supervisorDateSigned: data.supervisor_date || "",
          witnessSignature: data.witness_signature || "",
          witnessName: data.witness_name || "",
          witnessDate: data.witness_date || "",
        });
        setWorkHistory(buildWorkHistory(data.work_history));
        setLoading(false);
      });
    });
  }, []);

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const toggle = (field: string) => () =>
    setForm((f) => ({ ...f, [field]: !f[field as keyof typeof f] }));

  const updateHistory = (index: number, field: string, value: string) =>
    setWorkHistory((h) => h.map((row, i) => i === index ? { ...row, [field]: value } : row));

  const missing = writeUpMissing(form);

  const handleSave = async () => {
    if (!recordId || saving) return;
    if (missing.length) { setTriedSubmit(true); document.getElementById(missing[0].id)?.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
    setSaving(true);
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

    const { error: dbError } = await supabase
      .from("disciplinary_records")
      .update({
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
        work_history: workHistory.filter((r) => r.date || r.description),
        supervisor_signature: form.supervisorSignature,
        supervisor_date: form.supervisorDateSigned,
        witness_signature: form.witnessSignature || null,
        witness_name: form.witnessName || null,
        witness_date: form.witnessDate || null,
        effective_date: form.effectiveDate || null,
        suspension_dates: form.suspensionDates || null,
        suspension_type: form.suspensionUnpaid ? "Unpaid" : form.suspensionPaid ? "Paid" : null,
      })
      .eq("id", recordId);

    if (dbError) {
      setError("Save failed. Please try again.");
      setSaving(false);
      return;
    }

    setSaved(true);
    setSaving(false);
  };

  if (loading) return <PageSkeleton />;

  if (notFound) {
    return (
      <div style={{ minHeight: "100vh", background: C.softBg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-sans)" }}>
        <div style={{ textAlign: "center", color: C.muted }}>
          <div style={{ fontSize: "1.1rem", fontWeight: 700, color: C.text, marginBottom: 8 }}>Record Not Found</div>
          <a href="/writeup/records" style={{ color: C.navy, fontSize: "0.85rem" }}>← Back to Records</a>
        </div>
      </div>
    );
  }

  if (locked) {
    return (
      <div style={{ minHeight: "100vh", background: C.softBg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-sans)", padding: "1rem 0.75rem 2rem" }}>
        <div style={{ maxWidth: 480, width: "100%", background: C.white, borderRadius: 12, boxShadow: "0 10px 30px rgba(15,23,42,0.08), 0 1px 3px rgba(15,23,42,0.06)", overflow: "hidden", textAlign: "center" }}>
          <SupervisorHeader title="Edit write-up" subtitle="Coaching – Counseling – Disciplinary Notice" active="writeups" actions={<a href={`/writeup/view?id=${recordId}`} style={headerButton()}>← Back to notice</a>} />
          <div style={{ padding: "2.5rem 1.25rem" }}>
            <div style={{ fontSize: "1.1rem", fontWeight: 700, color: C.text, marginBottom: 8 }}>This Record Can No Longer Be Edited</div>
            <div style={{ color: C.muted, fontSize: "0.85rem", marginBottom: "1.5rem", lineHeight: 1.6 }}>
              The employee has already responded to this notice, so it's locked to preserve an accurate record of what they acknowledged. If a correction is needed now, file a new write-up referencing this one.
            </div>
            <a href={`/writeup/view?id=${recordId}`} style={{ ...btnStyle(C.navy), display: "block", textDecoration: "none", textAlign: "center" as const }}>
              View Record
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (saved) {
    return (
      <div style={{ minHeight: "100vh", background: C.softBg, fontFamily: "var(--font-sans)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem 0.75rem 2rem" }}>
        <div style={{ maxWidth: 480, width: "100%", background: C.white, borderRadius: 12, boxShadow: "0 10px 30px rgba(15,23,42,0.08), 0 1px 3px rgba(15,23,42,0.06)", overflow: "hidden", textAlign: "center" }}>
          <SupervisorHeader title="Edit write-up" subtitle="Coaching – Counseling – Disciplinary Notice" active="writeups" actions={<a href={`/writeup/view?id=${recordId}`} style={headerButton()}>← Back to notice</a>} />
          <div style={{ padding: "2.5rem 1.25rem" }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: C.greenTint, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem" }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2f6b3a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div style={{ fontSize: "1.1rem", fontWeight: 700, color: C.text, marginBottom: 8 }}>Changes Saved</div>
            <div style={{ color: C.muted, fontSize: "0.85rem", marginBottom: "1.5rem" }}>
              The disciplinary notice for {form.employeeName} has been updated. The respond link sent to the employee is unchanged.
            </div>
            <a href={`/writeup/view?id=${recordId}`} style={{ ...btnStyle(C.navy), display: "block", textDecoration: "none", textAlign: "center" as const }}>
              View Record
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: C.softBg, fontFamily: "var(--font-sans)", padding: "1rem 0.75rem 2rem" }}>
      <div style={{ maxWidth: 640, margin: "0 auto", background: C.white, borderRadius: 16, boxShadow: "0 10px 30px rgba(15,23,42,0.08), 0 1px 3px rgba(15,23,42,0.06)", overflow: "clip" }}>
        <SupervisorHeader title="Edit write-up" subtitle="Coaching – Counseling – Disciplinary Notice" active="writeups" actions={<a href={`/writeup/view?id=${recordId}`} style={headerButton()}>← Back to notice</a>} />
        <div style={{ padding: "0.25rem 1.25rem 1.5rem" }}>
          <div style={{ marginTop: "1.25rem", background: C.orangeTint, border: "1px solid #fdba74", borderRadius: 12, padding: "0.75rem 1rem", fontSize: "0.9rem", color: C.orange, lineHeight: 1.5 }}>
            Editing this updates what {form.employeeName || "the officer"} will see and sign when they open their link. The link itself doesn&apos;t change.
          </div>
          <WriteUpFields form={form} setForm={setForm} workHistory={workHistory} setWorkHistory={setWorkHistory} showErrors={triedSubmit} />
        </div>
        <StickyBar>
          {triedSubmit && <MissingNote items={Array.from(new Set(missing.map((m) => m.msg)))} />}
          {error && <div style={{ fontSize: "0.88rem", color: C.red, fontWeight: 600, marginBottom: "0.6rem", textAlign: "center" }}>{error}</div>}
          <div style={{ display: "flex", gap: "0.6rem" }}>
            <a href={`/writeup/view?id=${recordId}`} style={{ flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", padding: "0 1.1rem", border: `1.5px solid ${C.border}`, borderRadius: 12, color: C.muted, fontWeight: 700, textDecoration: "none" }}>Cancel</a>
            <div style={{ flex: 1 }}><PrimaryButton onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save changes"}</PrimaryButton></div>
          </div>
        </StickyBar>
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

function Field({ label, value, onChange, placeholder, type = "text", required: req }: {
  label: string; value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string; type?: string; required?: boolean;
}) {
  return (
    <div style={{ marginBottom: "1rem" }}>
      <Label>{label}{req && <span style={{ color: C.red, marginLeft: 2 }}>*</span>}</Label>
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
    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: "0.85rem", color: C.text, fontWeight: checked ? 600 : 400, userSelect: "none", marginBottom: "0.25rem" }}>
      <div onClick={onChange} style={{ width: 16, height: 16, border: `2px solid ${checked ? "#1f4e79" : "#d1d5db"}`, borderRadius: 2, background: checked ? "#1f4e79" : C.white, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, cursor: "pointer", transition: "all 0.15s" }}>
        {checked && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><polyline points="1.5,5 4,7.5 8.5,2.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
      </div>
      <span onClick={onChange}>{label}</span>
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", padding: "0.75rem 0.9rem",
  border: "1px solid #d1d5db", borderRadius: 12, fontSize: "1rem",
  color: C.text, background: C.white, outline: "none", fontFamily: "inherit",
};

const inlineInputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", padding: "4px 6px",
  border: "1px solid #e5e7eb", borderRadius: 8, fontSize: "0.82rem",
  color: C.text, background: C.white, outline: "none", fontFamily: "inherit",
};

