"use client";

import { useState, useEffect } from "react";
import { getSupabase, requireSupervisor } from "@/lib/supabase";
import { buildDarFormDocument, DARRecord } from "./dar-form-template";
import SupervisorHeader, { StatStrip } from "@/components/supervisor-header";

const NAVY = "#1a4480";
const DARK = "#243b5e";
const SOFT_BG = "#f2f5fa";
const WHITE = "#ffffff";
const MUTED = "#5b6474";
const BORDER = "#dbe2ec";
const TEXT = "#0f172a";
const GREEN = "#15803d";


export default function DARReport() {
  const [startDate, setStartDate] = useState("");

  // Supervisors only.
  useEffect(() => { requireSupervisor(); }, []);
  const [endDate, setEndDate] = useState("");
  const [officerFilter, setOfficerFilter] = useState("");
  const [records, setRecords] = useState<DARRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");

  const handleSearch = async () => {
    if (!startDate || !endDate) return;
    setLoading(true);
    setError("");
    setSearched(false);

    const supabase = getSupabase();
    let query = supabase
      .from("dar_submissions")
      .select("*")
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date", { ascending: true })
      .order("officer_name", { ascending: true });

    if (officerFilter.trim()) {
      query = query.ilike("officer_name", `%${officerFilter.trim()}%`);
    }

    const { data, error: dbError } = await query;

    if (dbError) {
      setError("Failed to load records. Please try again.");
      setLoading(false);
      return;
    }

    setRecords(data || []);
    setSearched(true);
    setLoading(false);
  };

  const formatDisplayDate = (iso: string) => {
    if (!iso) return "";
    return new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });
  };

  const groupByOfficer = () => {
    const groups: Record<string, DARRecord[]> = {};
    records.forEach((r) => {
      if (!groups[r.officer_name]) groups[r.officer_name] = [];
      groups[r.officer_name].push(r);
    });
    return groups;
  };

  // Print a single submission using the official Allied Universal DAR form.
  const generateSinglePDF = (dar: DARRecord) => {
    const html = buildDarFormDocument([dar]);
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(html);
      win.document.close();
      win.onload = () => { win.focus(); win.print(); };
    }
  };

  // Print every submission in the current results as official DAR form
  // pages, one per submission (grouped by officer), ready to print or
  // save as a multi-page PDF.
  const generatePDF = () => {
    const groups = groupByOfficer();
    const ordered = Object.values(groups).flat();
    const html = buildDarFormDocument(ordered);
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(html);
      win.document.close();
      win.onload = () => { win.focus(); win.print(); };
    }
  };

  const groups = groupByOfficer();

  return (
    <div style={{ minHeight: "100vh", background: SOFT_BG, fontFamily: "var(--font-sans)", padding: "1rem 0.75rem 2rem" }}>
      <div style={{ maxWidth: 800, margin: "0 auto" }}>

        <SupervisorHeader title="DAR reports" active="dars" />

        <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderTop: "none", padding: "1.5rem 1.25rem", marginBottom: "1.5rem" }}>
          <div style={{ fontSize: "0.92rem", fontWeight: 600, color: "#334155", marginBottom: "1rem" }}>Search Parameters</div>
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={{ flex: 1, minWidth: 160 }}>
              <Label>Start Date *</Label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ flex: 1, minWidth: 160 }}>
              <Label>End Date *</Label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ flex: 2, minWidth: 200 }}>
              <Label>Officer Name (optional)</Label>
              <input type="text" value={officerFilter} onChange={(e) => setOfficerFilter(e.target.value)} placeholder="Filter by officer name..." style={inputStyle} />
            </div>
            <div>
              <button onClick={handleSearch} disabled={!startDate || !endDate || loading} style={{ ...btnStyle(startDate && endDate && !loading ? NAVY : "#9ca3af"), cursor: startDate && endDate && !loading ? "pointer" : "not-allowed", padding: "0.5rem 1.5rem", width: "auto" }}>
                {loading ? "Loading..." : "Search"}
              </button>
            </div>
          </div>
          {error && <div style={{ marginTop: "0.75rem", background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 12, padding: "0.6rem 1rem", fontSize: "0.82rem", color: "#b91c1c" }}>{error}</div>}
        </div>

        {searched && (
          <>
            {records.length === 0 ? (
              <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "2rem", textAlign: "center", color: MUTED, fontSize: "0.88rem" }}>
                No DAR submissions found for the selected criteria.
              </div>
            ) : (
              <>
                <div style={{ background: DARK, padding: "0.75rem 1.25rem", display: "flex", gap: "2rem", flexWrap: "wrap", borderRadius: "4px 4px 0 0" }}>
                  {[["Submissions", records.length], ["Officers", Object.keys(groups).length], ["Incidents (*)", records.filter((r) => r.activity_log?.some((e) => e.activity?.includes("*"))).length]].map(([label, val]) => (
                    <div key={label as string}>
                      <div style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
                      <div style={{ color: WHITE, fontSize: "1.1rem", fontWeight: 700 }}>{val}</div>
                    </div>
                  ))}
                  <div style={{ marginLeft: "auto" }}>
                    <button onClick={generatePDF} style={{ ...btnStyle(GREEN), padding: "0.45rem 1.25rem", width: "auto", fontSize: "0.78rem" }}>Print DAR Forms</button>
                  </div>
                </div>

                {Object.entries(groups).map(([officer, dars]) => (
                  <div key={officer} style={{ background: WHITE, border: `1px solid ${BORDER}`, borderTop: "none" }}>
                    <div style={{ background: "#eaf1fb", padding: "0.6rem 1.25rem", borderBottom: `1px solid ${BORDER}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontWeight: 700, color: NAVY, fontSize: "0.9rem" }}>{officer}</span>
                      <span style={{ color: MUTED, fontSize: "0.78rem" }}>{dars.length} submission{dars.length !== 1 ? "s" : ""}</span>
                    </div>
                    {dars.map((dar, i) => (
                      <div key={dar.id} style={{ padding: "1rem 1.25rem", borderBottom: i < dars.length - 1 ? `1px solid ${BORDER}` : "none" }}>
                        <div style={{ marginBottom: "0.5rem" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontWeight: 700, fontSize: "0.88rem", color: TEXT }}>{formatDisplayDate(dar.date)}</span>
                            <span style={{ color: MUTED, fontSize: "0.78rem" }}>{dar.shift_start} – {dar.shift_end}</span>
                          </div>
                          {(dar.client_site || dar.scheduled_shift) && (
                            <div style={{ fontSize: "0.75rem", color: MUTED, marginTop: 2 }}>
                              {[dar.client_site, dar.branch].filter(Boolean).join(" · ")}{dar.scheduled_shift ? ` · Post: ${dar.scheduled_shift}` : ""}
                            </div>
                          )}
                        </div>
                        {dar.activity_log && dar.activity_log.filter((e) => e.activity?.trim()).length > 0 ? (
                          <div style={{ background: SOFT_BG, borderRadius: 8, padding: "0.5rem 0.75rem", marginBottom: "0.5rem" }}>
                            {dar.activity_log.filter((e) => e.activity?.trim()).map((entry, j) => (
                              <div key={j} style={{ display: "flex", gap: "0.75rem", fontSize: "0.8rem", color: TEXT, marginBottom: j < dar.activity_log.length - 1 ? "0.25rem" : 0 }}>
                                <span style={{ color: MUTED, whiteSpace: "nowrap", minWidth: 80 }}>{entry.from} – {entry.to}</span>
                                <span style={{ color: entry.activity?.includes("*") ? "#b91c1c" : TEXT, fontWeight: entry.activity?.includes("*") ? 600 : 400 }}>{entry.activity}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ fontSize: "0.78rem", color: MUTED, fontStyle: "italic", marginBottom: "0.5rem" }}>No activity entries recorded.</div>
                        )}
                        {(dar.missed_rest_break || dar.missed_meal_period) && (
                          <div style={{ fontSize: "0.78rem", color: "#b91c1c", fontWeight: 600 }}>
                            ⚠ {[dar.missed_rest_break ? "Missed rest break" : "", dar.missed_meal_period ? "Missed meal period" : ""].filter(Boolean).join(", ")}
                            {dar.missed_explanation && ` — ${dar.missed_explanation}`}
                          </div>
                        )}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.5rem" }}>
                          <div style={{ fontSize: "0.75rem", color: MUTED }}>Signed: {dar.signature}</div>
                          <button onClick={() => generateSinglePDF(dar)} style={{ background: "none", border: `1px solid ${BORDER}`, borderRadius: 12, color: MUTED, padding: "0.3rem 0.7rem", fontSize: "0.72rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4 }}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
                            Print DAR Form
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}

                <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderTop: "none", padding: "1rem 1.25rem", borderRadius: "0 0 4px 4px" }}>
                  <button onClick={generatePDF} style={{ ...btnStyle(NAVY), width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>Print DAR Forms</button>
                </div>
              </>
            )}
          </>
        )}

        <div style={{ marginTop: "1rem", fontSize: "0.72rem", color: MUTED, textAlign: "center" }}>
          Allied Universal Security Services · Washington University · Please keep all completed forms on file for audit purposes.
        </div>
      </div>
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
  color: "#1a1a2e", background: "#ffffff", outline: "none", fontFamily: "inherit",
};

function btnStyle(bg: string): React.CSSProperties {
  return { background: bg, color: "#ffffff", border: "none", borderRadius: 12, padding: "0.7rem 1.75rem", fontSize: "0.95rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", width: "100%" };
}
