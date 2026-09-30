"use client";

import { useEffect, useState } from "react";
import { getOfficer } from "@/lib/officer-memory";

const NAVY = "#1a4480";
const SOFT_BG = "#f2f5fa";
const WHITE = "#ffffff";
const MUTED = "#5b6474";
const BORDER = "#dbe2ec";
const TEXT = "#0f172a";

// The officer start screen: one big button per task, no login needed.
const TASKS = [
  {
    label: "Call off a shift",
    description: "Can't make it in? Your supervisor is emailed right away.",
    href: "/calloff",
    icon: "🤒",
    accent: "#c2410c",
    tint: "#fff7ed",
  },
  {
    label: "Submit my DAR",
    description: "Enter your shift, then tap to fill in your activity.",
    href: "/dar",
    icon: "📋",
    accent: NAVY,
    tint: "#eaf1fb",
  },
  {
    label: "Request time off",
    description: "Vacation, sick or personal time. Two weeks' notice.",
    href: "/timeoff",
    icon: "🗓️",
    accent: "#15803d",
    tint: "#ecfdf3",
  },
  {
    label: "Respond to a write-up",
    description: "Acknowledge a coaching or disciplinary notice.",
    href: "/writeup",
    icon: "✍️",
    accent: "#7c3aed",
    tint: "#f5f3ff",
  },
];

export default function FormsPage() {
  const [firstName, setFirstName] = useState("");
  const [installHint, setInstallHint] = useState<"" | "ios" | "android">("");

  useEffect(() => {
    const name = getOfficer().name || "";
    setFirstName(name.split(" ")[0] || "");

    // Offer "add to home screen" tips unless it's already installed.
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone;
    let dismissed = false;
    try { dismissed = localStorage.getItem("hide-install-hint") === "1"; } catch { /* ignore */ }
    if (!standalone && !dismissed) {
      const ua = navigator.userAgent;
      if (/iPhone|iPad|iPod/.test(ua)) setInstallHint("ios");
      else if (/Android/.test(ua)) setInstallHint("android");
    }
  }, []);

  const hideHint = () => {
    setInstallHint("");
    try { localStorage.setItem("hide-install-hint", "1"); } catch { /* ignore */ }
  };

  return (
    <div style={{ minHeight: "100vh", background: SOFT_BG, fontFamily: "var(--font-sans)" }}>
      <div style={{ background: "linear-gradient(135deg, #0f2d57 0%, #1d4f91 100%)", padding: "1.5rem 1.25rem 3.5rem" }}>
        <div style={{ maxWidth: 560, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ color: WHITE, fontSize: "0.95rem", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Allied<span style={{ fontWeight: 300 }}>Universal</span><sup style={{ fontSize: "0.5rem", fontWeight: 300, marginLeft: 1 }}>™</sup>
            </div>
            <a href="/" style={{ color: "rgba(255,255,255,0.85)", fontSize: "0.88rem", textDecoration: "none", fontWeight: 600 }}>Sign in</a>
          </div>
          <div style={{ color: WHITE, fontSize: "1.65rem", fontWeight: 700, marginTop: "1.25rem", lineHeight: 1.2 }}>
            {firstName ? `Hi, ${firstName} 👋` : "Hi there 👋"}
          </div>
          <div style={{ color: "rgba(255,255,255,0.8)", fontSize: "1rem", marginTop: 6 }}>What do you need to do?</div>
        </div>
      </div>

      <div style={{ maxWidth: 560, margin: "-2.25rem auto 0", padding: "0 1rem 2rem" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {TASKS.map((t) => (
            <a
              key={t.label}
              href={t.href}
              style={{
                display: "flex", alignItems: "center", gap: "1rem",
                background: WHITE, borderRadius: 16, padding: "1.1rem 1.1rem",
                textDecoration: "none", border: `1px solid ${BORDER}`,
                boxShadow: "0 10px 30px rgba(15,23,42,0.08), 0 1px 3px rgba(15,23,42,0.06)",
              }}
            >
              <span style={{ width: 56, height: 56, borderRadius: 14, background: t.tint, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.7rem", flexShrink: 0 }}>{t.icon}</span>
              <span style={{ flex: 1 }}>
                <span style={{ display: "block", fontSize: "1.1rem", fontWeight: 700, color: TEXT }}>{t.label}</span>
                <span style={{ display: "block", fontSize: "0.9rem", color: MUTED, marginTop: 3, lineHeight: 1.4 }}>{t.description}</span>
              </span>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </a>
          ))}
        </div>

        <a href="/dar/my-dars" style={{ display: "block", textAlign: "center", marginTop: "1.25rem", color: NAVY, fontWeight: 600, fontSize: "0.95rem" }}>
          See the DARs I&apos;ve sent from this phone
        </a>

        {installHint && (
          <div style={{ marginTop: "1.5rem", background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 16, padding: "1rem 1.1rem", display: "flex", gap: "0.85rem", alignItems: "flex-start" }}>
            <span style={{ fontSize: "1.5rem" }}>📲</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, color: TEXT, fontSize: "0.98rem" }}>Put this on your home screen</div>
              <div style={{ color: MUTED, fontSize: "0.9rem", marginTop: 4, lineHeight: 1.5 }}>
                {installHint === "ios"
                  ? <>Tap the <strong>Share</strong> button at the bottom of Safari, then <strong>Add to Home Screen</strong>.</>
                  : <>Tap the <strong>⋮ menu</strong> in Chrome, then <strong>Add to Home screen</strong> or <strong>Install app</strong>.</>}
              </div>
              <button type="button" onClick={hideHint} style={{ background: "none", border: "none", padding: 0, minHeight: 0, marginTop: 8, color: NAVY, fontWeight: 600, fontSize: "0.88rem", fontFamily: "inherit", cursor: "pointer" }}>
                Got it, hide this
              </button>
            </div>
          </div>
        )}

        <div style={{ textAlign: "center", marginTop: "2rem", fontSize: "0.85rem", color: MUTED, lineHeight: 1.6 }}>
          No account needed. <a href="/" style={{ color: NAVY, fontWeight: 600 }}>Sign in</a> to see your history.
        </div>
      </div>
    </div>
  );
}
