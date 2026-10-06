"use client";

import { useState, useEffect } from "react";
import { getSupabase, requireSupervisor } from "@/lib/supabase";
import SupervisorHeader, { StatStrip } from "@/components/supervisor-header";

const NAVY = "#1a4480";
const DARK = "#243b5e";
const SOFT_BG = "#f2f5fa";
const WHITE = "#ffffff";
const MUTED = "#5b6474";
const BORDER = "#dbe2ec";
const TEXT = "#0f172a";
const GREEN = "#15803d";

interface DiscRecord {
  id: string;
  officer_name: string;
  position: string;
  client_site: string;
  supervisor: string;
  notice_date: string;
  infraction: string;
  action_type: string;
  agreement: string | null;
  signature: string | null;
  submitted_at: string;
}

export default function RecordsPage() {
  const [records, setRecords] = useState<DiscRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    requireSupervisor().then((u) => {
      if (!u) return;
      getSupabase()
        .from("disciplinary_records")
        .select("id, officer_name, position, client_site, supervisor, notice_date, infraction, action_type, agreement, signature, submitted_at")
        .order("submitted_at", { ascending: false })
        .then(({ data }) => {
          setRecords(data || []);
          setLoading(false);
        });
    });
  }, []);

  const handleDelete = async (id: string) => {
    setDeleting(id);
    const supabase = getSupabase();
    const { error } = await supabase.from("disciplinary_records").delete().eq("id", id);
    if (!error) {
      setRecords((prev) => prev.filter((r) => r.id !== id));
    }
    setDeleting(null);
    setConfirmDelete(null);
  };

  const formatDate = (iso: string) => {
    if (!iso) return "";
    const d = iso.split("T")[0];
    const [y, m, day] = d.split("-");
    return `${m}/${day}/${y}`;
  };

  const filtered = records.filter((r) => {
    const matchesFilter =
      filter === "all" ||
      (filter === "pending" && !r.signature) ||
      (filter === "acknowledged" && !!r.signature);
    const matchesSearch =
      !search ||
      r.officer_name?.toLowerCase().includes(search.toLowerCase()) ||
      r.infraction?.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const pending = records.filter((r) => !r.signature).length;
  const acknowledged = records.filter((r) => !!r.signature).length;

  return (
    <div style={{ minHeight: "100vh", background: SOFT_BG, fontFamily: "var(--font-sans)", padding: "1rem 0.75rem 2rem" }}>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>

        <SupervisorHeader title="Write-ups" active="writeups" />

        <StatStrip items={[["Total", records.length], ["Awaiting signature", pending, "#8a5a00"], ["Acknowledged", acknowledged, "#146c34"]]} action={<a href="/writeup/write" style={{ display: "inline-block", background: "#1a4480", color: "#fff", textDecoration: "none", borderRadius: 999, padding: "0.5rem 1rem", fontWeight: 700, fontSize: "0.9rem" }}>+ New write-up</a>} />

        <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderTop: "none", padding: "1rem 1.25rem", display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by officer or infraction..."
            style={{ flex: 1, minWidth: 200, padding: "0.45rem 0.75rem", border: `1px solid ${BORDER}`, borderRadius: 12, fontSize: "0.85rem", color: TEXT, background: "#ffffff", outline: "none", fontFamily: "inherit" }} />
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {["all", "pending", "acknowledged"].map((f) => (
              <button key={f} onClick={() => setFilter(f)} style={{ padding: "0.4rem 0.9rem", borderRadius: 12, fontSize: "0.78rem", fontWeight: 700, border: `1px solid ${filter === f ? NAVY : BORDER}`, background: filter === f ? NAVY : WHITE, color: filter === f ? WHITE : MUTED, cursor: "pointer", fontFamily: "inherit", textTransform: "capitalize" as const }}>
                {f}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderTop: "none", padding: "2rem", textAlign: "center", color: MUTED, fontSize: "0.85rem" }}>Loading records...</div>
        ) : filtered.length === 0 ? (
          <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderTop: "none", padding: "2rem", textAlign: "center", color: MUTED, fontSize: "0.85rem" }}>No records found.</div>
        ) : (
          filtered.map((r, i) => (
            <div key={r.id} style={{ background: WHITE, border: `1px solid ${BORDER}`, borderTop: "none", borderBottom: i < filtered.length - 1 ? `1px solid ${BORDER}` : "none" }}>
              <div style={{ padding: "1rem 1.25rem", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: "0.92rem", color: TEXT }}>{r.officer_name}</span>
                    <span style={{ fontSize: "0.78rem", fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: r.signature ? "#e8f5e9" : "#fff3cd", color: r.signature ? GREEN : "#92400e", border: `1px solid ${r.signature ? "#a5d6a7" : "#fcd34d"}`, textTransform: "capitalize" as const, letterSpacing: "0.05em" }}>
                      {r.signature === "SIGNED ON PAPER" ? "Signed on Paper" : r.signature === "REFUSED TO SIGN" ? "Refused to Sign" : r.signature ? "Acknowledged" : "Pending"}
                    </span>
                  </div>
                  <div style={{ fontSize: "0.78rem", color: MUTED }}>
                    {r.position} &nbsp;·&nbsp; {r.client_site} &nbsp;·&nbsp; {formatDate(r.notice_date)}
                    {r.action_type && <span> &nbsp;·&nbsp; <span style={{ fontWeight: 600, color: TEXT }}>{r.action_type}</span></span>}
                  </div>
                  {r.infraction && <div style={{ fontSize: "0.78rem", color: MUTED, marginTop: 2 }}>{r.infraction}</div>}
                </div>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  {!r.signature && confirmDelete !== r.id && (
                    <button onClick={() => setConfirmDelete(r.id)} style={{ background: "none", border: `1px solid #fca5a5`, borderRadius: 12, color: "#b91c1c", padding: "0.4rem 0.75rem", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                      Delete
                    </button>
                  )}
                  {!r.signature && confirmDelete === r.id && (
                    <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                      <span style={{ fontSize: "0.73rem", color: "#b91c1c", fontWeight: 600 }}>Confirm?</span>
                      <button onClick={() => handleDelete(r.id)} disabled={deleting === r.id} style={{ background: "#b91c1c", border: "none", borderRadius: 12, color: WHITE, padding: "0.4rem 0.75rem", fontSize: "0.75rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                        {deleting === r.id ? "..." : "Yes, Delete"}
                      </button>
                      <button onClick={() => setConfirmDelete(null)} style={{ background: "none", border: `1px solid ${BORDER}`, borderRadius: 12, color: MUTED, padding: "0.4rem 0.75rem", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                        Cancel
                      </button>
                    </div>
                  )}
                  <a href={`/writeup/view?id=${r.id}`} style={{ ...btnStyle(NAVY), padding: "0.4rem 1rem", width: "auto", fontSize: "0.78rem", display: "inline-block", textDecoration: "none", textAlign: "center" as const }}>
                    View
                  </a>
                  {!r.signature && (
                    <a href={`/writeup/edit?id=${r.id}`} style={{ ...btnStyle("transparent"), color: NAVY, border: `1px solid ${NAVY}`, padding: "0.4rem 1rem", width: "auto", fontSize: "0.78rem", display: "inline-block", textDecoration: "none", textAlign: "center" as const }}>
                      Edit
                    </a>
                  )}
                  {!r.signature && (
                    <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/writeup/respond?id=${r.id}`); }} style={{ ...btnStyle("transparent"), color: NAVY, border: `1px solid ${NAVY}`, padding: "0.4rem 1rem", width: "auto", fontSize: "0.78rem" }}>
                      Copy Link
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}

        <div style={{ marginTop: "1rem", fontSize: "0.72rem", color: MUTED, textAlign: "center" }}>
          Allied Universal Security Services &nbsp;·&nbsp; Washington University &nbsp;·&nbsp; Keep all completed forms on file for audit purposes.
        </div>
      </div>
    </div>
  );
}

function btnStyle(bg: string): React.CSSProperties {
  return { background: bg, color: "#ffffff", border: "none", borderRadius: 12, padding: "0.7rem 1.75rem", fontSize: "0.95rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", width: "100%" };
}
