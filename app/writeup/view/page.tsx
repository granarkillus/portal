"use client";

import { useState, useEffect } from "react";
import { getSupabase, requireSupervisor } from "@/lib/supabase";
import { buildDisciplinaryFormDocument, DisciplinaryNotice } from "./disciplinary-form-template";
import SupervisorHeader, { StatStrip, headerButton } from "@/components/supervisor-header";

const NAVY = "#1a4480";
const DARK = "#243b5e";
const SOFT_BG = "#f2f5fa";
const WHITE = "#ffffff";
const MUTED = "#5b6474";
const BORDER = "#dbe2ec";
const TEXT = "#0f172a";
const GREEN = "#15803d";

export default function ViewPage() {
  const [notice, setNotice] = useState<DisciplinaryNotice | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmRefused, setConfirmRefused] = useState(false);
  const [markingRefused, setMarkingRefused] = useState(false);
  const [confirmSignedOnPaper, setConfirmSignedOnPaper] = useState(false);
  const [paperAgreement, setPaperAgreement] = useState<"agreed" | "disagreed" | "">("");
  const [paperComments, setPaperComments] = useState("");
  const [markingSignedOnPaper, setMarkingSignedOnPaper] = useState(false);

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

    requireSupervisor().then((u) => {
      if (!u) return;
      getSupabase().from("disciplinary_records").select("*").eq("id", id).single()
        .then(({ data, error }) => {
          if (error || !data) setNotFound(true);
          else setNotice(data);
          setLoading(false);
        });
    });
  }, []);

  const handleDelete = async () => {
    if (!notice) return;
    setDeleting(true);
    const supabase = getSupabase();
    const { error } = await supabase.from("disciplinary_records").delete().eq("id", notice.id);
    if (!error) {
      window.location.href = "/writeup/records";
    }
    setDeleting(false);
  };

  const handleRefusedToSign = async () => {
    if (!notice) return;
    setMarkingRefused(true);
    const supabase = getSupabase();
    const { error } = await supabase
      .from("disciplinary_records")
      .update({
        signature: "REFUSED TO SIGN",
        agreement: "refused",
        date_signed: new Date().toISOString(),
        officer_comments: "Security Professional refused to sign this disciplinary notice.",
      })
      .eq("id", notice.id);
    if (!error) {
      setNotice((n) => n ? {
        ...n,
        signature: "REFUSED TO SIGN",
        agreement: "refused",
        date_signed: new Date().toISOString(),
        officer_comments: "Security Professional refused to sign this disciplinary notice.",
      } : n);
      setConfirmRefused(false);
    }
    setMarkingRefused(false);
  };

  const handleSignedOnPaper = async () => {
    if (!notice || !paperAgreement) return;
    setMarkingSignedOnPaper(true);
    const supabase = getSupabase();
    const { error } = await supabase
      .from("disciplinary_records")
      .update({
        signature: "SIGNED ON PAPER",
        agreement: paperAgreement,
        date_signed: new Date().toISOString(),
        officer_comments: paperComments || null,
      })
      .eq("id", notice.id);
    if (!error) {
      setNotice((n) => n ? {
        ...n,
        signature: "SIGNED ON PAPER",
        agreement: paperAgreement,
        date_signed: new Date().toISOString(),
        officer_comments: paperComments || null,
      } : n);
      setConfirmSignedOnPaper(false);
    }
    setMarkingSignedOnPaper(false);
  };

  // Prints the official AlliedUniversal Coaching-Counseling-Disciplinary
  // Notice form, filled with this record's data — used for both the
  // employee and supervisor copies.
  const generatePDF = () => {
    if (!notice) return;
    const html = buildDisciplinaryFormDocument(notice);
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(html);
      win.document.close();
      win.onload = () => { win.focus(); win.print(); };
    }
  };

  if (loading) return (
    <div style={{ minHeight: "100vh", background: SOFT_BG, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-sans)" }}>
      <div style={{ color: MUTED }}>Loading...</div>
    </div>
  );

  if (notFound) return (
    <div style={{ minHeight: "100vh", background: SOFT_BG, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-sans)" }}>
      <div style={{ textAlign: "center", color: MUTED }}><div style={{ fontSize: "1.1rem", fontWeight: 700, color: TEXT, marginBottom: 8 }}>Record Not Found</div></div>
    </div>
  );

  const isPending = !notice?.signature;

  return (
    <div style={{ minHeight: "100vh", background: SOFT_BG, fontFamily: "var(--font-sans)", padding: "1rem 0.75rem 2rem" }}>
      <div style={{ maxWidth: 780, margin: "0 auto" }}>

        <SupervisorHeader title="Write-up" active="writeups" actions={<><a href="/writeup/records" style={headerButton()}>← All write-ups</a>{isPending && <a href={`/writeup/edit?id=${notice?.id}`} style={headerButton()}>Edit</a>}<button type="button" onClick={generatePDF} style={headerButton(true)}>Download PDF</button></>} />

        {notice && (
          <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderTop: "none", borderRadius: "0 0 4px 4px" }}>

            <div style={{ background: SOFT_BG, borderBottom: `1px solid ${BORDER}`, padding: "0.75rem 1.25rem", display: "flex", flexWrap: "wrap", gap: "0.4rem 2rem", alignItems: "center" }}>
              {[["Employee", notice.officer_name], ["Position", notice.position], ["Site", notice.client_site], ["Supervisor", notice.supervisor], ["Date", formatDate(notice.notice_date)], ["Action", notice.action_type]].map(([label, val]) => val ? (
                <div key={label} style={{ fontSize: "0.78rem" }}>
                  <span style={{ fontWeight: 700, textTransform: "uppercase", fontSize: "0.65rem", letterSpacing: "0.05em", color: MUTED }}>{label}: </span>
                  <span style={{ color: TEXT }}>{val}</span>
                </div>
              ) : null)}
              <div style={{ marginLeft: "auto" }}>
                <span style={{
                  fontSize: "0.68rem", fontWeight: 700, padding: "3px 10px", borderRadius: 999,
                  background: notice.signature === "REFUSED TO SIGN" ? "#fef2f2" : notice.signature === "SIGNED ON PAPER" ? "#e8f5e9" : notice.signature ? "#e8f5e9" : "#fff3cd",
                  color: notice.signature === "REFUSED TO SIGN" ? "#b91c1c" : notice.signature === "SIGNED ON PAPER" ? GREEN : notice.signature ? GREEN : "#92400e",
                  border: `1px solid ${notice.signature === "REFUSED TO SIGN" ? "#fca5a5" : notice.signature === "SIGNED ON PAPER" ? "#a5d6a7" : notice.signature ? "#a5d6a7" : "#fcd34d"}`,
                  textTransform: "uppercase", letterSpacing: "0.05em",
                }}>
                  {notice.signature === "REFUSED TO SIGN" ? "Refused to Sign" : notice.signature === "SIGNED ON PAPER" ? "Signed on Paper" : notice.signature ? "Acknowledged" : "Pending Response"}
                </span>
              </div>
            </div>

            {notice.infraction && <Section label="2. Current Situation – Infraction / Performance Issue(s)" content={notice.infraction} />}
            {notice.facts && <Section label="3. Facts – WHO, WHAT, WHERE, WHEN, HOW" content={notice.facts} />}
            {notice.expectations && (
              <div>
                <SectionBar label="4. Expectation – Future Behavior Expected" />
                <div style={{ padding: "1rem 1.25rem", fontSize: "0.85rem", lineHeight: 1.7, color: TEXT }}>
                  {notice.expectations}
                  <div style={{ fontSize: "0.78rem", fontStyle: "italic", fontWeight: 600, background: SOFT_BG, border: `1px solid ${BORDER}`, borderLeft: `3px solid ${NAVY}`, borderRadius: 8, padding: "0.6rem 1rem", marginTop: "0.75rem" }}>
                    NOTE: Failure to correct the behavior/performance above may result in further discipline, up to and including termination of employment.
                  </div>
                </div>
              </div>
            )}
            {notice.consequences && <Section label="5. Consequences – Next Steps" content={notice.consequences} />}
            {notice.action_type && <Section label="6. Documentation of Corrective Action" content={notice.action_type} bold />}

            <SectionBar label="Supervisor Signature" />
            <div style={{ padding: "1rem 1.25rem", display: "flex", gap: "1.5rem" }}>
              <SigBlock label="Supervisor Signature" value={notice.supervisor_signature} />
              <SigBlock label="Date Signed" value={formatDate(notice.supervisor_date)} narrow />
              {notice.witness_name && <SigBlock label="Witness" value={notice.witness_name} />}
            </div>

            <SectionBar label="7. Acknowledgement – Employee Response" />
            <div style={{ padding: "1rem 1.25rem" }}>
              {notice.signature === "REFUSED TO SIGN" ? (
                <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderLeft: "3px solid #b91c1c", borderRadius: 12, padding: "0.75rem 1rem", fontSize: "0.85rem", color: "#b91c1c", fontWeight: 700 }}>
                  Security Professional refused to sign this disciplinary notice. Record completed by supervisor.
                </div>
              ) : notice.signature === "SIGNED ON PAPER" ? (
                <div style={{ background: SOFT_BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "1rem 1.25rem" }}>
                  <div style={{ fontSize: "0.78rem", color: MUTED, marginBottom: "0.75rem", fontStyle: "italic" }}>
                    Officer acknowledged this notice on a physical paper copy.
                  </div>
                  <div style={{ display: "flex", gap: "2rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: MUTED, marginBottom: 2 }}>Decision</div>
                      <div style={{ fontSize: "0.92rem", fontWeight: 700, color: notice.agreement === "agreed" ? GREEN : "#b91c1c" }}>
                        {notice.agreement === "agreed" ? "✓ Agreed" : "✗ Disagreed"}
                      </div>
                    </div>
                  </div>
                  {notice.officer_comments && (
                    <div style={{ marginBottom: "0.75rem" }}>
                      <div style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: MUTED, marginBottom: 4 }}>Notes</div>
                      <div style={{ fontSize: "0.85rem", lineHeight: 1.6, color: TEXT }}>{notice.officer_comments}</div>
                    </div>
                  )}
                  <div style={{ fontSize: "0.72rem", color: MUTED }}>Logged {formatDate(notice.date_signed || "")}</div>
                </div>
              ) : notice.signature ? (
                <div style={{ background: SOFT_BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "1rem 1.25rem" }}>
                  <div style={{ display: "flex", gap: "2rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: MUTED, marginBottom: 2 }}>Decision</div>
                      <div style={{ fontSize: "0.92rem", fontWeight: 700, color: notice.agreement === "agreed" ? GREEN : "#b91c1c" }}>
                        {notice.agreement === "agreed" ? "✓ Agreed" : "✗ Disagreed"}
                      </div>
                    </div>
                  </div>
                  {notice.officer_comments && (
                    <div style={{ marginBottom: "0.75rem" }}>
                      <div style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: MUTED, marginBottom: 4 }}>Employee Comments</div>
                      <div style={{ fontSize: "0.85rem", lineHeight: 1.6, color: TEXT }}>{notice.officer_comments}</div>
                    </div>
                  )}
                  <div style={{ display: "flex", gap: "1.5rem" }}>
                    <SigBlock label="Employee Signature" value={notice.signature} />
                    <SigBlock label="Date Signed" value={formatDate(notice.date_signed || "")} narrow />
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  <div style={{ background: "#fff3cd", border: "1px solid #fcd34d", borderRadius: 12, padding: "0.75rem 1rem", fontSize: "0.85rem", color: "#92400e", fontWeight: 600, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
                    <span>Pending employee acknowledgement.</span>
                    <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/writeup/respond?id=${notice.id}`); }} style={{ background: "none", border: "none", color: "#92400e", textDecoration: "underline", cursor: "pointer", fontFamily: "inherit", fontSize: "0.85rem", fontWeight: 700 }}>
                      Copy respond link
                    </button>
                  </div>

                  {/* Signed on paper */}
                  {!confirmSignedOnPaper && !confirmRefused && (
                    <button onClick={() => setConfirmSignedOnPaper(true)} style={{ background: "none", border: `1px solid ${BORDER}`, borderRadius: 12, color: NAVY, padding: "0.5rem 1rem", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", textAlign: "left" as const }}>
                      Officer signed the paper form
                    </button>
                  )}
                  {confirmSignedOnPaper && (
                    <div style={{ background: SOFT_BG, border: `1px solid ${BORDER}`, borderLeft: `3px solid ${NAVY}`, borderRadius: 12, padding: "0.75rem 1rem" }}>
                      <div style={{ fontSize: "0.82rem", fontWeight: 600, color: TEXT, marginBottom: "0.75rem" }}>
                        Record the officer's response from the paper form:
                      </div>
                      <div style={{ display: "flex", gap: "1.5rem", marginBottom: "0.75rem" }}>
                        {(["agreed", "disagreed"] as const).map((val) => (
                          <label key={val} onClick={() => setPaperAgreement(val)} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: "0.88rem", fontWeight: paperAgreement === val ? 700 : 400, color: TEXT, userSelect: "none" }}>
                            <div style={{ width: 16, height: 16, border: `2px solid ${paperAgreement === val ? NAVY : BORDER}`, borderRadius: 2, background: paperAgreement === val ? NAVY : WHITE, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                              {paperAgreement === val && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><polyline points="1.5,5 4,7.5 8.5,2.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                            </div>
                            {val.charAt(0).toUpperCase() + val.slice(1)}
                          </label>
                        ))}
                      </div>
                      <div style={{ marginBottom: "0.75rem" }}>
                        <div style={{ fontSize: "0.72rem", fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>Officer comments (optional)</div>
                        <textarea value={paperComments} onChange={(e) => setPaperComments(e.target.value)} placeholder="Any rebuttal or notes written on the paper form..." rows={3} style={{ width: "100%", boxSizing: "border-box", padding: "0.5rem 0.75rem", border: `1px solid ${BORDER}`, borderRadius: 12, fontSize: "0.85rem", color: TEXT, background: WHITE, fontFamily: "inherit", resize: "vertical" as const }} />
                      </div>
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <button onClick={handleSignedOnPaper} disabled={!paperAgreement || markingSignedOnPaper} style={{ background: paperAgreement ? NAVY : "#9ca3af", border: "none", borderRadius: 12, color: WHITE, padding: "0.45rem 1rem", fontSize: "0.78rem", fontWeight: 700, cursor: paperAgreement ? "pointer" : "not-allowed", fontFamily: "inherit" }}>
                          {markingSignedOnPaper ? "..." : "Mark as Signed on Paper"}
                        </button>
                        <button onClick={() => { setConfirmSignedOnPaper(false); setPaperAgreement(""); setPaperComments(""); }} style={{ background: "none", border: `1px solid ${BORDER}`, borderRadius: 12, color: MUTED, padding: "0.45rem 1rem", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                          Cancel
                        </button>
                      </div>
                      {!paperAgreement && <div style={{ fontSize: "0.72rem", color: MUTED, marginTop: 6 }}>Select Agreed or Disagreed to continue</div>}
                    </div>
                  )}

                  {/* Refused to sign */}
                  {!confirmRefused && !confirmSignedOnPaper && (
                    <button onClick={() => setConfirmRefused(true)} style={{ background: "none", border: `1px solid #fca5a5`, borderRadius: 12, color: "#b91c1c", padding: "0.5rem 1rem", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", textAlign: "left" as const }}>
                      Security Professional refused to sign
                    </button>
                  )}
                  {confirmRefused && (
                    <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 12, padding: "0.75rem 1rem" }}>
                      <div style={{ fontSize: "0.82rem", color: "#b91c1c", fontWeight: 600, marginBottom: "0.6rem" }}>
                        This will mark the record as complete with a "Refused to Sign" notation. This cannot be undone.
                      </div>
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <button onClick={handleRefusedToSign} disabled={markingRefused} style={{ background: "#b91c1c", border: "none", borderRadius: 12, color: WHITE, padding: "0.45rem 1rem", fontSize: "0.78rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                          {markingRefused ? "..." : "Confirm — Refused to Sign"}
                        </button>
                        <button onClick={() => setConfirmRefused(false)} style={{ background: "none", border: `1px solid ${BORDER}`, borderRadius: 12, color: MUTED, padding: "0.45rem 1rem", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div style={{ padding: "1.5rem 1.25rem", borderTop: `1px solid ${BORDER}`, display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              <button onClick={generatePDF} style={{ ...btnStyle(NAVY), flex: 1 }}>
                Download Complete PDF
              </button>
              {isPending && (
                <a href={`/writeup/edit?id=${notice.id}`} style={{ ...btnStyle("transparent"), flex: "0 0 auto", width: "auto", color: NAVY, border: `1px solid ${NAVY}`, padding: "0.7rem 1.25rem", fontSize: "0.82rem", display: "inline-block", textDecoration: "none", textAlign: "center" as const }}>
                  Edit Record
                </a>
              )}
              {isPending && !confirmDelete && (
                <button onClick={() => setConfirmDelete(true)} style={{ ...btnStyle("transparent"), flex: "0 0 auto", width: "auto", color: "#b91c1c", border: `1px solid #fca5a5`, padding: "0.7rem 1.25rem", fontSize: "0.82rem" }}>
                  Delete Record
                </button>
              )}
              {isPending && confirmDelete && (
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <span style={{ fontSize: "0.78rem", color: "#b91c1c", fontWeight: 600 }}>Confirm delete?</span>
                  <button onClick={handleDelete} disabled={deleting} style={{ background: "#b91c1c", border: "none", borderRadius: 12, color: WHITE, padding: "0.45rem 1rem", fontSize: "0.78rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                    {deleting ? "..." : "Yes, Delete"}
                  </button>
                  <button onClick={() => setConfirmDelete(false)} style={{ background: "none", border: `1px solid ${BORDER}`, borderRadius: 12, color: MUTED, padding: "0.45rem 1rem", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SectionBar({ label }: { label: string }) {
  return <div style={{ margin: "1.75rem 1.25rem 0", paddingBottom: "0.5rem", borderBottom: "2px solid #1a4480", color: "#1a4480", fontSize: "1.05rem", fontWeight: 700 }}>{label}</div>;
}

function Section({ label, content, bold }: { label: string; content: string; bold?: boolean }) {
  return (
    <div>
      <SectionBar label={label} />
      <div style={{ padding: "1rem 1.25rem", fontSize: "0.85rem", lineHeight: 1.7, color: "#1a1a2e", fontWeight: bold ? 700 : 400 }}>{content}</div>
    </div>
  );
}

function SigBlock({ label, value, narrow }: { label: string; value: string; narrow?: boolean }) {
  return (
    <div style={{ flex: narrow ? "0 0 160px" : 1 }}>
      <div style={{ borderBottom: "1.5px solid #1a1a2e", minHeight: 28, paddingBottom: 2, fontSize: "0.92rem", color: "#1a1a2e", marginBottom: 3 }}>{value}</div>
      <div style={{ fontSize: "0.68rem", color: "#6b7280", fontStyle: "italic" }}>{label}</div>
    </div>
  );
}

function btnStyle(bg: string): React.CSSProperties {
  return { background: bg, color: "#ffffff", border: "none", borderRadius: 12, padding: "0.7rem 1.75rem", fontSize: "0.95rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", width: "100%" };
}
