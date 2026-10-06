"use client";

import { useState, useEffect } from "react";
import { getSupabase, requireSupervisor } from "@/lib/supabase";
import { buildDisciplinaryFormDocument, DisciplinaryNotice } from "./disciplinary-form-template";
import SupervisorHeader, { StatStrip, headerButton } from "@/components/supervisor-header";
import { C, btnStyle } from "@/lib/theme";
import { fmtDateFull } from "@/lib/format";
import { PageSkeleton, toast } from "@/components/feedback";

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
      toast("Marked as refused to sign");
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
      toast("Marked as signed on paper");
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

  if (loading) return <PageSkeleton />;

  if (notFound) return (
    <div style={{ minHeight: "100vh", background: C.softBg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-sans)" }}>
      <div style={{ textAlign: "center", color: C.muted }}><div style={{ fontSize: "1.1rem", fontWeight: 700, color: C.text, marginBottom: 8 }}>Record Not Found</div></div>
    </div>
  );

  const isPending = !notice?.signature;

  return (
    <div style={{ minHeight: "100vh", background: C.softBg, fontFamily: "var(--font-sans)", padding: "1rem 0.75rem 2rem" }}>
      <div style={{ maxWidth: 780, margin: "0 auto" }}>

        <SupervisorHeader title="Write-up" active="writeups" actions={<><a href="/writeup/records" style={headerButton()}>← All write-ups</a>{isPending && <a href={`/writeup/edit?id=${notice?.id}`} style={headerButton()}>Edit</a>}<button type="button" onClick={generatePDF} style={headerButton(true)}>Download PDF</button></>} />

        {notice && (
          <div style={{ background: C.white, border: `1px solid ${C.border}`, borderTop: "none", borderRadius: "0 0 4px 4px" }}>

            <div style={{ padding: "1rem 1.25rem 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
                <div style={{ fontSize: "1.25rem", fontWeight: 700, color: C.text }}>{notice.officer_name}</div>
                <span style={{
                  fontSize: "0.82rem", fontWeight: 700, padding: "4px 12px", borderRadius: 999,
                  background: notice.signature === "REFUSED TO SIGN" ? C.redTint : notice.signature ? C.greenTint : C.orangeTint,
                  color: notice.signature === "REFUSED TO SIGN" ? C.red : notice.signature ? C.green : C.orange,
                  border: `1px solid ${notice.signature === "REFUSED TO SIGN" ? C.redLine : notice.signature ? C.greenLine : "#fdba74"}`,
                }}>
                  {notice.signature === "REFUSED TO SIGN" ? "Refused to sign" : notice.signature === "SIGNED ON PAPER" ? "Signed on paper" : notice.signature ? "Acknowledged" : "Waiting for officer"}
                </span>
              </div>
              <div style={{ background: C.softBg, border: `1px solid ${C.border}`, borderRadius: 12, padding: "0.8rem 1rem", display: "grid", gridTemplateColumns: "auto 1fr", gap: "0.3rem 0.9rem", fontSize: "0.92rem" }}>
                {[["Position", notice.position], ["Site", notice.client_site], ["Supervisor", notice.supervisor], ["Date", fmtDateFull(notice.notice_date)], ["Action", notice.action_type]].filter(([, v]) => v).map(([label, val]) => (
                  <div key={label} style={{ display: "contents" }}>
                    <span style={{ color: C.muted }}>{label}</span>
                    <span style={{ color: C.text, fontWeight: 600 }}>{val}</span>
                  </div>
                ))}
              </div>
            </div>

            {notice.infraction && <Section label="What happened" content={notice.infraction} />}
            {notice.facts && <Section label="Facts" content={notice.facts} />}
            {notice.expectations && (
              <div>
                <SectionBar label="Expected going forward" />
                <div style={{ padding: "1rem 1.25rem", fontSize: "0.85rem", lineHeight: 1.7, color: C.text }}>
                  {notice.expectations}
                  <div style={{ fontSize: "0.78rem", fontStyle: "italic", fontWeight: 600, background: C.softBg, border: `1px solid ${C.border}`, borderLeft: `3px solid ${C.navy}`, borderRadius: 8, padding: "0.6rem 1rem", marginTop: "0.75rem" }}>
                    NOTE: Failure to correct the behavior/performance above may result in further discipline, up to and including termination of employment.
                  </div>
                </div>
              </div>
            )}
            {notice.consequences && <Section label="Next steps" content={notice.consequences} />}
            {notice.action_type && <Section label="Corrective action" content={notice.action_type} bold />}

            <SectionBar label="Signed" />
            <div style={{ padding: "1rem 1.25rem", display: "flex", gap: "1.5rem" }}>
              <SigBlock label="Supervisor Signature" value={notice.supervisor_signature} />
              <SigBlock label="Date Signed" value={fmtDateFull(notice.supervisor_date)} narrow />
              {notice.witness_name && <SigBlock label="Witness" value={notice.witness_name} />}
            </div>

            <SectionBar label="Officer's response" />
            <div style={{ padding: "1rem 1.25rem" }}>
              {notice.signature === "REFUSED TO SIGN" ? (
                <div style={{ background: C.redTint, border: "1px solid #fca5a5", borderLeft: "3px solid #b91c1c", borderRadius: 12, padding: "0.75rem 1rem", fontSize: "0.85rem", color: C.red, fontWeight: 700 }}>
                  Security Professional refused to sign this disciplinary notice. Record completed by supervisor.
                </div>
              ) : notice.signature === "SIGNED ON PAPER" ? (
                <div style={{ background: C.softBg, border: `1px solid ${C.border}`, borderRadius: 12, padding: "1rem 1.25rem" }}>
                  <div style={{ fontSize: "0.78rem", color: C.muted, marginBottom: "0.75rem", fontStyle: "italic" }}>
                    Officer acknowledged this notice on a physical paper copy.
                  </div>
                  <div style={{ display: "flex", gap: "2rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontSize: "0.82rem", fontWeight: 600, color: C.muted, marginBottom: 2 }}>Decision</div>
                      <div style={{ fontSize: "0.92rem", fontWeight: 700, color: notice.agreement === "agreed" ? C.green : C.red }}>
                        {notice.agreement === "agreed" ? "✓ Agreed" : "✗ Disagreed"}
                      </div>
                    </div>
                  </div>
                  {notice.officer_comments && (
                    <div style={{ marginBottom: "0.75rem" }}>
                      <div style={{ fontSize: "0.82rem", fontWeight: 600, color: C.muted, marginBottom: 4 }}>Notes</div>
                      <div style={{ fontSize: "0.85rem", lineHeight: 1.6, color: C.text }}>{notice.officer_comments}</div>
                    </div>
                  )}
                  <div style={{ fontSize: "0.72rem", color: C.muted }}>Logged {fmtDateFull(notice.date_signed)}</div>
                </div>
              ) : notice.signature ? (
                <div style={{ background: C.softBg, border: `1px solid ${C.border}`, borderRadius: 12, padding: "1rem 1.25rem" }}>
                  <div style={{ display: "flex", gap: "2rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontSize: "0.82rem", fontWeight: 600, color: C.muted, marginBottom: 2 }}>Decision</div>
                      <div style={{ fontSize: "0.92rem", fontWeight: 700, color: notice.agreement === "agreed" ? C.green : C.red }}>
                        {notice.agreement === "agreed" ? "✓ Agreed" : "✗ Disagreed"}
                      </div>
                    </div>
                  </div>
                  {notice.officer_comments && (
                    <div style={{ marginBottom: "0.75rem" }}>
                      <div style={{ fontSize: "0.82rem", fontWeight: 600, color: C.muted, marginBottom: 4 }}>Employee Comments</div>
                      <div style={{ fontSize: "0.85rem", lineHeight: 1.6, color: C.text }}>{notice.officer_comments}</div>
                    </div>
                  )}
                  <div style={{ display: "flex", gap: "1.5rem" }}>
                    <SigBlock label="Employee Signature" value={notice.signature} />
                    <SigBlock label="Date Signed" value={fmtDateFull(notice.date_signed)} narrow />
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  <div style={{ background: C.amberTint, border: "1px solid #fcd34d", borderRadius: 12, padding: "0.75rem 1rem", fontSize: "0.85rem", color: C.amber, fontWeight: 600, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
                    <span>Pending employee acknowledgement.</span>
                    <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/writeup/respond?id=${notice.id}`).then(() => toast("Link copied")); }} style={{ background: "none", border: "none", color: C.amber, textDecoration: "underline", cursor: "pointer", fontFamily: "inherit", fontSize: "0.85rem", fontWeight: 700 }}>
                      Copy respond link
                    </button>
                  </div>

                  {/* Signed on paper */}
                  {!confirmSignedOnPaper && !confirmRefused && (
                    <button onClick={() => setConfirmSignedOnPaper(true)} style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 12, color: C.navy, padding: "0.5rem 1rem", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", textAlign: "left" as const }}>
                      Officer signed the paper form
                    </button>
                  )}
                  {confirmSignedOnPaper && (
                    <div style={{ background: C.softBg, border: `1px solid ${C.border}`, borderLeft: `3px solid ${C.navy}`, borderRadius: 12, padding: "0.75rem 1rem" }}>
                      <div style={{ fontSize: "0.82rem", fontWeight: 600, color: C.text, marginBottom: "0.75rem" }}>
                        Record the officer's response from the paper form:
                      </div>
                      <div style={{ display: "flex", gap: "1.5rem", marginBottom: "0.75rem" }}>
                        {(["agreed", "disagreed"] as const).map((val) => (
                          <label key={val} onClick={() => setPaperAgreement(val)} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: "0.88rem", fontWeight: paperAgreement === val ? 700 : 400, color: C.text, userSelect: "none" }}>
                            <div style={{ width: 16, height: 16, border: `2px solid ${paperAgreement === val ? C.navy : C.border}`, borderRadius: 2, background: paperAgreement === val ? C.navy : C.white, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                              {paperAgreement === val && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><polyline points="1.5,5 4,7.5 8.5,2.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                            </div>
                            {val.charAt(0).toUpperCase() + val.slice(1)}
                          </label>
                        ))}
                      </div>
                      <div style={{ marginBottom: "0.75rem" }}>
                        <div style={{ fontSize: "0.72rem", fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>Officer comments (optional)</div>
                        <textarea value={paperComments} onChange={(e) => setPaperComments(e.target.value)} placeholder="Any rebuttal or notes written on the paper form..." rows={3} style={{ width: "100%", boxSizing: "border-box", padding: "0.5rem 0.75rem", border: `1px solid ${C.border}`, borderRadius: 12, fontSize: "0.85rem", color: C.text, background: C.white, fontFamily: "inherit", resize: "vertical" as const }} />
                      </div>
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <button onClick={handleSignedOnPaper} disabled={!paperAgreement || markingSignedOnPaper} style={{ background: paperAgreement ? C.navy : C.faint, border: "none", borderRadius: 12, color: C.white, padding: "0.55rem 1rem", fontSize: "0.85rem", fontWeight: 700, cursor: paperAgreement ? "pointer" : "not-allowed", fontFamily: "inherit" }}>
                          {markingSignedOnPaper ? "..." : "Mark as Signed on Paper"}
                        </button>
                        <button onClick={() => { setConfirmSignedOnPaper(false); setPaperAgreement(""); setPaperComments(""); }} style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 12, color: C.muted, padding: "0.55rem 1rem", fontSize: "0.85rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                          Cancel
                        </button>
                      </div>
                      {!paperAgreement && <div style={{ fontSize: "0.72rem", color: C.muted, marginTop: 6 }}>Select Agreed or Disagreed to continue</div>}
                    </div>
                  )}

                  {/* Refused to sign */}
                  {!confirmRefused && !confirmSignedOnPaper && (
                    <button onClick={() => setConfirmRefused(true)} style={{ background: "none", border: `1px solid #fca5a5`, borderRadius: 12, color: C.red, padding: "0.5rem 1rem", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", textAlign: "left" as const }}>
                      Security Professional refused to sign
                    </button>
                  )}
                  {confirmRefused && (
                    <div style={{ background: C.redTint, border: "1px solid #fca5a5", borderRadius: 12, padding: "0.75rem 1rem" }}>
                      <div style={{ fontSize: "0.82rem", color: C.red, fontWeight: 600, marginBottom: "0.6rem" }}>
                        This will mark the record as complete with a "Refused to Sign" notation. This cannot be undone.
                      </div>
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <button onClick={handleRefusedToSign} disabled={markingRefused} style={{ background: C.red, border: "none", borderRadius: 12, color: C.white, padding: "0.55rem 1rem", fontSize: "0.85rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                          {markingRefused ? "..." : "Confirm — Refused to Sign"}
                        </button>
                        <button onClick={() => setConfirmRefused(false)} style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 12, color: C.muted, padding: "0.55rem 1rem", fontSize: "0.85rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div style={{ padding: "1.5rem 1.25rem", borderTop: `1px solid ${C.border}`, display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              <button onClick={generatePDF} style={{ ...btnStyle(C.navy), flex: 1 }}>
                Download Complete PDF
              </button>
              {isPending && (
                <a href={`/writeup/edit?id=${notice.id}`} style={{ ...btnStyle("transparent"), flex: "0 0 auto", width: "auto", color: C.navy, border: `1px solid ${C.navy}`, padding: "0.7rem 1.25rem", fontSize: "0.82rem", display: "inline-block", textDecoration: "none", textAlign: "center" as const }}>
                  Edit Record
                </a>
              )}
              {isPending && !confirmDelete && (
                <button onClick={() => setConfirmDelete(true)} style={{ ...btnStyle("transparent"), flex: "0 0 auto", width: "auto", color: C.red, border: `1px solid #fca5a5`, padding: "0.7rem 1.25rem", fontSize: "0.82rem" }}>
                  Delete Record
                </button>
              )}
              {isPending && confirmDelete && (
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <span style={{ fontSize: "0.78rem", color: C.red, fontWeight: 600 }}>Confirm delete?</span>
                  <button onClick={handleDelete} disabled={deleting} style={{ background: C.red, border: "none", borderRadius: 12, color: C.white, padding: "0.55rem 1rem", fontSize: "0.85rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                    {deleting ? "..." : "Yes, Delete"}
                  </button>
                  <button onClick={() => setConfirmDelete(false)} style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 12, color: C.muted, padding: "0.55rem 1rem", fontSize: "0.85rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
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
  return (
    <div style={{ margin: "1.5rem 1.25rem 0", color: C.text, fontSize: "1.1rem", fontWeight: 700 }}>
      {label}
    </div>
  );
}

function Section({ label, content, bold }: { label: string; content: string; bold?: boolean }) {
  return (
    <div>
      <SectionBar label={label} />
      <div style={{ padding: "0.5rem 1.25rem 0.25rem", fontSize: "0.98rem", lineHeight: 1.65, color: C.text, whiteSpace: "pre-wrap", fontWeight: bold ? 700 : 400 }}>{content}</div>
    </div>
  );
}

function SigBlock({ label, value, narrow }: { label: string; value: string; narrow?: boolean }) {
  return (
    <div style={{ flex: narrow ? "0 0 160px" : 1 }}>
      <div style={{ borderBottom: "1.5px solid #1a1a2e", minHeight: 28, paddingBottom: 2, fontSize: "0.92rem", color: C.text, marginBottom: 3 }}>{value}</div>
      <div style={{ fontSize: "0.68rem", color: C.muted, fontStyle: "italic" }}>{label}</div>
    </div>
  );
}

