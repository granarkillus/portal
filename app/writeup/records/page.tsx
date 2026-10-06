"use client";

import { useState, useEffect } from "react";
import { getSupabase, requireSupervisor } from "@/lib/supabase";
import SupervisorHeader, { StatStrip } from "@/components/supervisor-header";
import { C, btnStyle } from "@/lib/theme";
import { fmtDate } from "@/lib/format";
import { Skeleton, toast } from "@/components/feedback";

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
      toast("Write-up deleted");
    }
    setDeleting(null);
    setConfirmDelete(null);
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
    <div style={{ minHeight: "100vh", background: C.softBg, fontFamily: "var(--font-sans)", padding: "1rem 0.75rem 2rem" }}>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>

        <SupervisorHeader title="Write-ups" active="writeups" />

        <StatStrip items={[["Total", records.length], ["Awaiting signature", pending, "#8a5a00"], ["Acknowledged", acknowledged, "#146c34"]]} action={<a href="/writeup/write" style={{ display: "inline-block", background: C.navy, color: C.white, textDecoration: "none", borderRadius: 999, padding: "0.5rem 1rem", fontWeight: 700, fontSize: "0.9rem" }}>+ New write-up</a>} />

        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderTop: "none", padding: "1rem 1.25rem", display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by officer or infraction..."
            style={{ flex: 1, minWidth: 200, padding: "0.45rem 0.75rem", border: `1px solid ${C.border}`, borderRadius: 12, fontSize: "0.85rem", color: C.text, background: C.white, outline: "none", fontFamily: "inherit" }} />
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {["all", "pending", "acknowledged"].map((f) => (
              <button key={f} onClick={() => setFilter(f)} style={{ padding: "0.55rem 0.9rem", borderRadius: 12, fontSize: "0.85rem", fontWeight: 700, border: `1px solid ${filter === f ? C.navy : C.border}`, background: filter === f ? C.navy : C.white, color: filter === f ? C.white : C.muted, cursor: "pointer", fontFamily: "inherit", textTransform: "capitalize" as const }}>
                {f}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ background: C.white, border: `1px solid ${C.border}`, borderTop: "none", borderRadius: "0 0 16px 16px", overflow: "hidden" }}><Skeleton rows={5} card={false} /></div>
        ) : filtered.length === 0 ? (
          <div style={{ background: C.white, border: `1px solid ${C.border}`, borderTop: "none", padding: "2rem", textAlign: "center", color: C.muted, fontSize: "0.85rem" }}>No records found.</div>
        ) : (
          filtered.map((r, i) => (
            <div key={r.id} style={{ background: C.white, border: `1px solid ${C.border}`, borderTop: "none", borderBottom: i < filtered.length - 1 ? `1px solid ${C.border}` : "none" }}>
              <div style={{ padding: "1rem 1.25rem", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: "0.92rem", color: C.text }}>{r.officer_name}</span>
                    <span style={{ fontSize: "0.78rem", fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: r.signature ? C.greenTint : C.amberTint, color: r.signature ? C.green : C.amber, border: `1px solid ${r.signature ? C.greenLine : C.amberLine}`, textTransform: "capitalize" as const, letterSpacing: "0.05em" }}>
                      {r.signature === "SIGNED ON PAPER" ? "Signed on Paper" : r.signature === "REFUSED TO SIGN" ? "Refused to Sign" : r.signature ? "Acknowledged" : "Pending"}
                    </span>
                  </div>
                  <div style={{ fontSize: "0.78rem", color: C.muted }}>
                    {r.position} &nbsp;·&nbsp; {r.client_site} &nbsp;·&nbsp; {fmtDate(r.notice_date)}
                    {r.action_type && <span> &nbsp;·&nbsp; <span style={{ fontWeight: 600, color: C.text }}>{r.action_type}</span></span>}
                  </div>
                  {r.infraction && <div style={{ fontSize: "0.78rem", color: C.muted, marginTop: 2 }}>{r.infraction}</div>}
                </div>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  {!r.signature && confirmDelete !== r.id && (
                    <button onClick={() => setConfirmDelete(r.id)} style={{ background: "none", border: `1px solid #fca5a5`, borderRadius: 12, color: C.red, padding: "0.55rem 0.75rem", fontSize: "0.85rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                      Delete
                    </button>
                  )}
                  {!r.signature && confirmDelete === r.id && (
                    <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                      <span style={{ fontSize: "0.73rem", color: C.red, fontWeight: 600 }}>Confirm?</span>
                      <button onClick={() => handleDelete(r.id)} disabled={deleting === r.id} style={{ background: C.red, border: "none", borderRadius: 12, color: C.white, padding: "0.55rem 0.75rem", fontSize: "0.85rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                        {deleting === r.id ? "..." : "Yes, Delete"}
                      </button>
                      <button onClick={() => setConfirmDelete(null)} style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 12, color: C.muted, padding: "0.55rem 0.75rem", fontSize: "0.85rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                        Cancel
                      </button>
                    </div>
                  )}
                  <a href={`/writeup/view?id=${r.id}`} style={{ ...btnStyle(C.navy), padding: "0.55rem 1rem", width: "auto", fontSize: "0.85rem", display: "inline-block", textDecoration: "none", textAlign: "center" as const }}>
                    View
                  </a>
                  {!r.signature && (
                    <a href={`/writeup/edit?id=${r.id}`} style={{ ...btnStyle("transparent"), color: C.navy, border: `1px solid ${C.navy}`, padding: "0.55rem 1rem", width: "auto", fontSize: "0.85rem", display: "inline-block", textDecoration: "none", textAlign: "center" as const }}>
                      Edit
                    </a>
                  )}
                  {!r.signature && (
                    <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/writeup/respond?id=${r.id}`).then(() => toast("Link copied")); }} style={{ ...btnStyle("transparent"), color: C.navy, border: `1px solid ${C.navy}`, padding: "0.55rem 1rem", width: "auto", fontSize: "0.85rem" }}>
                      Copy Link
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}

        <div style={{ marginTop: "1rem", fontSize: "0.72rem", color: C.muted, textAlign: "center" }}>
          Allied Universal Security Services &nbsp;·&nbsp; Washington University &nbsp;·&nbsp; Keep all completed forms on file for audit purposes.
        </div>
      </div>
    </div>
  );
}

