"use client";

import { useState, useEffect } from "react";
import { getPublicSupabase } from "@/lib/supabase";
import { useDraft, clearDraft } from "@/lib/drafts";
import { C, Section, Label, Req, FieldError, SignBox, StickyBar, PrimaryButton, MissingNote, DoneCard, Chip, chipWrap, inputStyle as uiInput, todayIso } from "@/components/ui";

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
  const [dateSigned, setDateSigned] = useState(todayIso());
  const [triedSubmit, setTriedSubmit] = useState(false);
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
    setSignature(saved.signature || ""); setDateSigned(saved.dateSigned || todayIso());
  }, !submitted && !!(agreement || comments.trim() || signature.trim()));

  const required = agreement && signature && dateSigned;

  const handleSubmit = async () => {
    if (!notice || submitting) return;
    if (!required) {
      setTriedSubmit(true);
      document.getElementById(!agreement ? "agreement" : "sign-box")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
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

  const shell = (children: React.ReactNode, bar?: React.ReactNode) => (
    <div style={{ minHeight: "100vh", background: C.softBg, fontFamily: "var(--font-sans)", padding: "1rem 0.75rem 0" }}>
      <div style={{ maxWidth: 640, margin: "0 auto", background: C.white, borderRadius: 16, boxShadow: "0 10px 30px rgba(15,23,42,0.08), 0 1px 3px rgba(15,23,42,0.06)", overflow: "clip" }}>
        <div style={{ background: "linear-gradient(135deg, #0f2d57 0%, #1d4f91 100%)", padding: "1.25rem 1.5rem" }}>
          <div style={{ color: C.white, fontSize: "0.95rem", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase" }}>
            Allied<span style={{ fontWeight: 300 }}>Universal</span><sup style={{ fontSize: "0.5rem", fontWeight: 300, marginLeft: 1 }}>™</sup>
          </div>
          <div style={{ color: C.white, fontSize: "1.45rem", fontWeight: 700, marginTop: "0.6rem", lineHeight: 1.2 }}>Your notice</div>
          <div style={{ color: "rgba(255,255,255,0.8)", fontSize: "0.92rem", marginTop: 4 }}>Coaching – Counseling – Disciplinary Notice. Read it, then sign below.</div>
        </div>
        {children}
        {bar}
      </div>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "1rem 0.5rem 2rem", fontSize: "0.8rem", color: C.muted, textAlign: "center" }}>
        Allied Universal Security Services · Please keep all completed forms on file for audit purposes. · rev 8/1617
      </div>
    </div>
  );

  if (loading) {
    return shell(<div style={{ padding: "3rem 1.5rem", textAlign: "center", color: C.muted }}>Loading your notice…</div>);
  }

  if (notFound) {
    return shell(
      <div style={{ padding: "2.5rem 1.5rem", textAlign: "center" }}>
        <div style={{ fontSize: "1.15rem", fontWeight: 700, color: C.text, marginBottom: 8 }}>Notice not found</div>
        <div style={{ fontSize: "0.95rem", color: C.muted, lineHeight: 1.5 }}>This link is invalid or has expired. Please contact your supervisor.</div>
      </div>
    );
  }

  if (submitted) {
    return (
      <DoneCard title="Acknowledgement submitted">
        <div style={{ color: C.muted, fontSize: "0.95rem", lineHeight: 1.6 }}>
          Your response has been recorded and will be placed in your personnel file. A copy has been provided to your supervisor.
        </div>
      </DoneCard>
    );
  }

  const missingItems = [!agreement && "agree or disagree", !signature && "tick the box to sign", !dateSigned && "date signed"].filter(Boolean) as string[];
  const Block = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <Section title={title}>
      <div style={{ fontSize: "0.98rem", lineHeight: 1.65, color: C.text, whiteSpace: "pre-wrap" }}>{children}</div>
    </Section>
  );

  return shell(
    notice && (
      <div style={{ padding: "0.25rem 1.25rem 1.5rem" }}>
        <div style={{ marginTop: "1.25rem", background: C.softBg, border: `1px solid ${C.border}`, borderRadius: 12, padding: "0.85rem 1rem", display: "grid", gridTemplateColumns: "auto 1fr", gap: "0.3rem 0.9rem", fontSize: "0.92rem" }}>
          {[
            ["Employee", notice.officer_name],
            ["Position", notice.position],
            ["Site", notice.client_site],
            ["Supervisor", notice.supervisor],
            ["Notice date", formatDate(notice.notice_date)],
          ].filter(([, v]) => v).map(([label, val]) => (
            <div key={label} style={{ display: "contents" }}>
              <span style={{ color: C.muted }}>{label}</span>
              <span style={{ color: C.text, fontWeight: 600 }}>{val}</span>
            </div>
          ))}
        </div>

        {notice.infraction && <Block title="What happened">{notice.infraction}</Block>}
        {notice.facts && <Block title="Details of the incident">{notice.facts}</Block>}
        {notice.expectations && (
          <Block title="What's expected going forward">
            {notice.expectations}
            <div style={{ fontSize: "0.9rem", fontWeight: 600, background: C.softBg, border: `1px solid ${C.border}`, borderLeft: `3px solid ${C.navy}`, borderRadius: 10, padding: "0.7rem 1rem", marginTop: "0.75rem" }}>
              NOTE: Failure to correct the behavior/performance above may result in further discipline, up to and including termination of employment.
            </div>
          </Block>
        )}
        {notice.consequences && <Block title="Next steps">{notice.consequences}</Block>}
        {notice.action_type && <Block title="Corrective action">{notice.action_type}</Block>}

        {alreadySigned ? (
          <div style={{ marginTop: "1.5rem", background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 12, padding: "1rem 1.25rem", fontSize: "0.95rem", color: "#92400e", fontWeight: 600 }}>
            This notice has already been acknowledged. Please contact your supervisor if you have questions.
          </div>
        ) : (
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
                <Chip selected={agreement === "agreed"} onClick={() => setAgreement(agreement === "agreed" ? "" : "agreed")}>Agreed</Chip>
                <Chip selected={agreement === "disagreed"} onClick={() => setAgreement(agreement === "disagreed" ? "" : "disagreed")}>Disagreed</Chip>
              </div>
              <FieldError msg={triedSubmit && !agreement && "Pick one"} />
            </div>

            <div style={{ marginBottom: "1.25rem" }}>
              <Label>Your comments or rebuttal <span style={{ color: C.muted, fontWeight: 400, fontSize: "0.85rem" }}>(optional, placed in your personnel file)</span></Label>
              <textarea value={comments} onChange={(e) => setComments(e.target.value)} placeholder={agreement === "disagreed" ? "Explain why you disagree" : "Anything you want on record"} rows={4} style={{ ...uiInput(false), resize: "vertical", minHeight: 100, lineHeight: 1.5 }} />
            </div>

            <SignBox name={notice.officer_name || ""} signed={!!signature} onChange={(on) => setSignature(on ? (notice.officer_name || "").trim() : "")} error={triedSubmit && !signature} />
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginTop: "0.75rem", fontSize: "0.9rem", color: C.muted }}>
              <span>Date signed</span>
              <input type="date" value={dateSigned} max={todayIso()} onChange={(e) => setDateSigned(e.target.value)} style={{ ...uiInput(triedSubmit && !dateSigned), width: "auto", padding: "0.5rem 0.7rem", fontSize: "0.95rem" }} />
            </div>
          </Section>
        )}
      </div>
    ),
    notice && !alreadySigned ? (
      <StickyBar>
        {triedSubmit && <MissingNote items={missingItems} />}
        {error && <div style={{ fontSize: "0.88rem", color: C.red, fontWeight: 600, marginBottom: "0.6rem", textAlign: "center" }}>{error}</div>}
        <PrimaryButton onClick={handleSubmit} disabled={submitting}>{submitting ? "Sending…" : "Submit acknowledgement"}</PrimaryButton>
      </StickyBar>
    ) : undefined
  );
}
