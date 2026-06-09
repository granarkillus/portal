"use client";

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const getSupabase = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

const NAVY = "#1f4e79";
const DARK = "#1a1a2e";
const SOFT_BG = "#f4f6f9";
const WHITE = "#ffffff";
const MUTED = "#6b7280";
const BORDER = "#d1d5db";
const TEXT = "#1a1a2e";
const GREEN = "#2f6b3a";

interface Profile {
  full_name: string;
  employee_number: string;
  post: string;
}

interface TimeOffRequest {
  id: string;
  absence_type: string;
  dates_requested: string;
  status: string;
  submitted_at: string;
}

interface CallOff {
  id: string;
  shift_date: string;
  notice_type: string;
  reason: string;
  submitted_at: string;
}

interface DARSubmission {
  id: string;
  date: string;
  shift_start: string;
  submitted_at: string;
}

interface DisciplinaryRecord {
  id: string;
  infraction: string;
  action_type: string;
  notice_date: string;
  signature: string | null;
}

export default function OfficerDashboard() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState("");
  const [timeOff, setTimeOff] = useState<TimeOffRequest[]>([]);
  const [callOffs, setCallOffs] = useState<CallOff[]>([]);
  const [dars, setDars] = useState<DARSubmission[]>([]);
  const [disciplinary, setDisciplinary] = useState<DisciplinaryRecord[]>([]);
  const [pendingAck, setPendingAck] = useState<DisciplinaryRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const formatDate = (iso: string) => {
    if (!iso) return "";
    const d = iso.split("T")[0];
    const [y, m, day] = d.split("-");
    return `${m}/${day}/${y}`;
  };

  useEffect(() => {
    const supabase = getSupabase();

    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { window.location.href = "/"; return; }
      setEmail(data.user.email || "");

      const { data: profileData } = await supabase
        .from("officer_profiles")
        .select("*")
        .eq("id", data.user.id)
        .single();

      if (profileData) setProfile(profileData);

      const name = profileData?.full_name || "";

      if (name) {
        const [toData, coData, darData, discData] = await Promise.all([
          supabase.from("time_off_requests").select("id, absence_type, dates_requested, status, submitted_at").ilike("officer_name", name).order("submitted_at", { ascending: false }).limit(5),
          supabase.from("calloff_submissions").select("id, shift_date, notice_type, reason, submitted_at").ilike("officer_name", name).order("submitted_at", { ascending: false }).limit(5),
          supabase.from("dar_submissions").select("id, date, shift_start, submitted_at").ilike("officer_name", name).order("submitted_at", { ascending: false }).limit(5),
          supabase.from("disciplinary_records").select("id, infraction, action_type, notice_date, signature").ilike("officer_name", name).order("submitted_at", { ascending: false }).limit(10),
        ]);

        setTimeOff(toData.data || []);
        setCallOffs(coData.data || []);
        setDars(darData.data || []);
        setDisciplinary(discData.data || []);
        setPendingAck((discData.data || []).filter((r: DisciplinaryRecord) => !r.signature));
      }

      setLoading(false);
    });
  }, []);

  const handleSignOut = async () => {
    const supabase = getSupabase();
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  const encodedName = encodeURIComponent(profile?.full_name || "");
  const encodedEmpNum = encodeURIComponent(profile?.employee_number || "");

  const formLinks = [
    { label: "Submit Daily Activity Report", href: `https://dar.xing.wtf`, icon: "📋" },
    { label: "Request Time Off", href: `https://timeoffrequest.xing.wtf`, icon: "📅" },
    { label: "Submit Call-Off Notice", href: `https://calloff.xing.wtf`, icon: "📞" },
  ];

  const statusBadge = (status: string) => {
    const map: Record<string, { bg: string; color: string; border: string }> = {
      pending: { bg: "#fff3cd", color: "#92400e", border: "#fcd34d" },
      approved: { bg: "#e8f5e9", color: GREEN, border: "#a5d6a7" },
      rejected: { bg: "#fef2f2", color: "#b91c1c", border: "#fca5a5" },
    };
    const s = map[status] || map.pending;
    return <span style={{ fontSize: "0.65rem", fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: s.bg, color: s.color, border: `1px solid ${s.border}`, textTransform: "uppercase", letterSpacing: "0.04em" }}>{status}</span>;
  };

  return (
    <div style={{ minHeight: "100vh", background: SOFT_BG, fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>

      {/* Nav */}
      <div style={{ background: NAVY, padding: "0.75rem 2rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <div style={{ color: WHITE, fontSize: "0.95rem", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase" }}>
            Allied<span style={{ fontWeight: 300 }}>Universal</span><sup style={{ fontSize: "0.5rem", fontWeight: 300, marginLeft: 1 }}>™</sup>
          </div>
          <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.75rem" }}>Officer Portal · Washington University</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <div style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.78rem" }}>{profile?.full_name || email}</div>
          <button onClick={handleSignOut} style={{ background: "none", border: "1px solid rgba(255,255,255,0.3)", color: WHITE, borderRadius: 4, padding: "0.3rem 0.75rem", fontSize: "0.75rem", cursor: "pointer", fontFamily: "inherit" }}>
            Sign Out
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "2rem 1rem" }}>

        {/* Pending acknowledgement alert */}
        {pendingAck.length > 0 && (
          <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderLeft: "4px solid #b91c1c", borderRadius: 4, padding: "1rem 1.5rem", marginBottom: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem" }}>
            <div>
              <div style={{ fontWeight: 700, color: "#b91c1c", fontSize: "0.92rem", marginBottom: 4 }}>
                ⚠ Action Required — {pendingAck.length} Pending Disciplinary Acknowledgement{pendingAck.length > 1 ? "s" : ""}
              </div>
              <div style={{ fontSize: "0.78rem", color: "#7f1d1d" }}>
                You have disciplinary notices that require your acknowledgement. Please review and respond.
              </div>
            </div>
            <a
              href={`https://disciplinaryformresponse.xing.wtf/respond?id=${pendingAck[0].id}`}
              style={{ background: "#b91c1c", color: WHITE, borderRadius: 4, padding: "0.5rem 1.25rem", fontSize: "0.82rem", fontWeight: 700, textDecoration: "none", textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap" }}
            >
              Review Now
            </a>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>

          {/* Quick form links */}
          <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: "hidden" }}>
            <div style={{ background: DARK, padding: "0.6rem 1.5rem" }}>
              <span style={{ color: WHITE, fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Submit a Form</span>
            </div>
            <div style={{ padding: "1rem 1.5rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {formLinks.map((link) => (
                <a key={link.label} href={link.href} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.75rem 1rem", background: SOFT_BG, border: `1px solid ${BORDER}`, borderRadius: 4, textDecoration: "none", fontSize: "0.88rem", fontWeight: 600, color: NAVY }}>
                  <span style={{ fontSize: "1.1rem" }}>{link.icon}</span>
                  {link.label}
                  <svg style={{ marginLeft: "auto" }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                </a>
              ))}
            </div>
          </div>

          {/* Profile */}
          <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: "hidden" }}>
            <div style={{ background: DARK, padding: "0.6rem 1.5rem" }}>
              <span style={{ color: WHITE, fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>My Profile</span>
            </div>
            <div style={{ padding: "1.25rem 1.5rem" }}>
              {loading ? (
                <div style={{ color: MUTED, fontSize: "0.82rem" }}>Loading...</div>
              ) : (
                <>
                  {[
                    ["Name", profile?.full_name],
                    ["Employee #", profile?.employee_number],
                    ["Post", profile?.post],
                    ["Email", email],
                  ].map(([label, val]) => val ? (
                    <div key={label} style={{ marginBottom: "0.65rem" }}>
                      <div style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: MUTED, marginBottom: 2 }}>{label}</div>
                      <div style={{ fontSize: "0.88rem", color: TEXT, fontWeight: label === "Name" ? 700 : 400 }}>{val}</div>
                    </div>
                  ) : null)}
                </>
              )}
            </div>
          </div>

          {/* Time-off requests */}
          <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: "hidden" }}>
            <div style={{ background: DARK, padding: "0.6rem 1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: WHITE, fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Time-Off Requests</span>
              <a href="https://timeoffrequest.xing.wtf" style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.68rem", textDecoration: "none" }}>+ New</a>
            </div>
            <div>
              {loading ? (
                <div style={{ padding: "1rem 1.5rem", color: MUTED, fontSize: "0.82rem" }}>Loading...</div>
              ) : timeOff.length === 0 ? (
                <div style={{ padding: "1rem 1.5rem", color: MUTED, fontSize: "0.82rem", fontStyle: "italic" }}>No requests submitted yet.</div>
              ) : (
                timeOff.map((r, i) => (
                  <div key={r.id} style={{ padding: "0.75rem 1.5rem", borderBottom: i < timeOff.length - 1 ? `1px solid ${BORDER}` : "none", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: "0.85rem", fontWeight: 600, color: TEXT, marginBottom: 2 }}>{r.absence_type}</div>
                      <div style={{ fontSize: "0.72rem", color: MUTED }}>{r.dates_requested}</div>
                    </div>
                    {statusBadge(r.status)}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Call-offs */}
          <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: "hidden" }}>
            <div style={{ background: DARK, padding: "0.6rem 1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: WHITE, fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Call-Off History</span>
              <a href="https://calloff.xing.wtf" style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.68rem", textDecoration: "none" }}>+ New</a>
            </div>
            <div>
              {loading ? (
                <div style={{ padding: "1rem 1.5rem", color: MUTED, fontSize: "0.82rem" }}>Loading...</div>
              ) : callOffs.length === 0 ? (
                <div style={{ padding: "1rem 1.5rem", color: MUTED, fontSize: "0.82rem", fontStyle: "italic" }}>No call-offs on record.</div>
              ) : (
                callOffs.map((r, i) => (
                  <div key={r.id} style={{ padding: "0.75rem 1.5rem", borderBottom: i < callOffs.length - 1 ? `1px solid ${BORDER}` : "none" }}>
                    <div style={{ fontSize: "0.85rem", fontWeight: 600, color: TEXT, marginBottom: 2 }}>{formatDate(r.shift_date)} — {r.reason}</div>
                    <div style={{ fontSize: "0.72rem", color: MUTED }}>{r.notice_type}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* DARs */}
          <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: "hidden" }}>
            <div style={{ background: DARK, padding: "0.6rem 1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: WHITE, fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Recent DARs</span>
              <a href="https://dar.xing.wtf" style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.68rem", textDecoration: "none" }}>+ New</a>
            </div>
            <div>
              {loading ? (
                <div style={{ padding: "1rem 1.5rem", color: MUTED, fontSize: "0.82rem" }}>Loading...</div>
              ) : dars.length === 0 ? (
                <div style={{ padding: "1rem 1.5rem", color: MUTED, fontSize: "0.82rem", fontStyle: "italic" }}>No DARs submitted yet.</div>
              ) : (
                dars.map((r, i) => (
                  <div key={r.id} style={{ padding: "0.75rem 1.5rem", borderBottom: i < dars.length - 1 ? `1px solid ${BORDER}` : "none" }}>
                    <div style={{ fontSize: "0.85rem", fontWeight: 600, color: TEXT, marginBottom: 2 }}>{formatDate(r.date)}</div>
                    <div style={{ fontSize: "0.72rem", color: MUTED }}>Shift start: {r.shift_start}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Disciplinary */}
          <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 4, overflow: "hidden" }}>
            <div style={{ background: DARK, padding: "0.6rem 1.5rem" }}>
              <span style={{ color: WHITE, fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Disciplinary Notices</span>
            </div>
            <div>
              {loading ? (
                <div style={{ padding: "1rem 1.5rem", color: MUTED, fontSize: "0.82rem" }}>Loading...</div>
              ) : disciplinary.length === 0 ? (
                <div style={{ padding: "1rem 1.5rem", color: MUTED, fontSize: "0.82rem", fontStyle: "italic" }}>No disciplinary notices on record.</div>
              ) : (
                disciplinary.map((r, i) => (
                  <div key={r.id} style={{ padding: "0.75rem 1.5rem", borderBottom: i < disciplinary.length - 1 ? `1px solid ${BORDER}` : "none", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: "0.85rem", fontWeight: 600, color: TEXT, marginBottom: 2 }}>{r.infraction || r.action_type || "Notice"}</div>
                      <div style={{ fontSize: "0.72rem", color: MUTED }}>{formatDate(r.notice_date)}</div>
                    </div>
                    {r.signature ? (
                      <span style={{ fontSize: "0.65rem", fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: "#e8f5e9", color: GREEN, border: "1px solid #a5d6a7", textTransform: "uppercase" }}>Acknowledged</span>
                    ) : (
                      <a href={`https://disciplinaryformresponse.xing.wtf/respond?id=${r.id}`} style={{ fontSize: "0.65rem", fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: "#fef2f2", color: "#b91c1c", border: "1px solid #fca5a5", textTransform: "uppercase", textDecoration: "none" }}>
                        Respond
                      </a>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
