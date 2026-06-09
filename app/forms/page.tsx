"use client";

const NAVY = "#1f4e79";
const DARK = "#1a1a2e";
const SOFT_BG = "#f4f6f9";
const WHITE = "#ffffff";
const MUTED = "#6b7280";
const BORDER = "#d1d5db";

export default function FormsPage() {
  const forms = [
    {
      label: "Daily Activity Report",
      description: "Submit your end-of-shift activity log",
      href: "https://dar.xing.wtf",
      icon: "📋",
      color: NAVY,
    },
    {
      label: "Time-Off Request",
      description: "Request vacation, sick, or personal time off",
      href: "https://timeoffrequest.xing.wtf",
      icon: "📅",
      color: NAVY,
    },
    {
      label: "Call-Off Notice",
      description: "Notify your supervisor of an unplanned absence",
      href: "https://calloff.xing.wtf",
      icon: "📞",
      color: "#92400e",
    },
    {
      label: "Disciplinary Response",
      description: "Respond to a disciplinary notice from your supervisor",
      href: "https://disciplinaryformresponse.xing.wtf",
      icon: "📄",
      color: "#b91c1c",
    },
  ];

  return (
    <div style={{ minHeight: "100vh", background: SOFT_BG, fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>

      <div style={{ background: NAVY, padding: "1.25rem 2rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ color: "#ffffff", fontSize: "1rem", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase" }}>
            Allied<span style={{ fontWeight: 300 }}>Universal</span><sup style={{ fontSize: "0.5rem", fontWeight: 300, marginLeft: 1 }}>™</sup>
          </div>
          <div style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.68rem", marginTop: 2 }}>Security Services · Washington University</div>
        </div>
        <a href="/" style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.78rem", textDecoration: "none" }}>
          Sign in for full access →
        </a>
      </div>

      <div style={{ maxWidth: 560, margin: "0 auto", padding: "2.5rem 1rem" }}>

        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div style={{ fontSize: "1.1rem", fontWeight: 700, color: DARK, marginBottom: 6 }}>Employee Forms</div>
          <div style={{ fontSize: "0.82rem", color: MUTED, lineHeight: 1.6 }}>
            Select a form to submit. Sign in or register for pre-filled forms and submission history.
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {forms.map((form) => (
            <a
              key={form.label}
              href={form.href}
              style={{
                display: "flex", alignItems: "center", gap: "1rem",
                background: WHITE, border: `1px solid ${BORDER}`,
                borderLeft: `4px solid ${form.color}`,
                borderRadius: 4, padding: "1rem 1.25rem",
                textDecoration: "none", boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
                transition: "box-shadow 0.15s",
              }}
            >
              <span style={{ fontSize: "1.5rem", flexShrink: 0 }}>{form.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "0.92rem", fontWeight: 700, color: form.color, marginBottom: 2 }}>{form.label}</div>
                <div style={{ fontSize: "0.76rem", color: MUTED }}>{form.description}</div>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </a>
          ))}
        </div>

        <div style={{ textAlign: "center", marginTop: "2rem" }}>
          <a href="/" style={{ fontSize: "0.78rem", color: MUTED, textDecoration: "underline" }}>
            Sign in or register for full access
          </a>
        </div>
      </div>
    </div>
  );
}
