"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const getSupabase = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

const NAVY = "#1a4480";
const SOFT_BG = "#f2f5fa";
const WHITE = "#ffffff";
const MUTED = "#5b6474";
const BORDER = "#dbe2ec";
const TEXT = "#0f172a";

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

  // Already signed in (or arriving from an email confirmation link): go to the dashboard.
  useEffect(() => {
    getSupabase().auth.getSession().then(({ data }) => { if (data.session) window.location.href = "/dashboard"; });
  }, []);

  const handleLogin = async () => {
    if (!email || !password) return;
    setLoading(true);
    setError("");
    const supabase = getSupabase();
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) { setError("Invalid email or password. Please try again."); setLoading(false); return; }
    window.location.href = "/dashboard";
  };

  const handleRegister = async () => {
    if (!email || !password || !fullName) return;
    setLoading(true);
    setError("");
    const supabase = getSupabase();
    const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
    if (signUpError) { setError(signUpError.message); setLoading(false); return; }
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
    if (resetError) { setError("Failed to send reset email. Please try again."); setLoading(false); return; }
    setResetSent(true);
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: SOFT_BG, fontFamily: "var(--font-sans)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem 0.75rem 2rem" }}>
      <div style={{ maxWidth: 420, width: "100%", background: WHITE, borderRadius: 16, boxShadow: "0 10px 30px rgba(15,23,42,0.08), 0 1px 3px rgba(15,23,42,0.06)", overflow: "hidden" }}>

        <div style={{ background: "linear-gradient(135deg, #0f2d57 0%, #1d4f91 100%)", padding: "1.25rem 1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ color: "#fff", fontSize: "0.95rem", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Allied<span style={{ fontWeight: 300 }}>Universal</span><sup style={{ fontSize: "0.5rem", fontWeight: 300, marginLeft: 1 }}>™</sup>
            </div>
            <a href="/forms" style={{ color: "rgba(255,255,255,0.85)", fontSize: "0.85rem", textDecoration: "none", fontWeight: 600 }}>‹ All forms</a>
          </div>
          <div style={{ color: "#fff", fontSize: "1.45rem", fontWeight: 700, marginTop: "0.6rem", lineHeight: 1.2 }}>{mode === "login" ? "Sign in" : mode === "register" ? "Create an account" : "Reset your password"}</div>
          <div style={{ color: "rgba(255,255,255,0.8)", fontSize: "0.92rem", marginTop: 4 }}>Officer portal · Washington University</div>
        </div>

        <div style={{ padding: "1.75rem 1.25rem" }}>
          {resetSent ? (
            <div style={{ textAlign: "center" }}>
              <div style={{ width: 52, height: 52, borderRadius: "50%", background: "#e8f5e9", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem" }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2f6b3a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              </div>
              <div style={{ fontWeight: 700, color: TEXT, marginBottom: 8 }}>Reset email sent</div>
              <div style={{ fontSize: "0.82rem", color: MUTED, marginBottom: "1.5rem" }}>Check your inbox for a password reset link.</div>
              <button onClick={() => { setMode("login"); setResetSent(false); }} style={btnStyle(NAVY)}>Back to Login</button>
            </div>
          ) : mode === "login" ? (
            <>
              <Field label="Email Address" value={email} onChange={setEmail} placeholder="your@email.com" type="email" required />
              <Field label="Password" value={password} onChange={setPassword} placeholder="Enter your password" type="password" required onEnter={handleLogin} />

              {error && <ErrorBox message={error} />}

              <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                <button onClick={handleLogin} disabled={loading} style={{ ...btnStyle(loading ? "#9ca3af" : NAVY), cursor: loading ? "not-allowed" : "pointer" }}>
                  {loading ? "Please wait..." : "Sign In"}
                </button>
                <button onClick={() => { setMode("register"); setError(""); }} style={outlineBtn}>
                  Create Account
                </button>
                <a href="/forms" style={{ ...outlineBtn, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, textDecoration: "none", background: SOFT_BG, borderColor: BORDER, color: MUTED }}>
                  Continue without account
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                </a>
              </div>

              <div style={{ textAlign: "center", marginTop: "1rem" }}>
                <button onClick={() => { setMode("forgot"); setError(""); }} style={linkStyle}>Forgot password?</button>
              </div>

              <div style={{ borderTop: `1px solid ${BORDER}`, marginTop: "1.25rem", paddingTop: "1rem", fontSize: "0.72rem", color: MUTED, textAlign: "center", lineHeight: 1.5 }}>
                Registration gives you pre-filled forms, submission history, and disciplinary notice alerts.
              </div>
            </>
          ) : mode === "register" ? (
            <>
              <Field label="Full Name" value={fullName} onChange={setFullName} placeholder="Your full legal name" required />
              <Field label="Employee Number (optional)" value={employeeNumber} onChange={setEmployeeNumber} placeholder="e.g. 12345" />
              <Field label="Assigned Post (optional)" value={post} onChange={setPost} placeholder="e.g. Greenway Walk" />
              <Field label="Email Address" value={email} onChange={setEmail} placeholder="your@email.com" type="email" required />
              <Field label="Password" value={password} onChange={setPassword} placeholder="Min. 8 characters" type="password" required />

              {error && <ErrorBox message={error} />}

              <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                <button onClick={handleRegister} disabled={loading} style={{ ...btnStyle(loading ? "#9ca3af" : NAVY), cursor: loading ? "not-allowed" : "pointer" }}>
                  {loading ? "Please wait..." : "Create Account"}
                </button>
                <button onClick={() => { setMode("login"); setError(""); }} style={outlineBtn}>
                  Already have an account? Sign In
                </button>
                <a href="/forms" style={{ ...outlineBtn, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, textDecoration: "none", background: SOFT_BG, borderColor: BORDER, color: MUTED }}>
                  Continue without account
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                </a>
              </div>
            </>
          ) : (
            <>
              <Field label="Email Address" value={email} onChange={setEmail} placeholder="your@email.com" type="email" required />
              {error && <ErrorBox message={error} />}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                <button onClick={handleReset} disabled={loading} style={{ ...btnStyle(loading ? "#9ca3af" : NAVY), cursor: loading ? "not-allowed" : "pointer" }}>
                  {loading ? "Please wait..." : "Send Reset Email"}
                </button>
                <button onClick={() => { setMode("login"); setError(""); }} style={outlineBtn}>
                  Back to Login
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text", required: req, onEnter }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; required?: boolean; onEnter?: () => void;
}) {
  return (
    <div style={{ marginBottom: "1rem" }}>
      <div style={{ fontSize: "0.92rem", fontWeight: 600, color: "#334155", marginBottom: 6 }}>
        {label}{req && <span style={{ color: "#b3261e", marginLeft: 2 }}>*</span>}
      </div>
      <input
        type={type} value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onEnter?.()}
        placeholder={placeholder}
        style={{ width: "100%", boxSizing: "border-box", padding: "0.6rem 0.75rem", border: "1px solid #d1d5db", borderRadius: 12, fontSize: "0.88rem", color: "#1a1a2e", background: "#ffffff", outline: "none", fontFamily: "inherit" }}
      />
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 12, padding: "0.65rem 1rem", fontSize: "0.82rem", color: "#b91c1c", marginBottom: "1rem" }}>
      {message}
    </div>
  );
}

function btnStyle(bg: string): React.CSSProperties {
  return { background: bg, color: "#ffffff", border: "none", borderRadius: 12, padding: "0.7rem 1.75rem", fontSize: "0.95rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", width: "100%", textAlign: "center" };
}

const outlineBtn: React.CSSProperties = {
  background: WHITE, color: "#1f4e79", border: "1.5px solid #1f4e79", borderRadius: 12,
  padding: "0.65rem 1.75rem", fontSize: "0.95rem", fontWeight: 700, letterSpacing: "0.04em",
  cursor: "pointer", fontFamily: "inherit", width: "100%",
  textAlign: "center",
};

const linkStyle: React.CSSProperties = {
  background: "none", border: "none", color: "#6b7280", fontSize: "0.78rem",
  cursor: "pointer", fontFamily: "inherit", textDecoration: "underline",
};
