"use client";

import { useState, useEffect } from "react";
import { getSupabase } from "@/lib/supabase";

const NAVY = "#1a4480";
const SOFT_BG = "#f2f5fa";
const WHITE = "#ffffff";
const MUTED = "#5b6474";
const TEXT = "#0f172a";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const handleReset = async () => {
    if (!password || !confirm) return;
    if (password !== confirm) { setError("Passwords do not match."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }

    setLoading(true);
    setError("");

    const supabase = getSupabase();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError("Failed to update password. Please try again.");
      setLoading(false);
      return;
    }

    setDone(true);
    setLoading(false);
    setTimeout(() => { window.location.href = "/supervisor/dashboard"; }, 2000);
  };

  return (
    <div style={{ minHeight: "100vh", background: SOFT_BG, fontFamily: "var(--font-sans)", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem 1rem" }}>
      <div style={{ maxWidth: 420, width: "100%", background: WHITE, borderRadius: 12, boxShadow: "0 10px 30px rgba(15,23,42,0.08), 0 1px 3px rgba(15,23,42,0.06)", overflow: "hidden" }}>
        <div style={{ background: "linear-gradient(135deg, #0f2d57 0%, #1d4f91 100%)", padding: "1.5rem 2rem" }}>
          <div style={{ color: "#ffffff", fontSize: "1rem", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase" }}>
            Allied<span style={{ fontWeight: 300 }}>Universal</span><sup style={{ fontSize: "0.5rem", fontWeight: 300, marginLeft: 1 }}>™</sup>
          </div>
          <div style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.68rem", marginTop: 2 }}>Security Services</div>
          <div style={{ color: "#ffffff", fontSize: "0.95rem", fontWeight: 700, marginTop: "0.5rem" }}>Set New Password</div>
        </div>

        <div style={{ padding: "1.75rem 2rem" }}>
          {done ? (
            <div style={{ textAlign: "center" }}>
              <div style={{ width: 52, height: 52, borderRadius: "50%", background: "#e8f5e9", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem" }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2f6b3a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div style={{ fontWeight: 700, color: TEXT, marginBottom: 8 }}>Password updated</div>
              <div style={{ fontSize: "0.82rem", color: MUTED }}>Redirecting to dashboard...</div>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: "1rem" }}>
                <Label>New Password</Label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min. 8 characters" style={inputStyle} />
              </div>
              <div style={{ marginBottom: "1rem" }}>
                <Label>Confirm Password</Label>
                <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repeat password" onKeyDown={(e) => e.key === "Enter" && handleReset()} style={inputStyle} />
              </div>
              {error && (
                <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 12, padding: "0.65rem 1rem", fontSize: "0.82rem", color: "#b91c1c", marginBottom: "1rem" }}>
                  {error}
                </div>
              )}
              <button onClick={handleReset} disabled={!password || !confirm || loading} style={{ background: !password || !confirm || loading ? "#9ca3af" : NAVY, color: "#ffffff", border: "none", borderRadius: 12, padding: "0.7rem 1.75rem", fontSize: "0.85rem", fontWeight: 700, letterSpacing: "0.04em", cursor: !password || !confirm || loading ? "not-allowed" : "pointer", fontFamily: "inherit", textTransform: "uppercase", width: "100%" }}>
                {loading ? "Updating..." : "Set Password"}
              </button>
            </>
          )}
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
  width: "100%", boxSizing: "border-box", padding: "0.6rem 0.75rem",
  border: "1px solid #d1d5db", borderRadius: 12, fontSize: "1rem",
  color: "#1a1a2e", background: "#ffffff", outline: "none", fontFamily: "inherit",
};
