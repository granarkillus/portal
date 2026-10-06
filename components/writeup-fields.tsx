"use client";

// The supervisor's write-up form (new and edit share it). Same fields and the
// same saved data as before; laid out like the officer forms: tap buttons
// instead of tiny checkboxes, cards instead of a wide table, one-tap signing.

import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { C, SUPERVISORS, Section, Label, Req, Optional, FieldError, TextField, ChoiceField, FixedLine, SignBox, Chip, chipWrap, inputStyle, todayIso } from "@/components/ui";

export interface WorkHistoryRow { type: string; date: string; issuedBy: string; description: string }

export interface WriteUpFormState {
  employeeName: string; employeeId: string; positionTitle: string; branchDept: string; clientSite: string; supervisor: string;
  workRuleViolation: boolean; workRuleDetail: string; performance: boolean; performanceDetail: string; attendance: boolean; attendanceDetail: string;
  facts: string; expectations: string; consequences: string;
  actionVerbalWarning: boolean; actionWrittenWarning: boolean; actionFinalWrittenWarning: boolean; actionSuspension: boolean; actionTermination: boolean;
  effectiveDate: string; suspensionDates: string; suspensionUnpaid: boolean; suspensionPaid: boolean;
  supervisorSignature: string; supervisorDateSigned: string; witnessSignature: string; witnessName: string; witnessDate: string;
}

export const WORK_HISTORY_TYPES = ["Coaching / Counseling / Training", "Verbal Warning", "Written Warning", "Final Warning / Suspension"];

export const blankWriteUp = (): WriteUpFormState => ({
  employeeName: "", employeeId: "", positionTitle: "Security Officer", branchDept: "", clientSite: "Washington University", supervisor: "",
  workRuleViolation: false, workRuleDetail: "", performance: false, performanceDetail: "", attendance: false, attendanceDetail: "",
  facts: "", expectations: "", consequences: "",
  actionVerbalWarning: false, actionWrittenWarning: false, actionFinalWrittenWarning: false, actionSuspension: false, actionTermination: false,
  effectiveDate: "", suspensionDates: "", suspensionUnpaid: false, suspensionPaid: false,
  supervisorSignature: "", supervisorDateSigned: todayIso(), witnessSignature: "", witnessName: "", witnessDate: "",
});

export function writeUpMissing(f: WriteUpFormState): { id: string; msg: string }[] {
  const m: { id: string; msg: string }[] = [];
  if (!f.employeeName.trim()) m.push({ id: "wu-officer", msg: "officer's name" });
  if (!f.positionTitle.trim() || !f.clientSite.trim()) m.push({ id: "wu-details", msg: "position and site" });
  if (!f.supervisor.trim()) m.push({ id: "wu-supervisor", msg: "supervisor" });
  if (!f.facts.trim()) m.push({ id: "wu-facts", msg: "what happened (facts)" });
  if (!f.supervisorSignature) m.push({ id: "sign-box", msg: "tick the box to sign" });
  if (!f.supervisorDateSigned) m.push({ id: "sign-box", msg: "date signed" });
  return m;
}

const ACTIONS: [keyof WriteUpFormState, string][] = [
  ["actionVerbalWarning", "Verbal warning"],
  ["actionWrittenWarning", "Written warning"],
  ["actionFinalWrittenWarning", "Final written warning"],
  ["actionSuspension", "Suspension"],
  ["actionTermination", "Termination"],
];

const ISSUES: [keyof WriteUpFormState, keyof WriteUpFormState, string, string][] = [
  ["workRuleViolation", "workRuleDetail", "Work rule violation", "Which rule? e.g. Post abandonment"],
  ["performance", "performanceDetail", "Performance", "What about performance?"],
  ["attendance", "attendanceDetail", "Attendance", "e.g. Late to post, no call / no show"],
];

export default function WriteUpFields({ form, setForm, workHistory, setWorkHistory, showErrors }: {
  form: WriteUpFormState;
  setForm: React.Dispatch<React.SetStateAction<WriteUpFormState>>;
  workHistory: WorkHistoryRow[];
  setWorkHistory: React.Dispatch<React.SetStateAction<WorkHistoryRow[]>>;
  showErrors: boolean;
}) {
  const [editDetails, setEditDetails] = useState(false);
  const [showWitness, setShowWitness] = useState(!!(form.witnessName || form.witnessSignature));
  const [showHistory, setShowHistory] = useState(workHistory.some((r) => r.date || r.description || r.issuedBy));
  const [names, setNames] = useState<string[]>([]);

  // Officer names from the roster, suggested as you type.
  useEffect(() => {
    getSupabase().from("officers").select("full_name").order("full_name").then(({ data }) => {
      setNames(((data || []) as { full_name: string }[]).map((o) => o.full_name).filter(Boolean));
    });
  }, []);

  useEffect(() => { if (form.witnessName || form.witnessSignature) setShowWitness(true); }, [form.witnessName, form.witnessSignature]);
  useEffect(() => { if (workHistory.some((r) => r.date || r.description || r.issuedBy)) setShowHistory(true); }, [workHistory]);

  // Signing follows the supervisor picked above.
  useEffect(() => {
    setForm((f) => (f.supervisorSignature && f.supervisorSignature !== f.supervisor.trim() ? { ...f, supervisorSignature: f.supervisor.trim() } : f));
  }, [form.supervisor, setForm]);

  const missing = writeUpMissing(form);
  const err = (id: string) => showErrors && missing.some((x) => x.id === id);
  const setText = (k: keyof WriteUpFormState) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const flip = (k: keyof WriteUpFormState) => setForm((f) => ({ ...f, [k]: !f[k] }));
  const textArea = (k: keyof WriteUpFormState, placeholder: string, rows: number, error = false) => (
    <textarea value={form[k] as string} onChange={(e) => setText(k)(e.target.value)} placeholder={placeholder} rows={rows} style={{ ...inputStyle(error), resize: "vertical", lineHeight: 1.5 }} />
  );

  return (
    <>
      <Section title="Officer">
        <div id="wu-officer" style={{ marginBottom: "1.25rem" }}>
          <Label>Officer&apos;s name<Req /></Label>
          <input list="wu-officer-names" value={form.employeeName} onChange={(e) => setText("employeeName")(e.target.value)} placeholder="Start typing a name" style={inputStyle(err("wu-officer"))} />
          <datalist id="wu-officer-names">{names.map((n) => <option key={n} value={n} />)}</datalist>
          <FieldError msg={err("wu-officer") && "Enter the officer's name"} />
        </div>
        <TextField label="Employee ID" value={form.employeeId} onChange={setText("employeeId")} optional inputMode="numeric" />
        <div id="wu-details">
          <FixedLine text={`${form.positionTitle || "—"} · ${form.clientSite || "—"}${form.branchDept ? ` · ${form.branchDept}` : ""}`} editing={editDetails || err("wu-details")} onToggle={() => setEditDetails((v) => !v)} />
          {(editDetails || err("wu-details")) && (
            <>
              <TextField label="Position title" value={form.positionTitle} onChange={setText("positionTitle")} required />
              <TextField label="Client site" value={form.clientSite} onChange={setText("clientSite")} required />
              <TextField label="Branch / dept." value={form.branchDept} onChange={setText("branchDept")} optional />
            </>
          )}
        </div>
        <ChoiceField id="wu-supervisor" label="Supervisor" options={SUPERVISORS} value={form.supervisor} onChange={setText("supervisor")} required otherPlaceholder="Supervisor's name" error={err("wu-supervisor") && "Pick the supervisor"} />
      </Section>

      <Section title="What happened">
        <div style={{ marginBottom: "1.25rem" }}>
          <Label>Type of issue <span style={{ color: C.muted, fontWeight: 400, fontSize: "0.85rem" }}>(tap all that apply)</span></Label>
          <div style={chipWrap}>
            {ISSUES.map(([k, , label]) => <Chip key={k} selected={!!form[k]} onClick={() => flip(k)}>{label}</Chip>)}
          </div>
          {ISSUES.filter(([k]) => form[k]).map(([, d, label, ph]) => (
            <div key={d} style={{ marginTop: "0.6rem" }}>
              <div style={{ fontSize: "0.85rem", color: C.muted, marginBottom: 4 }}>{label}</div>
              <input value={form[d] as string} onChange={(e) => setText(d)(e.target.value)} placeholder={ph} style={inputStyle(false)} />
            </div>
          ))}
        </div>
        <div id="wu-facts" style={{ marginBottom: "1.25rem" }}>
          <Label>Facts: who, what, where, when, how<Req /></Label>
          {textArea("facts", "Describe what happened in detail", 7, err("wu-facts"))}
          <FieldError msg={err("wu-facts") && "Describe what happened"} />
        </div>
        <div style={{ marginBottom: "1.25rem" }}>
          <Label>Expected going forward<Optional /></Label>
          {textArea("expectations", "What the officer needs to do from now on", 3)}
          <div style={{ fontSize: "0.85rem", color: C.muted, marginTop: 6, lineHeight: 1.45 }}>The form adds: &quot;Failure to correct the behavior/performance above may result in further discipline, up to and including termination of employment.&quot;</div>
        </div>
        <div style={{ marginBottom: "0.5rem" }}>
          <Label>Next steps / consequences<Optional /></Label>
          {textArea("consequences", "Follow-up and what happens if it continues", 3)}
        </div>
      </Section>

      <Section title="Corrective action">
        <div style={{ marginBottom: "1rem" }}>
          <div style={chipWrap}>
            {ACTIONS.map(([k, label]) => <Chip key={k} selected={!!form[k]} onClick={() => flip(k)}>{label}</Chip>)}
          </div>
        </div>
        <div className="stack-sm" style={{ display: "flex", gap: "0.75rem" }}>
          <div style={{ flex: 1, marginBottom: "1rem" }}>
            <Label>Effective date<Optional /></Label>
            <input type="date" value={form.effectiveDate} onChange={(e) => setText("effectiveDate")(e.target.value)} style={inputStyle(false)} />
          </div>
          {form.actionSuspension && (
            <div style={{ flex: 1, marginBottom: "1rem" }}>
              <Label>Suspension dates</Label>
              <input value={form.suspensionDates} onChange={(e) => setText("suspensionDates")(e.target.value)} placeholder="e.g. June 9–10, 2026" style={inputStyle(false)} />
            </div>
          )}
        </div>
        {form.actionSuspension && (
          <div style={{ ...chipWrap, marginBottom: "1rem" }}>
            <Chip selected={form.suspensionUnpaid} onClick={() => setForm((f) => ({ ...f, suspensionUnpaid: !f.suspensionUnpaid, suspensionPaid: false }))}>Unpaid</Chip>
            <Chip selected={form.suspensionPaid} onClick={() => setForm((f) => ({ ...f, suspensionPaid: !f.suspensionPaid, suspensionUnpaid: false }))}>Paid</Chip>
          </div>
        )}
        {(form.actionTermination || form.actionSuspension) && (
          <div style={{ background: C.redTint, border: "1px solid #fca5a5", borderLeft: "3px solid #b91c1c", borderRadius: 10, padding: "0.65rem 0.9rem", fontSize: "0.88rem", color: C.red, fontWeight: 600, marginBottom: "1rem", lineHeight: 1.45 }}>
            * Unpaid disciplinary suspensions of greater than one day require review with Regional HR Manager or Director in advance.
          </div>
        )}
      </Section>

      <Section title="Prior history" subtitle="Optional">
        {!showHistory ? (
          <button type="button" onClick={() => setShowHistory(true)} style={{ background: "none", border: `1.5px dashed ${C.navy}`, color: C.navy, borderRadius: 12, padding: "0.7rem 1rem", width: "100%", fontWeight: 700, fontFamily: "inherit", fontSize: "0.92rem", cursor: "pointer" }}>
            + Add prior coaching or discipline
          </button>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            {workHistory.map((row, i) => (
              <div key={row.type} style={{ background: C.softBg, border: `1px solid ${C.border}`, borderRadius: 12, padding: "0.75rem 0.85rem" }}>
                <div style={{ fontSize: "0.88rem", fontWeight: 700, color: C.text, marginBottom: 6 }}>{row.type}</div>
                <div className="stack-sm" style={{ display: "flex", gap: "0.5rem" }}>
                  <input type="date" aria-label="Date given" value={row.date} onChange={(e) => setWorkHistory((h) => h.map((r, j) => (j === i ? { ...r, date: e.target.value } : r)))} style={{ ...inputStyle(false), padding: "0.55rem 0.7rem", fontSize: "0.92rem", flex: "0 0 150px", marginBottom: 6 }} />
                  <input value={row.issuedBy} placeholder="Issued by" onChange={(e) => setWorkHistory((h) => h.map((r, j) => (j === i ? { ...r, issuedBy: e.target.value } : r)))} style={{ ...inputStyle(false), padding: "0.55rem 0.7rem", fontSize: "0.92rem", marginBottom: 6 }} />
                </div>
                <input value={row.description} placeholder="Description / reason" onChange={(e) => setWorkHistory((h) => h.map((r, j) => (j === i ? { ...r, description: e.target.value } : r)))} style={{ ...inputStyle(false), padding: "0.55rem 0.7rem", fontSize: "0.92rem" }} />
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Sign">
        <SignBox name={form.supervisor} signed={!!form.supervisorSignature} onChange={(s) => setForm((f) => ({ ...f, supervisorSignature: s ? f.supervisor.trim() : "" }))} error={err("sign-box")} />
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginTop: "0.75rem", fontSize: "0.9rem", color: C.muted }}>
          <span>Date signed</span>
          <input type="date" value={form.supervisorDateSigned} onChange={(e) => setText("supervisorDateSigned")(e.target.value)} style={{ ...inputStyle(err("sign-box") && !form.supervisorDateSigned), width: "auto", padding: "0.5rem 0.7rem", fontSize: "0.95rem" }} />
        </div>
        {!showWitness ? (
          <button type="button" onClick={() => setShowWitness(true)} style={{ marginTop: "1rem", background: "none", border: "none", padding: 0, minHeight: 0, color: C.navy, fontWeight: 700, textDecoration: "underline", cursor: "pointer", fontFamily: "inherit", fontSize: "0.92rem" }}>
            + Add a witness
          </button>
        ) : (
          <div style={{ marginTop: "1.25rem" }}>
            <TextField label="Witness name" value={form.witnessName} onChange={(v) => setForm((f) => ({ ...f, witnessName: v, witnessSignature: f.witnessSignature ? v : "" }))} optional />
            <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "0.95rem", color: C.text, marginBottom: "0.75rem" }}>
              <input type="checkbox" checked={!!form.witnessSignature} disabled={!form.witnessName.trim()} onChange={(e) => setForm((f) => ({ ...f, witnessSignature: e.target.checked ? f.witnessName.trim() : "", witnessDate: e.target.checked && !f.witnessDate ? todayIso() : f.witnessDate }))} style={{ width: 22, height: 22, accentColor: C.navy }} />
              Witness signs as {form.witnessName.trim() || "…"}
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", fontSize: "0.9rem", color: C.muted }}>
              <span>Date witnessed</span>
              <input type="date" value={form.witnessDate} onChange={(e) => setText("witnessDate")(e.target.value)} style={{ ...inputStyle(false), width: "auto", padding: "0.5rem 0.7rem", fontSize: "0.95rem" }} />
            </div>
          </div>
        )}
      </Section>
    </>
  );
}
