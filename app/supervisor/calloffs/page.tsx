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

interface CallOff {
  id: string;
  officer_name: string;
  employee_number: string;
  post: string;
  shift_date: string;
  shift_start: string;
  shift_end: string;
  notice_type: string;
  reason: string;
  coverage_found: boolean;
  coverage_name: string;
  comments: string;
  signature: string;
  document_url: string;
  submitted_at: string;
  excusal_status: string;
}

export default function CallOffRecordsPage() {
  const [records, setRecords] = useState<CallOff[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    requireSupervisor("/supervisor").then((u) => {
      if (!u) return;
      getSupabase()
        .from("calloff_submissions")
        .select("*")
        .order("submitted_at", { ascending: false })
        .then(({ data }) => {
          setRecords(data || []);
          setLoading(false);
        });
    });
  }, []);

  // Documents are in a private bucket. Older rows store a full public URL,
  // newer ones just the file path; either way open a 10-minute signed link.
  const openDocument = async (stored: string) => {
    const path = stored.includes("/calloff-documents/") ? decodeURIComponent(stored.split("/calloff-documents/")[1].split("?")[0]) : stored;
    const win = window.open("", "_blank");
    const { data, error } = await getSupabase().storage.from("calloff-documents").createSignedUrl(path, 600);
    if (error || !data?.signedUrl) {
      win?.close();
      alert("Couldn't open the document. Please try again.");
      return;
    }
    if (win) win.location.href = data.signedUrl;
    else window.location.href = data.signedUrl;
  };

  const updateExcusalStatus = async (id: string, status: string) => {
    setUpdating(id + status);
    const supabase = getSupabase();
    const { error } = await supabase
      .from("calloff_submissions")
      .update({ excusal_status: status })
      .eq("id", id);
    if (!error) {
      setRecords((prev) => prev.map((r) => r.id === id ? { ...r, excusal_status: status } : r));
    }
    setUpdating(null);
  };

  const formatDate = (iso: string) => {
    if (!iso) return "";
    const d = iso.split("T")[0];
    const [y, m, day] = d.split("-");
    return `${m}/${day}/${y}`;
  };

  const formatDateTime = (iso: string) => {
    if (!iso) return "";
    return new Date(iso).toLocaleString("en-US", {
      month: "numeric", day: "numeric", year: "numeric",
      hour: "numeric", minute: "2-digit", hour12: true,
    });
  };

  const excusalBadge = (status: string) => {
    const s = status || "pending";
    const styles: Record<string, { bg: string; color: string; border: string; label: string }> = {
      pending: { bg: "#fff3cd", color: "#92400e", border: "#fcd34d", label: "Pending Review" },
      excused: { bg: "#e8f5e9", color: GREEN, border: "#a5d6a7", label: "Excused" },
      unexcused: { bg: "#fef2f2", color: "#b91c1c", border: "#fca5a5", label: "Unexcused" },
    };
    const style = styles[s] || styles.pending;
    return (
      <span style={{ fontSize: "0.78rem", fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: style.bg, color: style.color, border: `1px solid ${style.border}`, textTransform: "capitalize" as const, letterSpacing: "0.04em" }}>
        {style.label}
      </span>
    );
  };

  const filtered = records.filter((r) => {
    const matchesSearch = !search ||
      r.officer_name?.toLowerCase().includes(search.toLowerCase()) ||
      r.post?.toLowerCase().includes(search.toLowerCase()) ||
      r.reason?.toLowerCase().includes(search.toLowerCase());
    const matchesFilter =
      filter === "all" ||
      (filter === "less4" && r.notice_type?.includes("Less than")) ||
      (filter === "4plus" && r.notice_type?.includes("4+")) ||
      (filter === "docs" && !!r.document_url) ||
      (filter === "pending" && (!r.excusal_status || r.excusal_status === "pending")) ||
      (filter === "excused" && r.excusal_status === "excused") ||
      (filter === "unexcused" && r.excusal_status === "unexcused");
    return matchesSearch && matchesFilter;
  });

  const less4 = records.filter((r) => r.notice_type?.includes("Less than")).length;
  const withDocs = records.filter((r) => !!r.document_url).length;
  const pendingReview = records.filter((r) => !r.excusal_status || r.excusal_status === "pending").length;
  const unexcused = records.filter((r) => r.excusal_status === "unexcused").length;

  return (
    <div style={{ minHeight: "100vh", background: SOFT_BG, fontFamily: "var(--font-sans)", padding: "1rem 0.75rem 2rem" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>

        <SupervisorHeader title="Call-offs" active="calloffs" />

        <StatStrip items={[["Total", records.length], ["Pending review", pendingReview, "#8a5a00"], ["Unexcused", unexcused, "#a61b1b"], ["Under 4 hr notice", less4], ["With documents", withDocs]]} />

        <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderTop: "none", padding: "1rem 1.25rem", display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by officer, post, or reason..."
            style={{ flex: 1, minWidth: 200, padding: "0.45rem 0.75rem", border: `1px solid ${BORDER}`, borderRadius: 12, fontSize: "0.85rem", color: TEXT, background: "#ffffff", outline: "none", fontFamily: "inherit" }} />
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {[["all","All"],["pending","Pending"],["excused","Excused"],["unexcused","Unexcused"],["4plus","4+ hr"],["less4","< 4hr"],["docs","With Docs"]].map(([val, label]) => (
              <button key={val} onClick={() => setFilter(val)} style={{ padding: "0.4rem 0.9rem", borderRadius: 12, fontSize: "0.78rem", fontWeight: 700, border: `1px solid ${filter === val ? NAVY : BORDER}`, background: filter === val ? NAVY : WHITE, color: filter === val ? WHITE : MUTED, cursor: "pointer", fontFamily: "inherit" }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderTop: "none", padding: "2rem", textAlign: "center", color: MUTED, fontSize: "0.85rem" }}>Loading records...</div>
        ) : filtered.length === 0 ? (
          <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderTop: "none", padding: "2rem", textAlign: "center", color: MUTED, fontSize: "0.85rem" }}>No call-off records found.</div>
        ) : (
          filtered.map((r) => {
            const isLess4 = r.notice_type?.includes("Less than");
            const isExpanded = expanded === r.id;
            const excusalStatus = r.excusal_status || "pending";

            return (
              <div key={r.id} style={{ background: WHITE, border: `1px solid ${BORDER}`, borderTop: "none" }}>
                <div onClick={() => setExpanded(isExpanded ? null : r.id)} style={{ padding: "1rem 1.25rem", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap", cursor: "pointer" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: 4, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 700, fontSize: "0.92rem", color: TEXT }}>{r.officer_name}</span>
                      {excusalBadge(excusalStatus)}
                      <span style={{ fontSize: "0.78rem", fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: isLess4 ? "#fef2f2" : "#e8f5e9", color: isLess4 ? "#b91c1c" : GREEN, border: `1px solid ${isLess4 ? "#fca5a5" : "#a5d6a7"}`, textTransform: "capitalize" as const, letterSpacing: "0.04em" }}>
                        {isLess4 ? "< 4hr Notice" : "4+ hr Notice"}
                      </span>
                      {r.document_url && <span style={{ fontSize: "0.78rem", fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: "#eaf1fb", color: NAVY, border: `1px solid #c3d4e8`, textTransform: "capitalize" as const }}>Doc Attached</span>}
                    </div>
                    <div style={{ fontSize: "0.78rem", color: MUTED }}>{r.post} &nbsp;·&nbsp; {formatDate(r.shift_date)}{r.shift_start && ` @ ${r.shift_start}`}{r.shift_end && ` – ${r.shift_end}`} &nbsp;·&nbsp; {r.reason}</div>
                    <div style={{ fontSize: "0.72rem", color: MUTED, marginTop: 2 }}>Submitted: {formatDateTime(r.submitted_at)}</div>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                    style={{ transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s", flexShrink: 0 }}>
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>

                {isExpanded && (
                  <div style={{ padding: "0 2rem 1.5rem", borderTop: `1px solid ${BORDER}`, background: SOFT_BG }}>
                    <div style={{ paddingTop: "1rem", marginBottom: "1.25rem" }}>
                      <div style={{ fontSize: "0.92rem", fontWeight: 600, color: "#334155", marginBottom: "0.6rem" }}>Excusal Classification</div>
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        {[
                          { val: "excused", label: "Excused", activeColor: GREEN, activeBg: "#e8f5e9", activeBorder: "#a5d6a7" },
                          { val: "unexcused", label: "Unexcused", activeColor: "#b91c1c", activeBg: "#fef2f2", activeBorder: "#fca5a5" },
                          { val: "pending", label: "Pending Review", activeColor: "#92400e", activeBg: "#fff3cd", activeBorder: "#fcd34d" },
                        ].map(({ val, label, activeColor, activeBg, activeBorder }) => {
                          const isActive = excusalStatus === val;
                          const isLoadingBtn = updating === r.id + val;
                          return (
                            <button key={val} onClick={(e) => { e.stopPropagation(); updateExcusalStatus(r.id, val); }} disabled={!!updating}
                              style={{ padding: "0.45rem 1rem", borderRadius: 12, fontSize: "0.78rem", fontWeight: 700, border: `1.5px solid ${isActive ? activeBorder : BORDER}`, background: isActive ? activeBg : WHITE, color: isActive ? activeColor : MUTED, cursor: updating ? "not-allowed" : "pointer", fontFamily: "inherit", transition: "all 0.15s", opacity: isLoadingBtn ? 0.6 : 1 }}>
                              {isLoadingBtn ? "..." : (isActive ? `✓ ${label}` : label)}
                            </button>
                          );
                        })}
                      </div>
                      {excusalStatus === "unexcused" && (
                        <div style={{ marginTop: "0.6rem", background: "#fef2f2", border: "1px solid #fca5a5", borderLeft: "3px solid #b91c1c", borderRadius: 8, padding: "0.5rem 0.75rem", fontSize: "0.75rem", color: "#b91c1c", fontWeight: 600 }}>
                          Unexcused absence — disciplinary action may apply per AUS attendance policy.
                        </div>
                      )}
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem 2rem" }}>
                      {[["Officer", r.officer_name],["Employee #", r.employee_number],["Post", r.post],["Shift Date", formatDate(r.shift_date)],["Shift Start", r.shift_start],["Shift End", r.shift_end],["Notice Type", r.notice_type],["Reason", r.reason],["Coverage Found", r.coverage_found ? "Yes" : "No"],["Coverage Officer", r.coverage_name],["Signature", r.signature],["Submitted", formatDateTime(r.submitted_at)]].map(([label, val]) => val ? (
                        <div key={label}>
                          <div style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.05em", color: MUTED, marginBottom: 2 }}>{label}</div>
                          <div style={{ fontSize: "0.85rem", color: TEXT }}>{val}</div>
                        </div>
                      ) : null)}
                    </div>

                    {r.comments && (
                      <div style={{ marginTop: "0.75rem" }}>
                        <div style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.05em", color: MUTED, marginBottom: 2 }}>Comments</div>
                        <div style={{ fontSize: "0.85rem", color: TEXT, background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "0.5rem 0.75rem" }}>{r.comments}</div>
                      </div>
                    )}

                    {r.document_url && (
                      <div style={{ marginTop: "0.75rem" }}>
                        <a href="#" onClick={(e) => { e.preventDefault(); openDocument(r.document_url); }} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: NAVY, color: WHITE, borderRadius: 12, padding: "0.45rem 1rem", fontSize: "0.78rem", fontWeight: 700, textDecoration: "none" }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                          View Documentation
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}

        <div style={{ marginTop: "1rem", fontSize: "0.72rem", color: MUTED, textAlign: "center" }}>
          Allied Universal Security Services &nbsp;·&nbsp; Washington University &nbsp;·&nbsp; Keep all completed forms on file for audit purposes.
        </div>
      </div>
    </div>
  );
}
