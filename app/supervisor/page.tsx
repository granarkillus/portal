"use client";

import { useState, useEffect } from "react";
import { getSupabase, safeNext } from "@/lib/supabase";
import { C, btnStyle } from "@/lib/theme";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resetMode, setResetMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  // Other Allied sites send supervisors here with ?next=<page> and come back after login.
  const goNext = () => {
    const next = safeNext(new URLSearchParams(window.location.search).get("next"));
    window.location.href = next || "/supervisor/dashboard";
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("denied")) {
      setError("That account doesn't have supervisor access. Sign in with a supervisor account.");
      return;
    }
    // Already signed in as a supervisor: skip the form.
    const supabase = getSupabase();
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: isSupervisor } = await supabase.rpc("is_supervisor");
      if (isSupervisor === true) goNext();
    });
  }, []);

  const handleLogin = async () => {
    if (!email || !password) return;
    setLoading(true);
    setError("");

    const supabase = getSupabase();
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError("Invalid email or password. Please try again.");
      setLoading(false);
      return;
    }

    const { data: isSupervisor } = await supabase.rpc("is_supervisor");
    if (isSupervisor !== true) {
      await supabase.auth.signOut();
      setError("That account doesn't have supervisor access.");
      setLoading(false);
      return;
    }

    goNext();
  };

  const handleReset = async () => {
    if (!email) { setError("Enter your email address first."); return; }
    setLoading(true);
    setError("");

    const supabase = getSupabase();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/supervisor/reset-password`,
    });

    if (resetError) {
      setError("Failed to send reset email. Please try again.");
      setLoading(false);
      return;
    }

    setResetSent(true);
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: C.softBg, fontFamily: "var(--font-sans)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem 0.75rem 2rem" }}>
      <div style={{ maxWidth: 420, width: "100%", background: C.white, borderRadius: 16, boxShadow: "0 10px 30px rgba(15,23,42,0.08), 0 1px 3px rgba(15,23,42,0.06)", overflow: "hidden" }}>

        <div style={{ background: "linear-gradient(135deg, #0f2d57 0%, #1d4f91 100%)", padding: "1.25rem 1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ color: C.white, fontSize: "0.95rem", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Allied<span style={{ fontWeight: 300 }}>Universal</span><sup style={{ fontSize: "0.5rem", fontWeight: 300, marginLeft: 1 }}>™</sup>
            </div>
            <a href="/forms" style={{ color: "rgba(255,255,255,0.85)", fontSize: "0.85rem", textDecoration: "none", fontWeight: 600 }}>Officer forms ›</a>
          </div>
          <div style={{ color: C.white, fontSize: "1.45rem", fontWeight: 700, marginTop: "0.6rem", lineHeight: 1.2 }}>{resetMode ? "Reset your password" : "Supervisor sign in"}</div>
          <div style={{ color: "rgba(255,255,255,0.8)", fontSize: "0.92rem", marginTop: 4 }}>Allied Universal · Washington University</div>
        </div>

        <div style={{ padding: "1.75rem 1.25rem" }}>
          {resetSent ? (
            <div style={{ textAlign: "center" }}>
              <div style={{ width: 52, height: 52, borderRadius: "50%", background: C.greenTint, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem" }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2f6b3a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div style={{ fontWeight: 700, color: C.text, marginBottom: 8 }}>Reset email sent</div>
              <div style={{ fontSize: "0.82rem", color: C.muted, marginBottom: "1.5rem" }}>Check your inbox for a password reset link.</div>
              <button onClick={() => { setResetMode(false); setResetSent(false); }} style={btnStyle(C.navy)}>Back to Login</button>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: "1rem" }}>
                <Label>Email Address</Label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  onKeyDown={(e) => e.key === "Enter" && !resetMode && handleLogin()}
                  style={inputStyle}
                />
              </div>

              {!resetMode && (
                <div style={{ marginBottom: "1rem" }}>
                  <Label>Password</Label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                    style={inputStyle}
                  />
                </div>
              )}

              {error && (
                <div style={{ background: C.redTint, border: "1px solid #fca5a5", borderRadius: 12, padding: "0.65rem 1rem", fontSize: "0.82rem", color: C.red, marginBottom: "1rem" }}>
                  {error}
                </div>
              )}

              <button
                onClick={resetMode ? handleReset : handleLogin}
                disabled={loading}
                style={{ ...btnStyle(loading ? C.faint : C.navy), cursor: loading ? "not-allowed" : "pointer", marginBottom: "0.75rem" }}
              >
                {loading ? "Please wait..." : resetMode ? "Send Reset Email" : "Sign In"}
              </button>

              <button
                onClick={() => { setResetMode(!resetMode); setError(""); }}
                style={{ background: "none", border: "none", color: C.muted, fontSize: "0.78rem", cursor: "pointer", width: "100%", textAlign: "center", fontFamily: "inherit", textDecoration: "underline" }}
              >
                {resetMode ? "Back to login" : "Forgot password?"}
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
    <div style={{ fontSize: "0.92rem", fontWeight: 600, color: C.slate, marginBottom: 6 }}>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", padding: "0.6rem 0.75rem",
  border: "1px solid #d1d5db", borderRadius: 12, fontSize: "1rem",
  color: C.text, background: C.white, outline: "none", fontFamily: "inherit",
};

