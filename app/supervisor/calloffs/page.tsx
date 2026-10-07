"use client";

import { useState, useEffect } from "react";
import { getSupabase, requireSupervisor } from "@/lib/supabase";
import SupervisorHeader, { StatStrip } from "@/components/supervisor-header";
import { C } from "@/lib/theme";
import { fmtDate, fmtTime, fmtStamp } from "@/lib/format";
import { Skeleton, toast } from "@/components/feedback";

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
  // Read ?filter= after mount so the highlighted chip matches the list.
  useEffect(() => {
    const f = new URLSearchParams(window.location.search).get("filter");
    if (f) setFilter(f);
  }, []);
  const [moreFilters, setMoreFilters] = useState(false);
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
      toast(status === "pending" ? "Moved back to review" : `Marked ${status}`);
    } else {
      toast("Couldn't save. Check your connection and try again.");
    }
    setUpdating(null);
  };



  const excusalBadge = (status: string) => {
    const s = status || "pending";
    const styles: Record<string, { bg: string; color: string; border: string; label: string }> = {
      pending: { bg: C.amberTint, color: C.amber, border: C.amberLine, label: "To review" },
      excused: { bg: C.greenTint, color: C.green, border: C.greenLine, label: "Excused" },
      unexcused: { bg: C.redTint, color: C.red, border: C.redLine, label: "Unexcused" },
    };
    const style = styles[s] || styles.pending;
    return (
      <span style={{ fontSize: "0.78rem", fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: style.bg, color: style.color, border: `1px solid ${style.border}`, letterSpacing: "0.04em" }}>
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
      (filter === "unexcused" && r.excusal_status === "unexcused") ||
      (filter === "week" && new Date(r.submitted_at).getTime() >= Date.now() - 7 * 86400000);
    return matchesSearch && matchesFilter;
  });

  const less4 = records.filter((r) => r.notice_type?.includes("Less than")).length;
  const withDocs = records.filter((r) => !!r.document_url).length;
  const pendingReview = records.filter((r) => !r.excusal_status || r.excusal_status === "pending").length;
  const unexcused = records.filter((r) => r.excusal_status === "unexcused").length;

  return (
    <div style={{ minHeight: "100vh", background: C.softBg, fontFamily: "var(--font-sans)", padding: "1rem 0.75rem 2rem" }}>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>

        <SupervisorHeader title="Call-offs" active="calloffs" />

        <StatStrip items={[["To review", pendingReview, "#8a5a00"], ["Unexcused", unexcused, "#a61b1b"], ["Under 4 hr notice", less4], ["Total", records.length]]} />

        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderTop: "none", padding: "1rem 1.25rem", display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by officer, post, or reason..."
            style={{ flex: 1, minWidth: 200, padding: "0.45rem 0.75rem", border: `1px solid ${C.border}`, borderRadius: 12, fontSize: "0.85rem", color: C.text, background: C.white, outline: "none", fontFamily: "inherit" }} />
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {([["all","All"],["pending","To review"],["week","This week"]] as string[][]).concat(moreFilters || ["excused","unexcused","4plus","less4","docs"].includes(filter) ? [["excused","Excused"],["unexcused","Unexcused"],["4plus","4+ hr notice"],["less4","Under 4 hr"],["docs","With documents"]] : []).map(([val, label]) => (
              <button key={val} onClick={() => setFilter(val)} style={{ padding: "0.45rem 0.95rem", borderRadius: 999, fontSize: "0.85rem", fontWeight: 700, border: `1px solid ${filter === val ? C.navy : C.border}`, background: filter === val ? C.navy : C.white, color: filter === val ? C.white : C.muted, cursor: "pointer", fontFamily: "inherit" }}>
                {label}
              </button>
            ))}
            {!moreFilters && !["excused","unexcused","4plus","less4","docs"].includes(filter) && (
              <button type="button" onClick={() => setMoreFilters(true)} style={{ padding: "0.45rem 0.95rem", borderRadius: 999, fontSize: "0.85rem", fontWeight: 700, border: `1px dashed ${C.border}`, background: C.white, color: C.navy, cursor: "pointer", fontFamily: "inherit" }}>More filters</button>
            )}
          </div>
        </div>

        {loading ? (
          <div style={{ background: C.white, border: `1px solid ${C.border}`, borderTop: "none", borderRadius: "0 0 16px 16px", overflow: "hidden" }}><Skeleton rows={5} card={false} /></div>
        ) : filtered.length === 0 ? (
          <div style={{ background: C.white, border: `1px solid ${C.border}`, borderTop: "none", padding: "2rem", textAlign: "center", color: C.muted, fontSize: "0.85rem" }}>No call-off records found.</div>
        ) : (
          filtered.map((r) => {
            const isLess4 = r.notice_type?.includes("Less than");
            const isExpanded = expanded === r.id;
            const excusalStatus = r.excusal_status || "pending";

            return (
              <div key={r.id} style={{ background: C.white, border: `1px solid ${C.border}`, borderTop: "none" }}>
                <div onClick={() => setExpanded(isExpanded ? null : r.id)} style={{ padding: "1rem 1.25rem", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap", cursor: "pointer" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: 4, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 700, fontSize: "0.92rem", color: C.text }}>{r.officer_name}</span>
                      {excusalBadge(excusalStatus)}
                      <span style={{ fontSize: "0.78rem", fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: isLess4 ? C.redTint : C.greenTint, color: isLess4 ? C.red : C.green, border: `1px solid ${isLess4 ? C.redLine : C.greenLine}`, letterSpacing: "0.04em" }}>
                        {isLess4 ? "Under 4 hr notice" : "4+ hr notice"}
                      </span>
                      {r.document_url && <span style={{ fontSize: "0.78rem", fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: C.navyTint, color: C.navy, border: `1px solid #c3d4e8` }}>Document attached</span>}
                    </div>
                    <div style={{ fontSize: "0.78rem", color: C.muted }}>{r.post} &nbsp;·&nbsp; {fmtDate(r.shift_date)}{r.shift_start && ` · ${fmtTime(r.shift_start)}`}{r.shift_end && `–${fmtTime(r.shift_end)}`} &nbsp;·&nbsp; {r.reason}</div>
                    <div style={{ fontSize: "0.72rem", color: C.muted, marginTop: 2 }}>Submitted {fmtStamp(r.submitted_at)}</div>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                    style={{ transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s", flexShrink: 0 }}>
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>

                {isExpanded && (
                  <div style={{ padding: "0 2rem 1.5rem", borderTop: `1px solid ${C.border}`, background: C.softBg }}>
                    <div style={{ paddingTop: "1rem", marginBottom: "1.25rem" }}>
                      <div style={{ fontSize: "0.92rem", fontWeight: 600, color: C.slate, marginBottom: "0.6rem" }}>Excused or not?</div>
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        {[
                          { val: "excused", label: "Excused", activeColor: C.green, activeBg: C.greenTint, activeBorder: C.greenLine },
                          { val: "unexcused", label: "Unexcused", activeColor: C.red, activeBg: C.redTint, activeBorder: C.redLine },
                          { val: "pending", label: "To review", activeColor: C.amber, activeBg: C.amberTint, activeBorder: C.amberLine },
                        ].map(({ val, label, activeColor, activeBg, activeBorder }) => {
                          const isActive = excusalStatus === val;
                          const isLoadingBtn = updating === r.id + val;
                          return (
                            <button key={val} onClick={(e) => { e.stopPropagation(); updateExcusalStatus(r.id, val); }} disabled={!!updating}
                              style={{ padding: "0.55rem 1rem", borderRadius: 12, fontSize: "0.85rem", fontWeight: 700, border: `1.5px solid ${isActive ? activeBorder : C.border}`, background: isActive ? activeBg : C.white, color: isActive ? activeColor : C.muted, cursor: updating ? "not-allowed" : "pointer", fontFamily: "inherit", transition: "all 0.15s", opacity: isLoadingBtn ? 0.6 : 1 }}>
                              {isLoadingBtn ? "..." : (isActive ? `✓ ${label}` : label)}
                            </button>
                          );
                        })}
                      </div>
                      {excusalStatus === "unexcused" && (
                        <div style={{ marginTop: "0.6rem", background: C.redTint, border: "1px solid #fca5a5", borderLeft: "3px solid #b91c1c", borderRadius: 8, padding: "0.5rem 0.75rem", fontSize: "0.75rem", color: C.red, fontWeight: 600 }}>
                          Unexcused absence — disciplinary action may apply per AUS attendance policy.
                        </div>
                      )}
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem 2rem" }}>
                      {[["Officer", r.officer_name],["Employee #", r.employee_number],["Post", r.post],["Shift date", fmtDate(r.shift_date)],["Shift", [fmtTime(r.shift_start), fmtTime(r.shift_end)].filter(Boolean).join("–")],["Notice", r.notice_type],["Reason", r.reason],["Coverage found", r.coverage_found ? "Yes" : "No"],["Covering officer", r.coverage_name],["Signature", r.signature],["Submitted", fmtStamp(r.submitted_at)]].map(([label, val]) => val ? (
                        <div key={label}>
                          <div style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.05em", color: C.muted, marginBottom: 2 }}>{label}</div>
                          <div style={{ fontSize: "0.85rem", color: C.text }}>{val}</div>
                        </div>
                      ) : null)}
                    </div>

                    {r.comments && (
                      <div style={{ marginTop: "0.75rem" }}>
                        <div style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.05em", color: C.muted, marginBottom: 2 }}>Comments</div>
                        <div style={{ fontSize: "0.85rem", color: C.text, background: C.white, border: `1px solid ${C.border}`, borderRadius: 8, padding: "0.5rem 0.75rem" }}>{r.comments}</div>
                      </div>
                    )}

                    {r.document_url && (
                      <div style={{ marginTop: "0.75rem" }}>
                        <a href="#" onClick={(e) => { e.preventDefault(); openDocument(r.document_url); }} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: C.navy, color: C.white, borderRadius: 12, padding: "0.55rem 1rem", fontSize: "0.85rem", fontWeight: 700, textDecoration: "none" }}>
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

        <div style={{ marginTop: "1rem", fontSize: "0.72rem", color: C.muted, textAlign: "center" }}>
          Allied Universal Security Services &nbsp;·&nbsp; Washington University &nbsp;·&nbsp; Keep all completed forms on file for audit purposes.
        </div>
      </div>
    </div>
  );
}
