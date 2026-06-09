"use client";

import { useState } from "react";
import { createClient } from "@supabase/supabase-js";

const getSupabase = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

const NAVY = "#1f4e79";
const SOFT_BG = "#f4f6f9";
const WHITE = "#ffffff";
const MUTED = "#6b7280";
const BORDER = "#d1d5db";
const TEXT = "#1a1a2e";

export default function OfficerLoginPage() {
  const [mode, setMode] = useState<"login" | "register" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [employeeNumber, setEmployeeNumber] = useState("");
  const [post, setPost] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resetSent, setResetSent] = useState(false);

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

    window.location.href = "/dashboard";
  };

  const handleRegister = async () => {
    if (!email || !password || !fullName) return;
    setLoading(true);
    setError("");

    const supabase = getSupabase();
    const { data, error: signUpError } = await supabase.auth.signUp({ email, password });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      await supabase.from("officer_profiles").insert([{
        id: data.user.id,
        full_name: fullName,
        employee_number: employeeNumber || null,
        post: post || null,
      }]);
    }

    window.location.href = "/dashboard";
  };

  const handleReset = async () => {
    if (!email) { setError("Enter your email address first."); return; }
    setLoading(true);
    setError("");

    const supabase = getSupabase();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
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
    <div style={{ minHeight: "100vh", background: SOFT_BG, fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem 1rem" }}>
      <div style={{ maxWidth: 420, width: "100%", background: WHITE, borderRadius: 4, boxShadow: "0 2px 16px rgba(31,78,121,0.12)", overflow: "hidden" }}>

        <div style={{ background: NAVY, padding: "1.5rem 2rem" }}>
          <div style={{ color: WHITE, fontSize: "1rem", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase" }}>
            Allied<span style={{ fontWeight: 300 }}>Universal</span><sup style={{ fontSize: "0.5rem", fontWeight: 300, marginLeft: 1 }}>™</sup>
          </div>
          <div style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.68rem", marginTop: 2 }}>Security Services · Washington University</div>
          <div style={{ color: WHITE, fontSize: "0.95rem", fontWeight: 700, marginTop: "0.5rem" }}>
            {mode === "login" ? "Officer Portal" : mode === "register" ? "Create Account" : "Reset Password"}
          </div>
        </div>

        <div style={{ padding: "1.75rem 2rem" }}>

          {resetSent ? (
            <div style={{ textAlign: "center" }}>
              <div style={{ width: 52, height: 52, borderRadius: "50%", background: "#e8f5e9", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem" }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2f6b3a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              </div>
              <div style={{ fontWeight: 700, color: TEXT, marginBottom: 8 }}>Reset email sent</div>
              <div style={{ fontSize: "0.82rem", color: MUTED, marginBottom: "1.5rem" }}>Check your inbox for a password reset link.</div>
              <button onClick={() => { setMode("login"); setResetSent(false); }} style={btnStyle(NAVY)}>Back to Login</button>
            </div>
          ) : (
            <>
              {mode === "register" && (
                <>
                  <Field label="Full Name" value={fullName} onChange={setFullName} placeholder="Your full legal name" required />
                  <Field label="Employee Number (optional)" value={employeeNumber} onChange={setEmployeeNumber} placeholder="e.g. 12345" />
                  <Field label="Assigned Post (optional)" value={post} onChange={setPost} placeholder="e.g. Greenway Walk" />
                </>
              )}

              <Field label="Email Address" value={email} onChange={setEmail} placeholder="your@email.com" type="email" required />

              {mode !== "forgot" && (
                <Field label="Password" value={password} onChange={setPassword} placeholder={mode === "register" ? "Min. 8 characters" : "Enter your password"} type="password" required />
              )}

              {error && (
                <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 4, padding: "0.65rem 1rem", fontSize: "0.82rem", color: "#b91c1c", marginBottom: "1rem" }}>
                  {error}
                </div>
              )}

              <button
                onClick={mode === "login" ? handleLogin : mode === "register" ? handleRegister : handleReset}
                disabled={loading}
                style={{ ...btnStyle(loading ? "#9ca3af" : NAVY), cursor: loading ? "not-allowed" : "pointer", marginBottom: "1rem" }}
              >
                {loading ? "Please wait..." : mode === "login" ? "Sign In" : mode === "register" ? "Create Account" : "Send Reset Email"}
              </button>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", alignItems: "center" }}>
                {mode === "login" && (
                  <>
                    <button onClick={() => { setMode("register"); setError(""); }} style={linkStyle}>
                      Don't have an account? Register
                    </button>
                    <button onClick={() => { setMode("forgot"); setError(""); }} style={linkStyle}>
                      Forgot password?
                    </button>
                  </>
                )}
                {mode === "register" && (
                  <button onClick={() => { setMode("login"); setError(""); }} style={linkStyle}>
                    Already have an account? Sign in
                  </button>
                )}
                {mode === "forgot" && (
                  <button onClick={() => { setMode("login"); setError(""); }} style={linkStyle}>
                    Back to login
                  </button>
                )}
              </div>

              <div style={{ borderTop: `1px solid ${BORDER}`, marginTop: "1.25rem", paddingTop: "1rem", fontSize: "0.75rem", color: MUTED, textAlign: "center", lineHeight: 1.5 }}>
                You can also use all forms without an account.<br />
                Registration gives you pre-filled forms and submission history.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text", required: req }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; required?: boolean;
}) {
  return (
    <div style={{ marginBottom: "1rem" }}>
      <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
        {label}{req && <span style={{ color: "#b3261e", marginLeft: 2 }}>*</span>}
      </div>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={{ width: "100%", boxSizing: "border-box", padding: "0.6rem 0.75rem", border: "1px solid #d1d5db", borderRadius: 4, fontSize: "0.88rem", color: "#1a1a2e", background: "#fafbfc", outline: "none", fontFamily: "inherit" }} />
    </div>
  );
}

function btnStyle(bg: string): React.CSSProperties {
  return { background: bg, color: "#ffffff", border: "none", borderRadius: 4, padding: "0.7rem 1.75rem", fontSize: "0.85rem", fontWeight: 700, letterSpacing: "0.04em", cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase", width: "100%" };
}

const linkStyle: React.CSSProperties = {
  background: "none", border: "none", color: "#6b7280", fontSize: "0.78rem",
  cursor: "pointer", fontFamily: "inherit", textDecoration: "underline",
};
