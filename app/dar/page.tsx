"use client";

import { useState, useEffect, useRef } from "react";
import { getOfficer, rememberOfficer } from "@/lib/officer-memory";
import { newDarId, rememberDar } from "@/lib/my-dars";
import { useDraft, clearDraft } from "@/lib/drafts";
import { sendOrQueue } from "@/lib/outbox";
import DraftNotice from "@/components/draft-notice";
import HourSelect from "@/components/hour-select";
import { DoneCard, outlineButton } from "@/components/ui";
import { POSTS } from "@/lib/posts";
import { BLANK, MIN_ENTRIES, PEOPLE, entryProblem, normalizeTime, placesFor, shiftBlocks, suggestionsFor, toMinutes } from "@/lib/dar-suggestions";

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

// The officer's last DAR shift, kept on this phone for "Same as last time".
const LAST_SHIFT_KEY = "allied-last-dar-shift";
interface LastShift { post: string; start: string; end: string }
function readLastShift(): LastShift | null {
  try {
    const v = JSON.parse(localStorage.getItem(LAST_SHIFT_KEY) || "null");
    return v && typeof v.start === "string" && typeof v.end === "string" ? v : null;
  } catch { return null; }
}

// Dates on the DAR are MM/DD/YYYY (St. Louis time).
function centralDate(offsetDays = 0): string {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Chicago" }));
  d.setDate(d.getDate() + offsetDays);
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
}
const centralHour = () => +new Date().toLocaleString("en-US", { timeZone: "America/Chicago", hour: "numeric", hourCycle: "h23" });
const mdyToIso = (d: string) => { const m = d.match(/^(\d{2})\/(\d{2})\/(\d{4})$/); return m ? `${m[3]}-${m[1]}-${m[2]}` : ""; };
const isoToMdy = (d: string) => { const m = d.match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? `${m[2]}/${m[3]}/${m[1]}` : d; };
const shiftLabel = (t: string) => t.replace(":", "");

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

  // "Same as last time": offered, never filled in silently.
  const [lastShift, setLastShift] = useState<LastShift | null>(null);
  useEffect(() => { setLastShift(readLastShift()); }, []);
  const lastShiftApplied = !!lastShift && form.shiftStart === lastShift.start && form.shiftEnd === lastShift.end && (!lastShift.post || form.scheduledShift === lastShift.post);
  const useLastShift = () => {
    if (!lastShift) return;
    setForm((f) => ({ ...f, shiftStart: lastShift.start, shiftEnd: lastShift.end, scheduledShift: lastShift.post || f.scheduledShift }));
  };

  // Date: Today / Yesterday / another day.
  const yesterday = centralDate(-1);
  const [otherDate, setOtherDate] = useState(false);
  const overnight = shiftReady && (toMinutes(form.shiftEnd) ?? 0) <= (toMinutes(form.shiftStart) ?? 0);
  const suggestYesterday = overnight && form.date === today && centralHour() < 12;

  // One-tap signature: confirming signs with the officer's name.
  const signed = !!form.signature;
  useEffect(() => {
    // Keep the signature matching the name if they edit the name after signing.
    setForm((f) => (f.signature && f.signature !== f.officerName.trim() ? { ...f, signature: f.officerName.trim() } : f));
  }, [form.officerName]);
  const [editSite, setEditSite] = useState(false);

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
  if (!form.signature.trim()) missing.push("tick the box to sign");
  const required = missing.length === 0;
  const doneEntries = entries.filter((e, i) => (e.activity.trim() || e.from.trim() || e.to.trim()) && !entryIssues[i]).length;

  const handleSubmit = async () => {
    if (!required) {
      setTriedSubmit(true);
      const firstBad = entries.find((_, i) => entryIssues[i]);
      const target = !shiftReady ? document.getElementById("shift-times") : firstBad ? document.getElementById(`entry-${firstBad.id}`) : !form.signature ? document.getElementById("sign-box") : null;
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
    try { localStorage.setItem(LAST_SHIFT_KEY, JSON.stringify({ post: form.scheduledShift.trim(), start: form.shiftStart, end: form.shiftEnd })); } catch { /* ignore */ }
    setLastShift({ post: form.scheduledShift.trim(), start: form.shiftStart, end: form.shiftEnd });
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
    setOtherDate(false);
    setEditSite(false);
    setTriedSubmit(false);
    setError("");
    // Keep the officer's name for the next DAR.
    const me = getOfficer();
    if (me.name) setForm((f) => ({ ...f, officerName: me.name || "" }));
  };

  const startOver = () => { clearDraft("dar"); handleReset(); const me = getOfficer(); if (me.name) setForm((f) => ({ ...f, officerName: me.name || "", scheduledShift: me.post || "" })); };

  if (submitted) {
    return (
      <DoneCard title={queued ? "DAR saved" : "DAR submitted"} tone={queued ? "wait" : "ok"}>
        <div style={{ color: MUTED, fontSize: "0.95rem", marginBottom: "1.5rem", lineHeight: 1.6 }}>
          {queued
            ? <>No signal right now, so your DAR for {submittedDate || "today"} is saved on this phone. It will send automatically when you&apos;re back online. Just open this app again if it hasn&apos;t sent.</>
            : <>Your Daily Activity Report for {submittedDate || "today"} has been recorded.</>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          <a href="/forms" style={{ ...outlineButton, background: NAVY, color: WHITE }}>Done</a>
          <a href="/dar/my-dars" style={outlineButton}>View my recent DARs</a>
          <button type="button" onClick={handleReset} style={{ ...outlineButton, color: MUTED, borderColor: BORDER }}>Submit another DAR</button>
        </div>
      </DoneCard>
    );
  }


  return (
    <div style={{ minHeight: "100vh", background: SOFT_BG, fontFamily: "var(--font-sans)", padding: "1rem 0.75rem 2rem" }}>
      <div style={{ maxWidth: 640, margin: "0 auto", background: WHITE, borderRadius: 16, boxShadow: "0 10px 30px rgba(15,23,42,0.08), 0 1px 3px rgba(15,23,42,0.06)", overflow: "clip" }}>

        <div style={{ background: "linear-gradient(135deg, #0f2d57 0%, #1d4f91 100%)", padding: "1.25rem 1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ color: WHITE, fontSize: "0.95rem", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Allied<span style={{ fontWeight: 300 }}>Universal</span><sup style={{ fontSize: "0.5rem", fontWeight: 300, marginLeft: 1 }}>™</sup>
            </div>
            <a href="/forms" style={{ color: "rgba(255,255,255,0.85)", fontSize: "0.85rem", textDecoration: "none", fontWeight: 600 }}>‹ All forms</a>
          </div>
          <div style={{ color: WHITE, fontSize: "1.5rem", fontWeight: 700, marginTop: "0.6rem", lineHeight: 1.2 }}>Daily Activity Report</div>
          <div style={{ color: "rgba(255,255,255,0.8)", fontSize: "0.95rem", marginTop: 4 }}>Enter your shift, then tap to fill in your activity.</div>
        </div>

        <div style={{ padding: "0 0 2rem" }}>

          {draftRestored && <div style={{ padding: "0.9rem 1.25rem 0" }}><DraftNotice what="DAR" onStartOver={startOver} /></div>}

          <SectionBar label="About you" />
          <div style={{ padding: "0.9rem 1.25rem 0" }}>
            <Field label="Your name" value={form.officerName} onChange={set("officerName")} required placeholder="Full legal name" />
            <div style={{ marginBottom: "1rem" }}>
              <Label>Date of shift<span style={{ color: "#b3261e", marginLeft: 2 }}>*</span></Label>
              <div style={chipRow}>
                {[["Today", today], ["Yesterday", yesterday]].map(([label, value]) => {
                  const on = !otherDate && form.date === value;
                  return (
                    <button key={label} type="button" aria-pressed={on} onClick={() => { setOtherDate(false); setForm((f) => ({ ...f, date: value })); }} style={{ ...chip, background: on ? NAVY : WHITE, color: on ? WHITE : TEXT, borderColor: on ? NAVY : BORDER }}>
                      {on ? "✓ " : ""}{label}
                    </button>
                  );
                })}
                {(() => {
                  const on = otherDate || (form.date !== today && form.date !== yesterday);
                  return (
                    <button type="button" aria-pressed={on} onClick={() => setOtherDate(true)} style={{ ...chip, background: on ? NAVY : WHITE, color: on ? WHITE : TEXT, borderColor: on ? NAVY : BORDER }}>
                      {on ? `✓ ${form.date || "Another day"}` : "Another day"}
                    </button>
                  );
                })()}
              </div>
              {(otherDate || (form.date !== today && form.date !== yesterday)) && (
                <input type="date" aria-label="Date of shift" value={mdyToIso(form.date)} max={mdyToIso(today)} onChange={(e) => setForm((f) => ({ ...f, date: isoToMdy(e.target.value) }))} style={{ ...inputStyle, marginTop: "0.5rem" }} />
              )}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.88rem", color: MUTED, marginBottom: "1rem" }}>
              <span>📍 {form.clientSite || "—"} · {form.branch || "—"}</span>
              <button type="button" onClick={() => setEditSite((v) => !v)} style={{ background: "none", border: "none", padding: 0, minHeight: 0, color: NAVY, fontWeight: 700, textDecoration: "underline", cursor: "pointer", fontFamily: "inherit", fontSize: "0.85rem" }}>{editSite ? "Done" : "Edit"}</button>
            </div>
            {editSite && (
              <Row>
                <Field label="Client / Site" value={form.clientSite} onChange={set("clientSite")} />
                <Field label="Branch" value={form.branch} onChange={set("branch")} />
              </Row>
            )}
            <div style={{ marginBottom: "1rem" }}>
              <Label>Your post</Label>
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
            <Label>Received items <span style={{ color: MUTED, fontWeight: 400, fontSize: "0.85rem" }}>(tap all that apply)</span></Label>
            <div style={{ ...chipRow, gap: "0.5rem", marginBottom: "0.5rem" }}>
              {([["receivedRadio", "Radio"], ["receivedPager", "Pager"], ["receivedKeys", "Keys"], ["receivedDetex", "Detex"]] as const).map(([field, label]) => {
                const on = form[field];
                return (
                  <button key={field} type="button" aria-pressed={on} onClick={toggle(field)} style={{ ...chip, minHeight: 44, padding: "0.5rem 1rem", background: on ? NAVY : WHITE, color: on ? WHITE : TEXT, borderColor: on ? NAVY : BORDER }}>
                    {on ? "✓ " : ""}{label}
                  </button>
                );
              })}
            </div>
          </div>

          <SectionBar label="Your shift" />
          <div id="shift-times" style={{ padding: "0.9rem 1.25rem 0" }}>
            <div style={{ fontSize: "0.85rem", color: MUTED, marginBottom: "0.75rem" }}>Start here: your activity times fill in from your shift.</div>
            {lastShift && !lastShiftApplied && (
              <button type="button" onClick={useLastShift} style={{ display: "flex", alignItems: "center", gap: "0.6rem", width: "100%", textAlign: "left", background: "#eaf1fb", border: `1.5px solid ${NAVY}`, borderRadius: 12, padding: "0.75rem 0.9rem", marginBottom: "1rem", cursor: "pointer", fontFamily: "inherit", color: NAVY, minHeight: 0 }}>
                <span style={{ fontSize: "1.1rem" }}>↺</span>
                <span style={{ flex: 1 }}>
                  <span style={{ display: "block", fontWeight: 700, fontSize: "0.95rem" }}>Same as last time</span>
                  <span style={{ display: "block", fontSize: "0.85rem", color: MUTED }}>{lastShift.post ? `${lastShift.post} · ` : ""}{shiftLabel(lastShift.start)}–{shiftLabel(lastShift.end)}</span>
                </span>
                <span style={{ fontWeight: 700, fontSize: "0.88rem" }}>Use ›</span>
              </button>
            )}
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

          {suggestYesterday && (
            <div style={{ margin: "0.75rem 1.25rem 0", background: "#fff7ed", border: "1px solid #fdba74", borderRadius: 12, padding: "0.75rem 0.9rem", display: "flex", gap: "0.6rem", alignItems: "center", fontSize: "0.9rem", color: "#9a3412" }}>
              <span style={{ flex: 1 }}>🌙 Overnight shift: it started yesterday. Use yesterday&apos;s date?</span>
              <button type="button" onClick={() => { setOtherDate(false); setForm((f) => ({ ...f, date: yesterday })); }} style={{ background: "#9a3412", color: WHITE, border: "none", borderRadius: 999, padding: "0.4rem 0.85rem", fontWeight: 700, fontFamily: "inherit", fontSize: "0.85rem", cursor: "pointer", minHeight: 0, whiteSpace: "nowrap" }}>Use {yesterday.slice(0, 5)}</button>
            </div>
          )}

          <SectionBar label="Activity" />
          <div style={{ padding: "0.9rem 1.25rem 0" }}>
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
                        <input aria-label="From" value={entry.from} onChange={(e) => updateEntry(entry.id, "from", e.target.value)} onBlur={(e) => { const v = normalizeTime(e.target.value, form.shiftStart, form.shiftEnd); if (v !== e.target.value) updateEntry(entry.id, "from", v); }} placeholder="From" inputMode="numeric" style={timeBox} />
                        <span style={{ color: MUTED }}>–</span>
                        <input aria-label="To" value={entry.to} onChange={(e) => updateEntry(entry.id, "to", e.target.value)} onBlur={(e) => { const v = normalizeTime(e.target.value, form.shiftStart, form.shiftEnd); if (v !== e.target.value) updateEntry(entry.id, "to", v); }} placeholder="To" inputMode="numeric" style={timeBox} />
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

          <SectionBar label="Sign" />
          <div style={{ padding: "0.9rem 1.25rem 0" }}>
            <div style={{ fontSize: "0.78rem", color: TEXT, lineHeight: 1.65, marginBottom: "1rem", background: SOFT_BG, border: `1px solid ${BORDER}`, borderLeft: `3px solid ${NAVY}`, borderRadius: 8, padding: "0.75rem 1rem" }}>
              By your signature, you acknowledge that the information on this DAR is a true and accurate record of your time and account activity today.
            </div>
            <label id="sign-box" style={{ display: "flex", gap: "0.85rem", alignItems: "flex-start", cursor: "pointer", border: `1.5px solid ${triedSubmit && !signed ? "#b91c1c" : signed ? NAVY : BORDER}`, background: signed ? "#eaf1fb" : WHITE, borderRadius: 12, padding: "1rem", marginBottom: "1rem" }}>
              <input type="checkbox" checked={signed} disabled={!form.officerName.trim()} onChange={(e) => setForm((f) => ({ ...f, signature: e.target.checked ? f.officerName.trim() : "" }))} style={{ width: 24, height: 24, marginTop: 1, accentColor: NAVY, flexShrink: 0 }} />
              <span style={{ fontSize: "0.95rem", color: TEXT, lineHeight: 1.5 }}>
                {form.officerName.trim() ? <>Sign as <strong>{form.officerName.trim()}</strong></> : <span style={{ color: MUTED }}>Enter your name at the top to sign</span>}
                {signed && <span style={{ display: "block", marginTop: 4, color: MUTED, fontSize: "0.85rem" }}>Signed: <em style={{ fontFamily: "Georgia, serif", color: TEXT }}>{form.signature}</em></span>}
              </span>
            </label>
            {error && (
              <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 12, padding: "0.75rem 1rem", fontSize: "0.82rem", color: "#b91c1c", marginBottom: "1rem" }}>
                {error}
              </div>
            )}
          </div>

          <div style={{ borderTop: `1px solid ${BORDER}`, marginTop: "2rem", padding: "0.85rem 1.25rem 0", fontSize: "0.72rem", color: MUTED, textAlign: "center" }}>
            Allied Universal Security Services &nbsp;·&nbsp; Washington University &nbsp;·&nbsp; Please keep all completed forms on file for audit purposes.
          </div>
        </div>

        <div style={{ position: "sticky", bottom: 0, background: "rgba(255,255,255,0.97)", borderTop: `1px solid ${BORDER}`, padding: "0.75rem 1.25rem calc(0.75rem + env(safe-area-inset-bottom))", backdropFilter: "blur(6px)", zIndex: 5 }}>
          {shiftReady && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.5rem" }}>
              <div style={{ flex: 1, height: 6, background: "#e5eaf1", borderRadius: 99, overflow: "hidden" }}>
                <div style={{ width: `${Math.min(100, (doneEntries / MIN_ENTRIES) * 100)}%`, height: "100%", background: doneEntries >= MIN_ENTRIES ? GREEN : NAVY, transition: "width 0.2s" }} />
              </div>
              <span style={{ fontSize: "0.82rem", fontWeight: 700, color: doneEntries >= MIN_ENTRIES ? GREEN : MUTED, whiteSpace: "nowrap" }}>
                {Math.min(doneEntries, entries.length)} of {Math.max(MIN_ENTRIES, entries.length)} entries done
              </span>
            </div>
          )}
          {!required && triedSubmit && (
            <div style={{ fontSize: "0.82rem", color: "#b91c1c", fontWeight: 600, textAlign: "center", lineHeight: 1.4, marginBottom: "0.5rem" }}>Still needed: {missing.join(", ")}</div>
          )}
          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{ width: "100%", minHeight: 52, background: submitting ? "#94a3b8" : required ? GREEN : NAVY, color: WHITE, border: "none", borderRadius: 12, fontSize: "1.02rem", fontWeight: 700, fontFamily: "inherit", cursor: submitting ? "not-allowed" : "pointer" }}
          >
            {submitting ? "Submitting…" : "Submit DAR"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SectionBar({ label }: { label: string }) {
  return (
    <div style={{ margin: "1.75rem 1.25rem 0", color: TEXT, fontSize: "1.15rem", fontWeight: 700 }}>
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
    padding: "0.7rem 1.75rem", fontSize: "0.95rem", fontWeight: 700,
    cursor: "pointer", fontFamily: "inherit",
    width: "100%",
  };
}

function btnOutlineStyle(color: string): React.CSSProperties {
  return {
    background: "none", color: color, border: `1.5px solid ${color}`, borderRadius: 12,
    padding: "0.7rem 1.75rem", fontSize: "0.95rem", fontWeight: 700,
    cursor: "pointer", fontFamily: "inherit",
    width: "100%", textAlign: "center" as const,
    textDecoration: "none", display: "block", boxSizing: "border-box",
  };
}
