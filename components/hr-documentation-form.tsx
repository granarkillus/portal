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

export default function AUSAcknowledgement() {
  const [form, setForm] = useState({
    employeeName: "",
    employeeId: "",
    position: "",
    clientSite: "",
    supervisor: "",
    noticeDate: "",
    infraction: "",
    agreement: "",
    comments: "",
    signature: "",
    dateSigned: "",
  });

  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const set =
    (field: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));

  const setAgreement = (val: string) =>
    setForm((f) => ({ ...f, agreement: f.agreement === val ? "" : val }));

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
    if (me.name) setForm((f) => ({ ...f, employeeName: f.employeeName || me.name || "", employeeId: f.employeeId || me.employeeNumber || "" }));
  }, []);

  const required =
    form.employeeName &&
    form.position &&
    form.clientSite &&
    form.supervisor &&
    form.noticeDate &&
    form.agreement &&
    form.signature &&
    form.dateSigned;

  const handleSubmit = async () => {
    if (!required) { setTriedSubmit(true); return; }
    setSubmitting(true);
    setError("");

    const supabase = getPublicSupabase();
    const { error: dbError } = await supabase.from("disciplinary_records").insert([{
      officer_name: form.employeeName,
      employee_id: form.employeeId || null,
      position: form.position,
      client_site: form.clientSite,
      supervisor: form.supervisor,
      notice_date: form.noticeDate,
      infraction: form.infraction || null,
      agreement: form.agreement,
      officer_comments: form.comments || null,
      signature: form.signature,
      date_signed: form.dateSigned,
    }]);

    if (dbError) {
      setError("Submission failed. Please try again.");
      setSubmitting(false);
      return;
    }

    rememberOfficer({ name: form.employeeName.trim(), employeeNumber: form.employeeId.trim() || undefined });
    setSubmitted(true);
    setSubmitting(false);
  };

  const handleReset = () => {
    setForm({
      employeeName: "", employeeId: "", position: "", clientSite: "",
      supervisor: "", noticeDate: "", infraction: "", agreement: "",
      comments: "", signature: "", dateSigned: "",
    });
    setSubmitted(false);
    setError("");
  };

  if (submitted) {
    return (
      <div style={{ minHeight: "100vh", background: SOFT_BG, fontFamily: "var(--font-sans)", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem 1rem" }}>
        <div style={{ maxWidth: 480, width: "100%", background: WHITE, borderRadius: 12, boxShadow: "0 10px 30px rgba(15,23,42,0.08), 0 1px 3px rgba(15,23,42,0.06)", overflow: "hidden", textAlign: "center" }}>
          <div style={{ background: "linear-gradient(135deg, #0f2d57 0%, #1d4f91 100%)", padding: "1.25rem 2rem" }}>
            <div style={{ color: WHITE, fontSize: "1rem", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Allied<span style={{ fontWeight: 300 }}>Universal</span><sup style={{ fontSize: "0.5rem", fontWeight: 300 }}>™</sup>
            </div>
          </div>
          <div style={{ padding: "2.5rem 2rem" }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#e8f5e9", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem" }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2f6b3a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div style={{ fontSize: "1.1rem", fontWeight: 700, color: TEXT, marginBottom: 8 }}>Response Submitted</div>
            <div style={{ color: MUTED, fontSize: "0.85rem", marginBottom: "1.5rem", lineHeight: 1.6 }}>
              Your acknowledgement has been recorded and will be placed in your personnel file.
            </div>
            <button onClick={handleReset} style={btnStyle(NAVY)}>Done</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: SOFT_BG, fontFamily: "var(--font-sans)", padding: "2rem 1rem" }}>
      <div style={{ maxWidth: 680, margin: "0 auto", background: WHITE, borderRadius: 12, boxShadow: "0 10px 30px rgba(15,23,42,0.08), 0 1px 3px rgba(15,23,42,0.06)", overflow: "hidden" }}>
        <div className="hdr" style={{ background: "linear-gradient(135deg, #0f2d57 0%, #1d4f91 100%)", padding: "1.25rem 2rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ color: WHITE, fontSize: "1rem", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Allied<span style={{ fontWeight: 300 }}>Universal</span>
              <sup style={{ fontSize: "0.5rem", fontWeight: 300, marginLeft: 1 }}>™</sup>
            </div>
            <div style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.68rem", marginTop: 2 }}>There for you.</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ color: WHITE, fontSize: "0.88rem", fontWeight: 700, lineHeight: 1.3 }}>Coaching – Counseling – Disciplinary Notice</div>
            <div style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.76rem" }}>Employee Acknowledgement</div>
          </div>
        </div>

        <div style={{ padding: "0 0 2rem" }}>
          <SectionBar label="Notice Reference Information" />
          <div style={{ padding: "1.25rem 2rem 0" }}>
            <Row>
              <Field label="Employee Name" value={form.employeeName} onChange={set("employeeName")} required />
              <Field label="Employee ID (optional)" value={form.employeeId} onChange={set("employeeId")} />
            </Row>
            <Row>
              <Field label="Position Title" value={form.position} onChange={set("position")} required />
              <Field label="Client Site" value={form.clientSite} onChange={set("clientSite")} required />
            </Row>
            <Row>
              <Field label="Supervisor Name" value={form.supervisor} onChange={set("supervisor")} required />
              <Field label="Notice Date" value={form.noticeDate} onChange={set("noticeDate")} type="date" required />
            </Row>
            <Field label="Infraction / Reason (optional)" value={form.infraction} onChange={set("infraction")} placeholder="e.g. Post Abandonment" />
          </div>

          <SectionBar label="7. Acknowledgement" />
          <div style={{ padding: "1.5rem 2rem 0" }}>
            <p style={{ fontSize: "0.85rem", lineHeight: 1.65, color: TEXT, marginBottom: "1rem" }}>
              I acknowledge that this Coaching-Counseling-Disciplinary Notice has been reviewed with me. By signing below I acknowledge a copy has been given to me, and that a copy will be placed in my personnel file.
            </p>
            <div style={{ fontSize: "0.82rem", lineHeight: 1.6, color: TEXT, fontStyle: "italic", fontWeight: 600, background: SOFT_BG, border: `1px solid ${BORDER}`, borderLeft: `3px solid ${NAVY}`, borderRadius: 8, padding: "0.65rem 1rem", marginBottom: "1.5rem" }}>
              I understand that signing this document does not constitute agreement and I may provide a rebuttal statement which will also be placed in my personnel file.
            </div>

            <Label>Agreement <Req /></Label>
            <div style={{ display: "flex", gap: "2rem", margin: "0.5rem 0 1.5rem" }}>
              {["agreed", "disagreed"].map((val) => (
                <label key={val} onClick={() => setAgreement(val)} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: "0.92rem", fontWeight: form.agreement === val ? 700 : 400, color: TEXT, userSelect: "none" }}>
                  <div style={{ width: 17, height: 17, border: `2px solid ${form.agreement === val ? NAVY : BORDER}`, borderRadius: 2, background: form.agreement === val ? NAVY : WHITE, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s" }}>
                    {form.agreement === val && (
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <polyline points="1.5,5 4,7.5 8.5,2.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  {val.charAt(0).toUpperCase() + val.slice(1)}
                </label>
              ))}
            </div>

            <Label>Employee Comments (optional — rebuttal will be placed in personnel file)</Label>
            <textarea value={form.comments} onChange={set("comments")} placeholder="Enter any rebuttal or comments here..." rows={5} style={{ width: "100%", boxSizing: "border-box", padding: "0.6rem 0.75rem", border: `1px solid ${BORDER}`, borderRadius: 12, fontSize: "0.88rem", color: TEXT, background: "#ffffff", fontFamily: "inherit", resize: "vertical", marginTop: 4, marginBottom: "1.25rem" }} />

            <Row>
              <Field label="Employee Signature (type full name)" value={form.signature} onChange={set("signature")} placeholder="Full legal name" required />
              <Field label="Date Signed" value={form.dateSigned} onChange={set("dateSigned")} type="date" required />
            </Row>

            {error && (
              <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 12, padding: "0.75rem 1rem", fontSize: "0.82rem", color: "#b91c1c", marginBottom: "1rem" }}>
                {error}
              </div>
            )}

            <div style={{ marginTop: "1.5rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                style={{ ...btnStyle(!submitting ? NAVY : "#9ca3af"), cursor: !submitting ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
              >
                {submitting ? "Submitting..." : "Submit Acknowledgement"}
              </button>
              {!required && <div style={{ fontSize: "0.75rem", color: triedSubmit ? "#b91c1c" : MUTED, fontWeight: triedSubmit ? 600 : 400, textAlign: "center" }}>Complete all required fields before submitting</div>}
            </div>
          </div>

          <div style={{ borderTop: `1px solid ${BORDER}`, marginTop: "2rem", padding: "0.85rem 2rem 0", fontSize: "0.72rem", color: MUTED, textAlign: "center" }}>
            Allied Universal Security Services &nbsp;·&nbsp; Please keep all completed forms on file for audit purposes. &nbsp;·&nbsp; rev 8/1617
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

function Req() {
  return <span style={{ color: "#b3261e", marginLeft: 2 }}>*</span>;
}

function Field({ label, value, onChange, placeholder, type = "text", required: req }: {
  label: string; value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string; type?: string; required?: boolean;
}) {
  return (
    <div style={{ marginBottom: "1rem" }}>
      <Label>{label}{req && <Req />}</Label>
      <input type={type} value={value} onChange={onChange} placeholder={placeholder} style={{ width: "100%", boxSizing: "border-box", padding: "0.5rem 0.75rem", border: "1px solid #d1d5db", borderRadius: 12, fontSize: "0.88rem", color: "#1a1a2e", background: "#ffffff", outline: "none", fontFamily: "inherit", marginTop: 2 }} />
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

function btnStyle(bg: string): React.CSSProperties {
  return { background: bg, color: "#ffffff", border: "none", borderRadius: 12, padding: "0.7rem 1.75rem", fontSize: "0.85rem", fontWeight: 700, letterSpacing: "0.04em", cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase", width: "100%" };
}
