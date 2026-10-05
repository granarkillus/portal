"use client";

import { useState, useEffect } from "react";
import { getPublicSupabase } from "@/lib/supabase";
import { getRememberedDars } from "@/lib/my-dars";

const NAVY = "#1a4480";
const DARK = "#243b5e";
const SOFT_BG = "#f2f5fa";
const WHITE = "#ffffff";
const MUTED = "#5b6474";
const BORDER = "#dbe2ec";
const TEXT = "#0f172a";
const GREEN = "#15803d";

interface ActivityEntry {
  from: string;
  to: string;
  activity: string;
}

interface DARRow {
  id: string;
  officer_name: string;
  date: string;
  scheduled_shift: string | null;
  shift_start: string | null;
  shift_end: string | null;
  activity_log: ActivityEntry[] | null;
  submitted_at: string;
}

export default function MyDARsPage() {
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<DARRow[]>([]);
  const [error, setError] = useState("");

  // Formats the stored submitted_at into a plain readable stamp.
  const formatSubmitted = (iso: string) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleString("en-US", {
      month: "numeric", day: "numeric", year: "numeric",
      hour: "numeric", minute: "2-digit", hour12: true,
    });
  };

  // Loads the DARs this phone submitted (remembered on the device at submit time).
  useEffect(() => {
    const ids = getRememberedDars();
    setSearched(true);
    if (ids.length === 0) return;
    setLoading(true);
    getPublicSupabase()
      .rpc("get_my_dars", { p_ids: ids })
      .then(({ data, error: dbError }) => {
        if (dbError) {
          setError("Couldn't load your reports. Please try again.");
          setRecords([]);
        } else {
          setRecords(((data as DARRow[]) || []).slice(0, 10));
        }
        setLoading(false);
      });
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: SOFT_BG, fontFamily: "var(--font-sans)", padding: "1rem 0.75rem 2rem" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", background: WHITE, borderRadius: 16, boxShadow: "0 10px 30px rgba(15,23,42,0.08), 0 1px 3px rgba(15,23,42,0.06)", overflow: "hidden" }}>

        <div style={{ background: "linear-gradient(135deg, #0f2d57 0%, #1d4f91 100%)", padding: "1.25rem 1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ color: "#fff", fontSize: "0.95rem", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Allied<span style={{ fontWeight: 300 }}>Universal</span><sup style={{ fontSize: "0.5rem", fontWeight: 300, marginLeft: 1 }}>™</sup>
            </div>
            <a href="/dar" style={{ color: "rgba(255,255,255,0.85)", fontSize: "0.85rem", textDecoration: "none", fontWeight: 600 }}>‹ Submit a DAR</a>
          </div>
          <div style={{ color: "#fff", fontSize: "1.45rem", fontWeight: 700, marginTop: "0.6rem", lineHeight: 1.2 }}>My recent DARs</div>
          <div style={{ color: "rgba(255,255,255,0.8)", fontSize: "0.92rem", marginTop: 4 }}>The DARs you sent from this phone</div>
        </div>

        <div style={{ padding: "1.5rem 1.25rem" }}>

          <div style={{ fontSize: "0.85rem", color: MUTED, lineHeight: 1.5, marginBottom: "1.25rem" }}>
            {loading ? "Loading your reports..." : "These are the DARs submitted from this phone."}
          </div>

          {error && (
            <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 12, padding: "0.75rem 1rem", fontSize: "0.85rem", color: "#b91c1c", marginBottom: "1rem" }}>
              {error}
            </div>
          )}

          {searched && !loading && !error && records.length === 0 && (
            <div style={{ background: SOFT_BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "1.5rem", textAlign: "center" }}>
              <div style={{ fontSize: "0.92rem", fontWeight: 700, color: TEXT, marginBottom: 6 }}>No reports on this phone yet</div>
              <div style={{ fontSize: "0.82rem", color: MUTED, lineHeight: 1.5 }}>
                DARs you submit from this phone will show up here. Reports sent from another
                phone or before this list existed won't appear, but your supervisor still has them.
              </div>
            </div>
          )}

          {records.length > 0 && (
            <>
              <div style={{ fontSize: "0.75rem", fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.6rem" }}>
                {records.length} most recent {records.length === 1 ? "report" : "reports"}
              </div>

              {records.map((r) => {
                const entries = (r.activity_log || []).filter((e) => e.activity && e.activity.trim());
                return (
                  <div key={r.id} style={{ border: `1px solid ${BORDER}`, borderLeft: `4px solid ${GREEN}`, borderRadius: 12, padding: "0.85rem 1.1rem", marginBottom: "0.7rem", background: WHITE }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: "0.5rem" }}>
                      <div style={{ fontSize: "0.95rem", fontWeight: 700, color: TEXT }}>{r.date}</div>
                      <div style={{ fontSize: "0.72rem", color: GREEN, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                        ✓ Received
                      </div>
                    </div>

                    <div style={{ fontSize: "0.78rem", color: MUTED, marginTop: 3 }}>
                      {[r.scheduled_shift, (r.shift_start || r.shift_end) ? `${r.shift_start || ""}${r.shift_end ? " – " + r.shift_end : ""}` : ""]
                        .filter(Boolean).join(" · ")}
                    </div>

                    <div style={{ fontSize: "0.75rem", color: MUTED, marginTop: 4 }}>
                      Submitted {formatSubmitted(r.submitted_at)}
                    </div>

                    {entries.length > 0 && (
                      <div style={{ fontSize: "0.78rem", color: MUTED, marginTop: 6, paddingTop: 6, borderTop: `1px solid ${BORDER}` }}>
                        {entries.length} activity {entries.length === 1 ? "entry" : "entries"}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}

          <div style={{ borderTop: `1px solid ${BORDER}`, marginTop: "1.5rem", paddingTop: "1rem", fontSize: "0.75rem", color: MUTED, textAlign: "center", lineHeight: 1.5 }}>
            This shows your last 10 submissions from this phone. If something looks wrong or missing, tell your supervisor.
          </div>

        </div>
      </div>
    </div>
  );
}
