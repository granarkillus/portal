"use client";

import { useState, useEffect, useRef } from "react";
import { getOfficer, rememberOfficer } from "@/lib/officer-memory";
import { newDarId, rememberDar } from "@/lib/my-dars";
import { useDraft, clearDraft } from "@/lib/drafts";
import { sendOrQueue } from "@/lib/outbox";
import DraftNotice from "@/components/draft-notice";
import HourSelect from "@/components/hour-select";
import { POSTS } from "@/lib/posts";
import { BLANK, MIN_ENTRIES, PEOPLE, entryProblem, placesFor, shiftBlocks, suggestionsFor, toMinutes } from "@/lib/dar-suggestions";

const NAVY = "#1a4480";
const SOFT_BG = "#f2f5fa";
const WHITE = "#ffffff";
const MUTED = "#5b6474";
const BORDER = "#dbe2ec";
const TEXT = "#0f172a";
const GREEN = "#15803d";

interface ActivityEntry {
  id: number;
  from: string;
  to: string;
  activity: string;
  phrase?: string; // last suggestion tapped (kept on the phone only)
}

// "18:00" for the time pickers; older drafts stored "1800".
const toPicker = (t: string) => /^\d{4}$/.test(t) ? `${t.slice(0, 2)}:${t.slice(2)}` : t;
const toPaper = (t: string) => t.replace(":", "");

export default function DARForm() {
  const getCentralToday = () => {
    const now = new Date();
    const central = new Date(now.toLocaleString("en-US", { timeZone: "America/Chicago" }));
    const m = String(central.getMonth() + 1).padStart(2, "0");
    const d = String(central.getDate()).padStart(2, "0");
    const y = central.getFullYear();
    return `${m}/${d}/${y}`;
  };
  const today = getCentralToday();

  const [form, setForm] = useState({
    officerName: "",
    clientSite: "Washington University",
    branch: "Saint Louis",
    date: today,
    scheduledShift: "",
    receivedRadio: false,
    receivedPager: false,
    receivedKeys: false,
    receivedDetex: false,
    shiftStart: "",
    shiftEnd: "",
    signature: "",
  });

  const [entries, setEntries] = useState<ActivityEntry[]>([
    { id: 1, from: "", to: "", activity: "" },
    { id: 2, from: "", to: "", activity: "" },
    { id: 3, from: "", to: "", activity: "" },
    { id: 4, from: "", to: "", activity: "" },
  ]);

  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submittedDate, setSubmittedDate] = useState("");
  // Captured at submit time so the success screen can link straight to this
  // officer's own lookup list without them typing their name again.
  const [submittedName, setSubmittedName] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const name = params.get("name");
    if (name) {
      setForm((f) => ({ ...f, officerName: decodeURIComponent(name) }));
    }
  }, []);

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const toggle = (field: string) => () =>
    setForm((f) => ({ ...f, [field]: !f[field as keyof typeof f] }));

  const addEntry = () =>
    setEntries((e) => [...e, { id: Date.now(), from: "", to: "", activity: "" }]);

  const removeEntry = (id: number) =>
    setEntries((e) => e.filter((entry) => entry.id !== id));

  const updateEntry = (id: number, field: string, value: string) => {
    // Once they change an entry time themselves, stop re-timing entries.
    if (field === "from" || field === "to") setAutoTimes(false);
    setEntries((e) => e.map((entry) => entry.id === id ? { ...entry, [field]: value } : entry));
  };

  // Entry times fill in from the shift: 4 blocks for a normal shift, more for
  // long ones. Anything already written in an entry is kept.
  const [autoTimes, setAutoTimes] = useState(true);
  const shiftReady = toMinutes(form.shiftStart) !== null && toMinutes(form.shiftEnd) !== null;
  useEffect(() => {
    if (!shiftReady || !autoTimes) return;
    const blocks = shiftBlocks(form.shiftStart, form.shiftEnd);
    setEntries((prev) => {
      const next = blocks.map((b, i) => ({ id: prev[i]?.id ?? Date.now() + i, activity: prev[i]?.activity ?? "", phrase: prev[i]?.phrase, ...b }));
      // Keep extra entries that already have writing in them.
      return [...next, ...prev.slice(blocks.length).filter((e) => e.activity.trim())];
    });
  }, [form.shiftStart, form.shiftEnd, autoTimes, shiftReady]);

  // Suggestion shuffles per entry ("More ideas").
  const [seeds, setSeeds] = useState<Record<number, number>>({});
  const activityRefs = useRef<Record<number, HTMLTextAreaElement | null>>({});
  const focusBlank = (id: number) => setTimeout(() => {
    const el = activityRefs.current[id];
    if (!el) return;
    el.focus();
    const i = el.value.indexOf(BLANK);
    if (i >= 0) el.setSelectionRange(i, i + BLANK.length);
    else el.setSelectionRange(el.value.length, el.value.length);
  }, 0);
  const tapPhrase = (id: number, phrase: string) => {
    setEntries((list) => list.map((e) => e.id === id
      ? { ...e, phrase, activity: e.activity.trim() ? `${e.activity.trim().replace(/[.;]$/, "")}; ${phrase}` : phrase }
      : e));
    focusBlank(id);
  };
  const fillBlank = (id: number, word: string) => {
    setEntries((list) => list.map((e) => e.id === id ? { ...e, activity: e.activity.replace(BLANK, word) } : e));
    focusBlank(id);
  };

  // Show what's missing (in red) once they've tried to submit.
  const [triedSubmit, setTriedSubmit] = useState(false);

  // Fill in the officer's details remembered from their last Allied form.
  useEffect(() => {
    const me = getOfficer();
    if (me.name) setForm((f) => ({ ...f, officerName: f.officerName || me.name || "", scheduledShift: f.scheduledShift || me.post || "" }));
  }, []);

  // Keep an unsent DAR on this phone, even if the tab is closed and reopened.
  const draftHasContent = !!(form.shiftStart || form.shiftEnd || form.signature || entries.some((e) => e.activity.trim() || e.from || e.to));
  const draftRestored = useDraft("dar", { form, entries, autoTimes }, (saved) => {
    setForm((f) => ({ ...f, ...saved.form, shiftStart: toPicker(saved.form?.shiftStart || ""), shiftEnd: toPicker(saved.form?.shiftEnd || "") }));
    if (Array.isArray(saved.entries) && saved.entries.length) setEntries(saved.entries);
    if (saved.autoTimes === false) setAutoTimes(false);
  }, draftHasContent && !submitted);
  const [queued, setQueued] = useState(false);

  // What's still needed before this DAR can be sent.
  const filledEntries = entries.filter((e) => e.activity.trim() || e.from.trim() || e.to.trim());
  const entryIssues = entries.map((e) => (e.activity.trim() || e.from.trim() || e.to.trim() || entries.indexOf(e) < MIN_ENTRIES ? entryProblem(e) : null));
  const sameEverywhere = filledEntries.length >= MIN_ENTRIES && new Set(filledEntries.map((e) => e.activity.trim().toLowerCase())).size === 1;
  const missing: string[] = [];
  if (!form.officerName.trim()) missing.push("officer name");
  if (!form.date.trim()) missing.push("date");
  if (!shiftReady) missing.push("shift start and end times");
  else {
    if (filledEntries.length < MIN_ENTRIES) missing.push(`at least ${MIN_ENTRIES} activity entries`);
    if (entryIssues.some(Boolean)) missing.push("fix the highlighted entries");
    if (sameEverywhere) missing.push("entries can't all say the same thing");
  }
  if (!form.signature.trim()) missing.push("signature");
  const required = missing.length === 0;

  const handleSubmit = async () => {
    if (!required) {
      setTriedSubmit(true);
      const firstBad = entries.find((_, i) => entryIssues[i]);
      const target = !shiftReady ? document.getElementById("shift-times") : firstBad ? document.getElementById(`entry-${firstBad.id}`) : null;
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setSubmitting(true);
    setError("");

    const darId = newDarId();
    const result = await sendOrQueue("dar", "dar_submissions", {
      id: darId,
      officer_name: form.officerName,
      client_site: form.clientSite,
      branch: form.branch,
      date: form.date,
      scheduled_shift: form.scheduledShift || null,
      shift_start: toPaper(form.shiftStart) || null,
      shift_end: toPaper(form.shiftEnd) || null,
      received_radio: form.receivedRadio,
      received_pager: form.receivedPager,
      received_keys: form.receivedKeys,
      received_detex: form.receivedDetex,
      activity_log: entries.filter((e) => e.activity.trim()).map(({ id, from, to, activity }) => ({ id, from: from.trim(), to: to.trim(), activity: activity.trim() })),
      signature: form.signature,
    }, `DAR for ${form.date}`);

    if (result.status === "failed") {
      setError("Submission failed. Please try again.");
      setSubmitting(false);
      return;
    }

    clearDraft("dar");
    setQueued(result.status === "queued");
    rememberDar(darId);
    setSubmittedDate(form.date);
    setSubmittedName(form.officerName);
    rememberOfficer({ name: form.officerName.trim(), post: form.scheduledShift.trim() || undefined });
    setSubmitted(true);
    setSubmitting(false);
  };

  const handleReset = () => {
    setForm({
      officerName: "",
      clientSite: "Washington University",
      branch: "Saint Louis",
      date: getCentralToday(),
      scheduledShift: "",
      receivedRadio: false,
      receivedPager: false,
      receivedKeys: false,
      receivedDetex: false,
      shiftStart: "",
      shiftEnd: "",
      signature: "",
    });
    setEntries([
      { id: 1, from: "", to: "", activity: "" },
      { id: 2, from: "", to: "", activity: "" },
      { id: 3, from: "", to: "", activity: "" },
      { id: 4, from: "", to: "", activity: "" },
    ]);
    setSubmitted(false);
    setQueued(false);
    setError("");
  };

  const startOver = () => { clearDraft("dar"); handleReset(); const me = getOfficer(); if (me.name) setForm((f) => ({ ...f, officerName: me.name || "", scheduledShift: me.post || "" })); };

  if (submitted) {
    return (
      <div style={{ minHeight: "100vh", background: SOFT_BG, fontFamily: "var(--font-sans)", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem 1rem" }}>
        <div style={{ maxWidth: 480, width: "100%", background: WHITE, borderRadius: 12, boxShadow: "0 10px 30px rgba(15,23,42,0.08), 0 1px 3px rgba(15,23,42,0.06)", overflow: "hidden", textAlign: "center" }}>
          <div style={{ background: "linear-gradient(135deg, #0f2d57 0%, #1d4f91 100%)", padding: "1.25rem 2rem" }}>
            <div style={{ color: WHITE, fontSize: "1rem", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Allied<span style={{ fontWeight: 300 }}>Universal</span><sup style={{ fontSize: "0.5rem", fontWeight: 300 }}>™</sup>
            </div>
            <div style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.68rem", marginTop: 2 }}>There for you.</div>
          </div>
          <div style={{ padding: "2.5rem 2rem" }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#e8f5e9", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem" }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2f6b3a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div style={{ fontSize: "1.1rem", fontWeight: 700, color: TEXT, marginBottom: 8 }}>{queued ? "DAR Saved" : "DAR Submitted"}</div>
            <div style={{ color: MUTED, fontSize: "0.85rem", marginBottom: "1.5rem", lineHeight: 1.6 }}>
              {queued
                ? <>No signal right now, so your DAR for {submittedDate || "today"} is saved on this phone. It will send automatically when you&apos;re back online. Just open this app again if it hasn&apos;t sent.</>
                : <>Your Daily Activity Report for {submittedDate || "today"} has been recorded.</>}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              <button onClick={handleReset} style={btnStyle(NAVY)}>Submit Another DAR</button>
              <a href="/dar/my-dars" style={btnOutlineStyle(NAVY)}>View My Recent DARs</a>
              <a href="/forms" style={btnOutlineStyle(MUTED)}>Go to Officer Portal</a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: SOFT_BG, fontFamily: "var(--font-sans)", padding: "2rem 1rem" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", background: WHITE, borderRadius: 12, boxShadow: "0 10px 30px rgba(15,23,42,0.08), 0 1px 3px rgba(15,23,42,0.06)", overflow: "hidden" }}>

        <div className="hdr" style={{ background: "linear-gradient(135deg, #0f2d57 0%, #1d4f91 100%)", padding: "1.25rem 2rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ color: WHITE, fontSize: "1rem", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Allied<span style={{ fontWeight: 300 }}>Universal</span><sup style={{ fontSize: "0.5rem", fontWeight: 300, marginLeft: 1 }}>™</sup>
            </div>
            <div style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.68rem", marginTop: 2 }}>Security Services</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
            <a href="/forms" style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.75rem", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              Officer Portal
            </a>
            <div style={{ textAlign: "right" }}>
              <div style={{ color: WHITE, fontSize: "0.95rem", fontWeight: 700 }}>Daily Activity Report</div>
              <div style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.75rem" }}>Complete all sections for each day worked</div>
            </div>
          </div>
        </div>

        <div style={{ padding: "0 0 2rem" }}>

          {draftRestored && <div style={{ padding: "1.25rem 2rem 0" }}><DraftNotice what="DAR" onStartOver={startOver} /></div>}

          <SectionBar label="Section I: Employee Information" />
          <div style={{ padding: "1.25rem 2rem 0" }}>
            <Field label="Officer on Duty" value={form.officerName} onChange={set("officerName")} required placeholder="Full legal name" />
            <Row>
              <Field label="Client / Site" value={form.clientSite} onChange={set("clientSite")} />
              <Field label="Today's Date" value={form.date} onChange={set("date")} type="text" placeholder="MM/DD/YYYY" required />
            </Row>
            <Row>
              <Field label="Branch" value={form.branch} onChange={set("branch")} />
            </Row>
            <div style={{ marginBottom: "1rem" }}>
              <Label>Scheduled Shift / Post</Label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "0.5rem" }}>
                {POSTS.map((p) => {
                  const on = form.scheduledShift.trim().toLowerCase() === p.toLowerCase();
                  return (
                    <button key={p} type="button" aria-pressed={on} onClick={() => setForm((f) => ({ ...f, scheduledShift: p }))} style={{ ...chip, background: on ? NAVY : WHITE, color: on ? WHITE : TEXT, borderColor: on ? NAVY : BORDER }}>
                      {on ? "✓ " : ""}{p}
                    </button>
                  );
                })}
              </div>
              <input value={form.scheduledShift} onChange={set("scheduledShift")} placeholder="Tap your post, or type it" style={inputStyle} />
            </div>
            <Label>Received Items</Label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem 1.5rem", margin: "0.5rem 0 0.5rem" }}>
              {[["receivedRadio", "Radio"], ["receivedPager", "Pager"], ["receivedKeys", "Keys"], ["receivedDetex", "Detex"]].map(([field, label]) => (
                <CheckboxItem key={field} label={label} checked={form[field as keyof typeof form] as boolean} onChange={toggle(field)} />
              ))}
            </div>
          </div>

          <SectionBar label="Section II: Record of Hours Worked" />
          <div id="shift-times" style={{ padding: "1.25rem 2rem 0" }}>
            <div style={{ fontSize: "0.85rem", color: MUTED, marginBottom: "0.75rem" }}>Start here: your activity times fill in from your shift.</div>
            <div className="stack-sm" style={{ display: "flex", gap: "1rem" }}>
              <div style={{ flex: 1, marginBottom: "1rem" }}>
                <Label>Time In (shift start)<span style={{ color: "#b3261e", marginLeft: 2 }}>*</span></Label>
                <HourSelect ariaLabel="Time In" value={form.shiftStart} onChange={(v) => setForm((f) => ({ ...f, shiftStart: v }))} style={{ ...inputStyle, borderColor: triedSubmit && toMinutes(form.shiftStart) === null ? "#b91c1c" : "#d1d5db" }} />
              </div>
              <div style={{ flex: 1, marginBottom: "1rem" }}>
                <Label>Time Out (shift end)<span style={{ color: "#b3261e", marginLeft: 2 }}>*</span></Label>
                <HourSelect ariaLabel="Time Out" value={form.shiftEnd} onChange={(v) => setForm((f) => ({ ...f, shiftEnd: v }))} style={{ ...inputStyle, borderColor: triedSubmit && toMinutes(form.shiftEnd) === null ? "#b91c1c" : "#d1d5db" }} />
              </div>
            </div>
          </div>

          <SectionBar label="Section III: Activity Details" />
          <div style={{ padding: "1.25rem 2rem 0" }}>
            {!shiftReady ? (
              <div style={{ background: SOFT_BG, border: `1.5px dashed ${BORDER}`, borderRadius: 12, padding: "1.25rem", textAlign: "center", color: MUTED, fontSize: "0.95rem", lineHeight: 1.5 }}>
                ⏰ Enter your <strong style={{ color: TEXT }}>Time In</strong> and <strong style={{ color: TEXT }}>Time Out</strong> above.<br />Your activity entries will be set up for you.
              </div>
            ) : (
              <>
                <div style={{ fontSize: "0.85rem", color: MUTED, marginBottom: "1rem", lineHeight: 1.5 }}>
                  At least {MIN_ENTRIES} entries. <strong style={{ color: TEXT }}>Tap an idea</strong> to start a line, then tap or type to fill in the blank, or just write your own. Mark an asterisk (*) next to any security incident.
                </div>

                {entries.map((entry, index) => {
                  const issue = triedSubmit ? entryIssues[index] : null;
                  const used = entries.filter((o) => o.id !== entry.id).map((o) => o.phrase || "");
                  const ideas = suggestionsFor(index, entries.length, seeds[entry.id] || 0, used);
                  const hasBlank = entry.activity.includes(BLANK);
                  const before = hasBlank ? entry.activity.slice(0, entry.activity.indexOf(BLANK)).trim().split(/\s+/).pop()?.toLowerCase() || "" : "";
                  const after = hasBlank ? entry.activity.slice(entry.activity.indexOf(BLANK) + BLANK.length).trim().split(/\s+/)[0]?.toLowerCase() || "" : "";
                  const fillChoices = /^(vehicles|visitors)/.test(after)
                    ? ["0", "1", "2", "3", "5", "10+"]
                    : ["with", "to", "from", "assisted", "escorted", "notified", "reported"].includes(before) && !/^at$/.test(after)
                      ? PEOPLE
                      : placesFor(form.scheduledShift).slice(0, 10);
                  return (
                    <div key={entry.id} id={`entry-${entry.id}`} style={{ background: SOFT_BG, border: `1.5px solid ${issue ? "#fca5a5" : BORDER}`, borderRadius: 14, padding: "0.85rem 1rem", marginBottom: "0.85rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.6rem" }}>
                        <span style={{ fontSize: "0.75rem", fontWeight: 800, color: NAVY, textTransform: "uppercase", letterSpacing: "0.05em" }}>Entry {index + 1}</span>
                        <input aria-label="From" value={entry.from} onChange={(e) => updateEntry(entry.id, "from", e.target.value)} placeholder="From" inputMode="numeric" style={timeBox} />
                        <span style={{ color: MUTED }}>–</span>
                        <input aria-label="To" value={entry.to} onChange={(e) => updateEntry(entry.id, "to", e.target.value)} placeholder="To" inputMode="numeric" style={timeBox} />
                        <div style={{ flex: 1 }} />
                        {entries.length > MIN_ENTRIES && (
                          <button type="button" onClick={() => removeEntry(entry.id)} style={{ background: "none", border: "none", color: MUTED, cursor: "pointer", fontSize: "0.8rem", padding: "2px 4px", minHeight: 0 }}>Remove</button>
                        )}
                      </div>

                      <textarea
                        ref={(el) => { activityRefs.current[entry.id] = el; }}
                        value={entry.activity}
                        onChange={(e) => updateEntry(entry.id, "activity", e.target.value)}
                        placeholder="Tap an idea below, or type what you did"
                        rows={2}
                        style={{ ...inputStyle, resize: "vertical", minHeight: 64, lineHeight: 1.45, background: WHITE }}
                      />
                      {issue && <div style={{ color: "#b91c1c", fontSize: "0.85rem", fontWeight: 600, marginTop: 6, lineHeight: 1.4 }}>{issue}</div>}

                      {hasBlank && (
                        <div style={{ marginTop: "0.5rem" }}>
                          <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#9a3412", marginBottom: 4 }}>Fill in the blank: tap one or type it</div>
                          <div style={chipRow}>
                            {fillChoices.map((w) => (
                              <button key={w} type="button" onClick={() => fillBlank(entry.id, w)} style={{ ...chip, borderColor: "#fdba74", background: "#fff7ed", color: "#9a3412" }}>{w}</button>
                            ))}
                          </div>
                        </div>
                      )}

                      {!hasBlank && (
                        <div style={{ marginTop: "0.55rem" }}>
                          <div style={chipRow}>
                            {ideas.map((idea) => (
                              <button key={idea} type="button" onClick={() => tapPhrase(entry.id, idea)} style={chip}>
                                + {idea.replace(/___/g, "…")}
                              </button>
                            ))}
                            <button type="button" onClick={() => setSeeds((sd) => ({ ...sd, [entry.id]: (sd[entry.id] || 0) + 1 }))} style={{ ...chip, background: "none", borderStyle: "dashed", color: NAVY }}>
                              ↻ More ideas
                            </button>
                          </div>
                        </div>
                      )}

                    </div>
                  );
                })}

                {triedSubmit && sameEverywhere && (
                  <div style={{ color: "#b91c1c", fontSize: "0.88rem", fontWeight: 600, marginBottom: "0.75rem" }}>Your entries all say the same thing. Describe what you did in each time block.</div>
                )}

                <button onClick={addEntry} style={{ background: "none", border: `1.5px dashed ${NAVY}`, borderRadius: 12, color: NAVY, padding: "0.7rem 1rem", fontSize: "0.88rem", fontWeight: 700, cursor: "pointer", width: "100%", marginBottom: "0.5rem", fontFamily: "inherit" }}>
                  + Add Entry
                </button>
              </>
            )}
          </div>

          <SectionBar label="Section IV: Employee Signature" />
          <div style={{ padding: "1.25rem 2rem 0" }}>
            <div style={{ fontSize: "0.78rem", color: TEXT, lineHeight: 1.65, marginBottom: "1rem", background: SOFT_BG, border: `1px solid ${BORDER}`, borderLeft: `3px solid ${NAVY}`, borderRadius: 8, padding: "0.75rem 1rem" }}>
              By your signature, you acknowledge that the information on this DAR is a true and accurate record of your time and account activity today.
            </div>
            <Field label="Signature (type full name)" value={form.signature} onChange={set("signature")} placeholder="Full legal name" required />
            {error && (
              <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 12, padding: "0.75rem 1rem", fontSize: "0.82rem", color: "#b91c1c", marginBottom: "1rem" }}>
                {error}
              </div>
            )}
            <div style={{ marginTop: "1.5rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                style={{ ...btnStyle(!submitting ? GREEN : "#9ca3af"), cursor: !submitting ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
              >
                {submitting ? "Submitting..." : "Submit DAR"}
              </button>
              {!required && <div style={{ fontSize: "0.8rem", color: triedSubmit ? "#b91c1c" : MUTED, fontWeight: triedSubmit ? 600 : 400, textAlign: "center", lineHeight: 1.5 }}>Still needed: {missing.join(", ")}</div>}
            </div>
          </div>

          <div style={{ borderTop: `1px solid ${BORDER}`, marginTop: "2rem", padding: "0.85rem 2rem 0", fontSize: "0.72rem", color: MUTED, textAlign: "center" }}>
            Allied Universal Security Services &nbsp;·&nbsp; Washington University &nbsp;·&nbsp; Please keep all completed forms on file for audit purposes.
          </div>
        </div>
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


function Field({ label, value, onChange, placeholder, type = "text", required: req }: {
  label: string; value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string; type?: string; required?: boolean;
}) {
  return (
    <div style={{ marginBottom: "1rem" }}>
      <Label>{label}{req && <span style={{ color: "#b3261e", marginLeft: 2 }}>*</span>}</Label>
      <input type={type} value={value} onChange={onChange} placeholder={placeholder} style={inputStyle} />
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div className="stack-sm" style={{ display: "flex", gap: "1rem" }}>
      {Array.isArray(children)
        ? children.map((child, i) => <div key={i} style={{ flex: 1 }}>{child}</div>)
        : <div style={{ flex: 1 }}>{children}</div>}
    </div>
  );
}

function CheckboxItem({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: "0.85rem", color: TEXT, fontWeight: checked ? 600 : 400, userSelect: "none", marginBottom: "0.5rem" }}>
      <div onClick={onChange} style={{ width: 16, height: 16, border: `2px solid ${checked ? NAVY : BORDER}`, borderRadius: 2, background: checked ? NAVY : WHITE, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, cursor: "pointer", transition: "all 0.15s" }}>
        {checked && (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <polyline points="1.5,5 4,7.5 8.5,2.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
      <span onClick={onChange}>{label}</span>
    </label>
  );
}

const chipRow: React.CSSProperties = { display: "flex", flexWrap: "wrap", gap: "0.4rem" };
const chip: React.CSSProperties = {
  border: `1.5px solid ${BORDER}`, background: WHITE, color: TEXT, borderRadius: 999,
  padding: "0.4rem 0.75rem", fontSize: "0.84rem", fontWeight: 600, fontFamily: "inherit",
  cursor: "pointer", textAlign: "left", lineHeight: 1.3, minHeight: 36,
};
const timeBox: React.CSSProperties = {
  width: 68, padding: "0.4rem 0.3rem", border: "1px solid #d1d5db", borderRadius: 8,
  fontSize: "0.95rem", textAlign: "center", fontFamily: "inherit", background: WHITE, color: TEXT,
};

const inputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", padding: "0.75rem 0.9rem",
  border: `1px solid #d1d5db`, borderRadius: 12, fontSize: "1rem",
  color: TEXT, background: "#ffffff", outline: "none", fontFamily: "inherit",
};

function btnStyle(bg: string): React.CSSProperties {
  return {
    background: bg, color: WHITE, border: "none", borderRadius: 12,
    padding: "0.7rem 1.75rem", fontSize: "0.85rem", fontWeight: 700,
    letterSpacing: "0.04em", cursor: "pointer", fontFamily: "inherit",
    textTransform: "uppercase", width: "100%",
  };
}

function btnOutlineStyle(color: string): React.CSSProperties {
  return {
    background: "none", color: color, border: `1.5px solid ${color}`, borderRadius: 12,
    padding: "0.7rem 1.75rem", fontSize: "0.85rem", fontWeight: 700,
    letterSpacing: "0.04em", cursor: "pointer", fontFamily: "inherit",
    textTransform: "uppercase", width: "100%", textAlign: "center" as const,
    textDecoration: "none", display: "block", boxSizing: "border-box",
  };
}
