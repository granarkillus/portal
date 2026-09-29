"use client";

import { useState, useRef } from "react";
import { getPublicSupabase } from "@/lib/supabase";
import { newDarId, rememberDar } from "@/lib/my-dars";

const NAVY = "#1a4480";
const DARK = "#243b5e";
const SOFT_BG = "#f2f5fa";
const WHITE = "#ffffff";
const MUTED = "#5b6474";
const BORDER = "#dbe2ec";
const TEXT = "#0f172a";
const GREEN = "#15803d";

interface ExtractedDAR {
  officer_name: string;
  date: string;
  scheduled_shift: string;
  shift_start: string;
  shift_end: string;
  received_radio: boolean;
  received_pager: boolean;
  received_keys: boolean;
  received_detex: boolean;
  activity_log: { from: string; to: string; activity: string }[];
  signature: string;
}

export default function ScanPage() {
  const [image, setImage] = useState<string | null>(null);
  const [imageType, setImageType] = useState<string>("image/jpeg");
  const [scanning, setScanning] = useState(false);
  const [extracted, setExtracted] = useState<ExtractedDAR | null>(null);
  const [error, setError] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    setError("");
    setExtracted(null);
    setEditMode(false);
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setImage(result.split(",")[1]);
      setImageType(file.type || "image/jpeg");
    };
    reader.readAsDataURL(file);
  };

  const handleScan = async () => {
    if (!image) return;
    setScanning(true);
    setError("");
    setExtracted(null);

    try {
      // The scanner runs on the dar.xing.wtf project, which holds the Anthropic key.
      const response = await fetch("https://dar.xing.wtf/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image, mediaType: imageType }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Scan failed");
      }

      const parsed: ExtractedDAR = data;

      if (!parsed.activity_log || parsed.activity_log.length === 0) {
        parsed.activity_log = [{ from: "", to: "", activity: "" }];
      }

      setExtracted(parsed);
      setEditMode(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      if (msg.toLowerCase().includes("pattern") || msg.toLowerCase().includes("json") || msg.toLowerCase().includes("format")) {
        setError("Couldn't read the form clearly. Try again with better lighting, or make sure the whole form is visible and in frame.");
      } else if (msg.toLowerCase().includes("api key") || msg.toLowerCase().includes("auth") || msg.toLowerCase().includes("401")) {
        setError("Scan service unavailable. Please submit your DAR manually using the digital form.");
      } else if (msg.toLowerCase().includes("network") || msg.toLowerCase().includes("fetch")) {
        setError("Connection error. Check your internet and try again.");
      } else {
        setError("Scan failed. Try a clearer photo with better lighting, or submit your DAR using the digital form instead.");
      }
    }

    setScanning(false);
  };

  const updateField = (field: keyof ExtractedDAR, value: unknown) => {
    setExtracted((prev) => prev ? { ...prev, [field]: value } : prev);
  };

  const updateActivity = (index: number, key: string, value: string) => {
    setExtracted((prev) => {
      if (!prev) return prev;
      const log = [...prev.activity_log];
      log[index] = { ...log[index], [key]: value };
      return { ...prev, activity_log: log };
    });
  };

  const addActivityRow = () => {
    setExtracted((prev) => prev ? { ...prev, activity_log: [...prev.activity_log, { from: "", to: "", activity: "" }] } : prev);
  };

  const removeActivityRow = (index: number) => {
    setExtracted((prev) => {
      if (!prev) return prev;
      const log = prev.activity_log.filter((_, i) => i !== index);
      return { ...prev, activity_log: log.length ? log : [{ from: "", to: "", activity: "" }] };
    });
  };

  const handleSubmit = async () => {
    if (!extracted) return;
    setSubmitting(true);
    setError("");

    const supabase = getPublicSupabase();
    const darId = newDarId();

    const { error: dbError } = await supabase.from("dar_submissions").insert([{
      id: darId,
      officer_name: extracted.officer_name,
      client_site: "Washington University",
      branch: "Saint Louis",
      date: extracted.date || new Date().toISOString().split("T")[0],
      scheduled_shift: extracted.scheduled_shift || null,
      shift_start: extracted.shift_start || null,
      shift_end: extracted.shift_end || null,
      received_radio: extracted.received_radio,
      received_pager: extracted.received_pager,
      received_keys: extracted.received_keys,
      received_detex: extracted.received_detex,
      activity_log: extracted.activity_log.filter((e) => e.activity.trim()),
      signature: extracted.signature,
    }]);

    if (dbError) {
      setError("Submission failed. Please try again.");
      setSubmitting(false);
      return;
    }

    rememberDar(darId);
    setSubmitted(true);
    setSubmitting(false);
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
            <div style={{ fontSize: "1.1rem", fontWeight: 700, color: TEXT, marginBottom: 8 }}>DAR Saved</div>
            <div style={{ color: MUTED, fontSize: "0.85rem", marginBottom: "1.5rem", lineHeight: 1.6 }}>
              The scanned DAR for {extracted?.officer_name || "the officer"} has been saved to the system.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              <button onClick={() => { setImage(null); setExtracted(null); setSubmitted(false); setEditMode(false); }} style={btnStyle(NAVY)}>Scan Another DAR</button>
              <a href="/forms" style={btnOutlineStyle(NAVY)}>Go to Officer Portal</a>
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
            <a href="/dar" style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.75rem", textDecoration: "none" }}>← Submit Digitally</a>
            <div style={{ textAlign: "right" }}>
              <div style={{ color: WHITE, fontSize: "0.95rem", fontWeight: 700 }}>Scan Paper DAR</div>
              <div style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.75rem" }}>Photo → Review → Save</div>
            </div>
          </div>
        </div>

        <div style={{ padding: "0 0 2rem" }}>

          <SectionBar label="Step 1 — Take or Upload a Photo of the Paper DAR" />
          <div style={{ padding: "1.25rem 2rem 0" }}>
            <div
              onClick={() => fileRef.current?.click()}
              style={{ border: `2px dashed ${image ? GREEN : BORDER}`, borderRadius: 8, padding: "2rem", textAlign: "center", cursor: "pointer", background: image ? "#f0fdf4" : SOFT_BG, transition: "all 0.15s" }}
            >
              {image ? (
                <div>
                  <div style={{ fontSize: "1.5rem", marginBottom: 6 }}>✓</div>
                  <div style={{ fontSize: "0.88rem", fontWeight: 700, color: GREEN }}>Photo loaded — ready to scan</div>
                  <div style={{ fontSize: "0.75rem", color: MUTED, marginTop: 4 }}>Tap to replace</div>
                </div>
              ) : (
                <div>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 0.75rem" }}>
                    <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                  </svg>
                  <div style={{ fontSize: "0.92rem", fontWeight: 700, color: NAVY, marginBottom: 4 }}>Tap to take a photo or upload</div>
                  <div style={{ fontSize: "0.78rem", color: MUTED }}>JPG, PNG, or PDF · Make sure the whole form is visible and well-lit</div>
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*,application/pdf" capture="environment" style={{ display: "none" }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />

            {image && !editMode && (
              <button onClick={handleScan} disabled={scanning} style={{ ...btnStyle(scanning ? "#9ca3af" : NAVY), marginTop: "1rem", cursor: scanning ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                {scanning ? (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: "spin 1s linear infinite" }}>
                      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                    </svg>
                    Reading form...
                  </>
                ) : "Scan DAR"}
              </button>
            )}

            {error && (
              <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 12, padding: "0.75rem 1rem", fontSize: "0.82rem", color: "#b91c1c", marginTop: "1rem" }}>
                {error}
              </div>
            )}
          </div>

          {editMode && extracted && (
            <>
              <SectionBar label="Step 2 — Review and Correct Before Saving" />
              <div style={{ padding: "0.75rem 2rem 0" }}>
                <div style={{ background: "#fff3cd", border: "1px solid #fcd34d", borderRadius: 12, padding: "0.7rem 1rem", fontSize: "0.8rem", color: "#92400e", marginBottom: "1rem" }}>
                  Check every field before saving. Correct anything the scan got wrong.
                </div>

                <Row>
                  <Field label="Officer Name *" value={extracted.officer_name} onChange={(e) => updateField("officer_name", e.target.value)} />
                  <Field label="Date *" value={extracted.date} onChange={(e) => updateField("date", e.target.value)} type="text" placeholder="MM/DD/YYYY" />
                </Row>
                <Row>
                  <Field label="Scheduled Shift / Post" value={extracted.scheduled_shift} onChange={(e) => updateField("scheduled_shift", e.target.value)} />
                </Row>
                <Row>
                  <Field label="Time In (shift start)" value={extracted.shift_start} onChange={(e) => updateField("shift_start", e.target.value)} placeholder="1800" />
                  <Field label="Time Out (shift end)" value={extracted.shift_end} onChange={(e) => updateField("shift_end", e.target.value)} placeholder="0200" />
                </Row>

                <Label>Received Items</Label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem 1.5rem", margin: "0.5rem 0 1rem" }}>
                  {(["received_radio", "received_pager", "received_keys", "received_detex"] as const).map((field) => (
                    <CheckboxItem key={field} label={field.replace("received_", "").replace(/^\w/, (c) => c.toUpperCase())}
                      checked={extracted[field] as boolean}
                      onChange={() => updateField(field, !extracted[field])} />
                  ))}
                </div>

                <Label>Activity Log</Label>
                {extracted.activity_log.map((entry, i) => (
                  <div key={i} style={{ background: SOFT_BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "0.75rem 1rem", marginBottom: "0.65rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.4rem" }}>
                      <span style={{ fontSize: "0.72rem", fontWeight: 700, color: NAVY, textTransform: "uppercase", letterSpacing: "0.05em" }}>Entry {i + 1}</span>
                      {extracted.activity_log.length > 1 && (
                        <button onClick={() => removeActivityRow(i)} style={{ background: "none", border: "none", color: MUTED, cursor: "pointer", fontSize: "0.75rem", padding: 0 }}>Remove</button>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.4rem" }}>
                      <div style={{ width: 100 }}>
                        <Label>From</Label>
                        <input value={entry.from} onChange={(e) => updateActivity(i, "from", e.target.value)} placeholder="1800" style={inputStyle} />
                      </div>
                      <div style={{ width: 100 }}>
                        <Label>To</Label>
                        <input value={entry.to} onChange={(e) => updateActivity(i, "to", e.target.value)} placeholder="2000" style={inputStyle} />
                      </div>
                    </div>
                    <div>
                      <Label>Activity</Label>
                      <input value={entry.activity} onChange={(e) => updateActivity(i, "activity", e.target.value)} placeholder="Describe activity" style={inputStyle} />
                    </div>
                  </div>
                ))}
                <button onClick={addActivityRow} style={{ background: "none", border: `1.5px dashed ${NAVY}`, borderRadius: 12, color: NAVY, padding: "0.6rem 1rem", fontSize: "0.82rem", fontWeight: 700, cursor: "pointer", width: "100%", marginBottom: "1rem", fontFamily: "inherit" }}>
                  + Add Entry
                </button>

                <Field label="Signature (officer name)" value={extracted.signature} onChange={(e) => updateField("signature", e.target.value)} required />

                <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
                  <button
                    onClick={handleSubmit}
                    disabled={!extracted.officer_name || !extracted.signature || submitting}
                    style={{ ...btnStyle(!extracted.officer_name || !extracted.signature || submitting ? "#9ca3af" : GREEN), cursor: !extracted.officer_name || !extracted.signature || submitting ? "not-allowed" : "pointer" }}
                  >
                    {submitting ? "Saving..." : "Save DAR"}
                  </button>
                  <button onClick={() => { setEditMode(false); setExtracted(null); }} style={{ ...btnStyle("transparent"), color: MUTED, border: `1px solid ${BORDER}` }}>
                    Rescan
                  </button>
                </div>
                {(!extracted.officer_name || !extracted.signature) && (
                  <div style={{ fontSize: "0.75rem", color: MUTED, textAlign: "center", marginTop: "0.5rem" }}>Officer name and signature are required</div>
                )}
              </div>
            </>
          )}

          <div style={{ borderTop: `1px solid ${BORDER}`, marginTop: "2rem", padding: "0.85rem 2rem 0", fontSize: "0.72rem", color: MUTED, textAlign: "center" }}>
            Allied Universal Security Services &nbsp;·&nbsp; Washington University &nbsp;·&nbsp; Please keep all completed forms on file for audit purposes.
          </div>
        </div>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
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
      {Array.isArray(children) ? children.map((child, i) => <div key={i} style={{ flex: 1 }}>{child}</div>) : <div style={{ flex: 1 }}>{children}</div>}
    </div>
  );
}

function CheckboxItem({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: "0.85rem", color: TEXT, fontWeight: checked ? 600 : 400, userSelect: "none", marginBottom: "0.25rem" }}>
      <div onClick={onChange} style={{ width: 16, height: 16, border: `2px solid ${checked ? NAVY : BORDER}`, borderRadius: 2, background: checked ? NAVY : WHITE, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, cursor: "pointer", transition: "all 0.15s" }}>
        {checked && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><polyline points="1.5,5 4,7.5 8.5,2.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
      </div>
      <span onClick={onChange}>{label}</span>
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", padding: "0.75rem 0.9rem",
  border: "1px solid #d1d5db", borderRadius: 12, fontSize: "1rem",
  color: TEXT, background: "#ffffff", outline: "none", fontFamily: "inherit",
};

function btnStyle(bg: string): React.CSSProperties {
  return { background: bg, color: "#ffffff", border: "none", borderRadius: 12, padding: "0.7rem 1.75rem", fontSize: "0.85rem", fontWeight: 700, letterSpacing: "0.04em", cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase", width: "100%" };
}

function btnOutlineStyle(color: string): React.CSSProperties {
  return { background: "none", color, border: `1.5px solid ${color}`, borderRadius: 12, padding: "0.7rem 1.75rem", fontSize: "0.85rem", fontWeight: 700, letterSpacing: "0.04em", cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase", width: "100%", textAlign: "center" as const, textDecoration: "none", display: "block", boxSizing: "border-box" };
}
