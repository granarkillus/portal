"use client";

import { useState, useEffect } from "react";
import { getPublicSupabase } from "@/lib/supabase";
import { useDraft, clearDraft } from "@/lib/drafts";

const NAVY = "#1a4480";
const DARK = "#243b5e";
const SOFT_BG = "#f2f5fa";
const WHITE = "#ffffff";
const MUTED = "#5b6474";
const BORDER = "#dbe2ec";
const TEXT = "#0f172a";

interface Notice {
  id: string;
  officer_name: string;
  employee_id: string;
  position: string;
  client_site: string;
  supervisor: string;
  notice_date: string;
  infraction: string;
  action_type: string;
  facts: string;
  expectations: string;
  consequences: string;
  agreement: string | null;
  signature: string | null;
}

export default function RespondPage() {
  const [notice, setNotice] = useState<Notice | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [alreadySigned, setAlreadySigned] = useState(false);

  const [agreement, setAgreement] = useState("");
  const [comments, setComments] = useState("");
  const [signature, setSignature] = useState("");
  const [dateSigned, setDateSigned] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const formatDate = (iso: string) => {
    if (!iso) return "";
    const d = iso.split("T")[0];
    const [y, m, day] = d.split("-");
    return `${m}/${day}/${y}`;
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    if (!id) { setNotFound(true); setLoading(false); return; }

    const supabase = getPublicSupabase();
    supabase.rpc("get_notice_for_response", { p_id: id }).maybeSingle<Notice>()
      .then(({ data, error: dbError }) => {
        if (dbError || !data) { setNotFound(true); }
        else if (data.signature) { setAlreadySigned(true); setNotice(data); }
        else { setNotice(data); }
        setLoading(false);
      });
  }, []);

  // Keep an unsent response on this phone if the tab is closed before signing.
  const draftKey = notice && !alreadySigned ? `writeup-${notice.id}` : null;
  useDraft(draftKey, { agreement, comments, signature, dateSigned }, (saved) => {
    setAgreement(saved.agreement || ""); setComments(saved.comments || "");
    setSignature(saved.signature || ""); setDateSigned(saved.dateSigned || "");
  }, !submitted && !!(agreement || comments.trim() || signature.trim()));

  const required = agreement && signature && dateSigned;

  const handleSubmit = async () => {
    if (!required || !notice) return;
    setSubmitting(true);
    setError("");

    const supabase = getPublicSupabase();
    // Only the response fields can be written, and only while the notice is unsigned.
    const { data: saved, error: dbError } = await supabase.rpc("submit_notice_response", {
      p_id: notice.id,
      p_agreement: agreement,
      p_comments: comments || null,
      p_signature: signature,
      p_date_signed: dateSigned,
    });

    if (dbError || saved !== true) {
      setError(dbError ? "Submission failed. Please try again." : "This notice has already been signed.");
      setSubmitting(false);
      return;
    }

    clearDraft(`writeup-${notice.id}`);
    setSubmitted(true);
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: SOFT_BG, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-sans)" }}>
        <div style={{ color: MUTED, fontSize: "0.88rem" }}>Loading notice...</div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div style={{ minHeight: "100vh", background: SOFT_BG, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-sans)" }}>
        <div style={{ textAlign: "center", color: MUTED }}>
          <div style={{ fontSize: "1.1rem", fontWeight: 700, color: TEXT, marginBottom: 8 }}>Notice Not Found</div>
          <div style={{ fontSize: "0.85rem" }}>This link is invalid or has expired. Contact your supervisor.</div>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div style={{ minHeight: "100vh", background: SOFT_BG, fontFamily: "var(--font-sans)", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem 1rem" }}>
        <div style={{ maxWidth: 480, width: "100%", background: WHITE, borderRadius: 12, boxShadow: "0 10px 30px rgba(15,23,42,0.08), 0 1px 3px rgba(15,23,42,0.06)", overflow: "hidden", textAlign: "center" }}>
          <div style={{ background: "linear-gradient(135deg, #0f2d57 0%, #1d4f91 100%)", padding: "1.25rem 2rem" }}>
            <div style={{ color: WHITE, fontSize: "1rem", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Allied<span style={{ fontWeight: 300 }}>Universal</span><sup style={{ fontSize: "0.5rem" }}>™</sup>
            </div>
          </div>
          <div style={{ padding: "2.5rem 2rem" }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#e8f5e9", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem" }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2f6b3a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div style={{ fontSize: "1.1rem", fontWeight: 700, color: TEXT, marginBottom: 8 }}>Acknowledgement Submitted</div>
            <div style={{ color: MUTED, fontSize: "0.85rem", lineHeight: 1.6 }}>
              Your response has been recorded and will be placed in your personnel file. A copy has been provided to your supervisor.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: SOFT_BG, fontFamily: "var(--font-sans)", padding: "2rem 1rem" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", background: WHITE, borderRadius: 12, boxShadow: "0 10px 30px rgba(15,23,42,0.08), 0 1px 3px rgba(15,23,42,0.06)", overflow: "hidden" }}>

        {/* Header */}
        <div className="hdr" style={{ background: "linear-gradient(135deg, #0f2d57 0%, #1d4f91 100%)", padding: "1.25rem 2rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ color: WHITE, fontSize: "1rem", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Allied<span style={{ fontWeight: 300 }}>Universal</span><sup style={{ fontSize: "0.5rem", fontWeight: 300, marginLeft: 1 }}>™</sup>
            </div>
            <div style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.68rem", marginTop: 2 }}>There for you.</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ color: WHITE, fontSize: "0.9rem", fontWeight: 700 }}>Coaching – Counseling – Disciplinary Notice</div>
            <div style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.75rem" }}>Employee Acknowledgement</div>
          </div>
        </div>

        {notice && (
          <div style={{ padding: "0 0 2rem" }}>

            {/* Notice info strip */}
            <div style={{ background: SOFT_BG, borderBottom: `1px solid ${BORDER}`, padding: "0.75rem 2rem", display: "flex", flexWrap: "wrap", gap: "0.4rem 2rem", fontSize: "0.78rem", color: "#374151" }}>
              {[
                ["Employee", notice.officer_name],
                ["Position", notice.position],
                ["Site", notice.client_site],
                ["Supervisor", notice.supervisor],
                ["Notice Date", formatDate(notice.notice_date)],
              ].map(([label, val]) => val ? (
                <div key={label} style={{ display: "flex", gap: 5 }}>
                  <span style={{ fontWeight: 700, textTransform: "uppercase", fontSize: "0.68rem", letterSpacing: "0.05em", color: MUTED }}>{label}:</span>
                  <span>{val}</span>
                </div>
              ) : null)}
            </div>

            {/* Facts */}
            {notice.facts && (
              <>
                <SectionBar label="3. Facts – Details of the Incident" />
                <div style={{ padding: "1rem 2rem", fontSize: "0.85rem", lineHeight: 1.7, color: TEXT, background: "#fefefe" }}>
                  {notice.facts}
                </div>
              </>
            )}

            {/* Infraction */}
            {notice.infraction && (
              <>
                <SectionBar label="2. Current Situation – Infraction / Performance Issue(s)" />
                <div style={{ padding: "1rem 2rem", fontSize: "0.85rem", color: TEXT }}>
                  {notice.infraction}
                </div>
              </>
            )}

            {/* Expectations */}
            {notice.expectations && (
              <>
                <SectionBar label="4. Expectation – Future Behavior Expected" />
                <div style={{ padding: "1rem 2rem", fontSize: "0.85rem", lineHeight: 1.7, color: TEXT }}>
                  {notice.expectations}
                  <div style={{ fontSize: "0.78rem", fontStyle: "italic", fontWeight: 600, background: SOFT_BG, border: `1px solid ${BORDER}`, borderLeft: `3px solid ${NAVY}`, borderRadius: 8, padding: "0.6rem 1rem", marginTop: "0.75rem" }}>
                    NOTE: Failure to correct the behavior/performance above may result in further discipline, up to and including termination of employment.
                  </div>
                </div>
              </>
            )}

            {/* Consequences */}
            {notice.consequences && (
              <>
                <SectionBar label="5. Consequences – Next Steps" />
                <div style={{ padding: "1rem 2rem", fontSize: "0.85rem", lineHeight: 1.7, color: TEXT }}>
                  {notice.consequences}
                </div>
              </>
            )}

            {/* Action type */}
            {notice.action_type && (
              <>
                <SectionBar label="6. Documentation of Corrective Action" />
                <div style={{ padding: "1rem 2rem", fontSize: "0.85rem", color: TEXT, fontWeight: 600 }}>
                  {notice.action_type}
                </div>
              </>
            )}

            {/* Already signed */}
            {alreadySigned ? (
              <div style={{ padding: "1.5rem 2rem" }}>
                <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 12, padding: "1rem 1.25rem", fontSize: "0.85rem", color: "#92400e", fontWeight: 600 }}>
                  This notice has already been acknowledged. Please contact your supervisor if you have questions.
                </div>
              </div>
            ) : (
              <>
                {/* Section 7 - Acknowledgement */}
                <SectionBar label="7. Acknowledgement" />
                <div style={{ padding: "1.5rem 2rem 0" }}>
                  <p style={{ fontSize: "0.85rem", lineHeight: 1.65, color: TEXT, marginBottom: "1rem" }}>
                    I acknowledge that this Coaching-Counseling-Disciplinary Notice has been reviewed with me. By signing below I acknowledge a copy has been given to me, and that a copy will be placed in my personnel file.
                  </p>
                  <div style={{ fontSize: "0.82rem", lineHeight: 1.6, color: TEXT, fontStyle: "italic", fontWeight: 600, background: SOFT_BG, border: `1px solid ${BORDER}`, borderLeft: `3px solid ${NAVY}`, borderRadius: 8, padding: "0.65rem 1rem", marginBottom: "1.5rem" }}>
                    I understand that signing this document does not constitute agreement and I may provide a rebuttal statement which will also be placed in my personnel file.
                  </div>

                  <Label>Agreement <span style={{ color: "#b3261e" }}>*</span></Label>
                  <div style={{ display: "flex", gap: "2rem", margin: "0.5rem 0 1.5rem" }}>
                    {["agreed", "disagreed"].map((val) => (
                      <label key={val} onClick={() => setAgreement(agreement === val ? "" : val)} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: "0.92rem", fontWeight: agreement === val ? 700 : 400, color: TEXT, userSelect: "none" }}>
                        <div style={{ width: 17, height: 17, border: `2px solid ${agreement === val ? NAVY : BORDER}`, borderRadius: 2, background: agreement === val ? NAVY : WHITE, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s" }}>
                          {agreement === val && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><polyline points="1.5,5 4,7.5 8.5,2.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                        </div>
                        {val.charAt(0).toUpperCase() + val.slice(1)}
                      </label>
                    ))}
                  </div>

                  <Label>Employee Comments (optional — rebuttal will be placed in personnel file)</Label>
                  <textarea value={comments} onChange={(e) => setComments(e.target.value)} placeholder="Enter any rebuttal or comments here..." rows={5} style={{ width: "100%", boxSizing: "border-box", padding: "0.6rem 0.75rem", border: `1px solid ${BORDER}`, borderRadius: 12, fontSize: "0.88rem", color: TEXT, background: "#ffffff", fontFamily: "inherit", resize: "vertical", marginTop: 4, marginBottom: "1.25rem" }} />

                  <div style={{ display: "flex", gap: "1rem" }}>
                    <div style={{ flex: 1 }}>
                      <Label>Employee Signature (type full name) <span style={{ color: "#b3261e" }}>*</span></Label>
                      <input value={signature} onChange={(e) => setSignature(e.target.value)} placeholder="Full legal name" style={inputStyle} />
                    </div>
                    <div style={{ width: 180 }}>
                      <Label>Date Signed <span style={{ color: "#b3261e" }}>*</span></Label>
                      <input type="date" value={dateSigned} onChange={(e) => setDateSigned(e.target.value)} style={inputStyle} />
                    </div>
                  </div>

                  {error && <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 12, padding: "0.75rem 1rem", fontSize: "0.82rem", color: "#b91c1c", margin: "1rem 0" }}>{error}</div>}

                  <div style={{ marginTop: "1.5rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    <button onClick={handleSubmit} disabled={!required || submitting} style={{ ...btnStyle(required && !submitting ? NAVY : "#9ca3af"), cursor: required && !submitting ? "pointer" : "not-allowed" }}>
                      {submitting ? "Submitting..." : "Submit Acknowledgement"}
                    </button>
                    {!required && <div style={{ fontSize: "0.75rem", color: MUTED, textAlign: "center" }}>Agreement selection, signature, and date are required</div>}
                  </div>
                </div>
              </>
            )}

            <div style={{ borderTop: `1px solid ${BORDER}`, marginTop: "2rem", padding: "0.85rem 2rem 0", fontSize: "0.72rem", color: MUTED, textAlign: "center" }}>
              Allied Universal Security Services &nbsp;·&nbsp; Please keep all completed forms on file for audit purposes. &nbsp;·&nbsp; rev 8/1617
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SectionBar({ label }: { label: string }) {
  return (
    <div style={{ margin: "1.75rem 2rem 0", paddingBottom: "0.5rem", borderBottom: `2px solid ${NAVY}`, color: NAVY, fontSize: "1.05rem", fontWeight: 700 }}>
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

const inputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", padding: "0.75rem 0.9rem",
  border: "1px solid #d1d5db", borderRadius: 12, fontSize: "1rem",
  color: "#1a1a2e", background: "#ffffff", outline: "none", fontFamily: "inherit", marginBottom: "1rem",
};

function btnStyle(bg: string): React.CSSProperties {
  return { background: bg, color: "#ffffff", border: "none", borderRadius: 12, padding: "0.7rem 1.75rem", fontSize: "0.85rem", fontWeight: 700, letterSpacing: "0.04em", cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase", width: "100%" };
}
