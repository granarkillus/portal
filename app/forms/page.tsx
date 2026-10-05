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
    icon: "calloff",
    accent: "#c2410c",
    tint: "#fff7ed",
  },
  {
    label: "Submit my DAR",
    description: "Enter your shift, then tap to fill in your activity.",
    href: "/dar",
    icon: "dar",
    accent: NAVY,
    tint: "#eaf1fb",
  },
  {
    label: "Request time off",
    description: "Vacation, sick or personal time. Two weeks' notice.",
    href: "/timeoff",
    icon: "timeoff",
    accent: "#15803d",
    tint: "#ecfdf3",
  },
  {
    label: "Respond to a write-up",
    description: "Acknowledge a coaching or disciplinary notice.",
    href: "/writeup",
    icon: "writeup",
    accent: "#7c3aed",
    tint: "#f5f3ff",
  },
];

// Simple line icons (consistent on every phone, unlike emoji).
function TaskIcon({ name, color }: { name: string; color: string }) {
  const p = { fill: "none", stroke: color, strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true">
      {name === "calloff" && (<g {...p}><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /><line x1="10" y1="14" x2="14" y2="18" /><line x1="14" y1="14" x2="10" y2="18" /></g>)}
      {name === "dar" && (<g {...p}><rect x="8" y="2" width="8" height="4" rx="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><line x1="12" y1="11" x2="16" y2="11" /><line x1="12" y1="16" x2="16" y2="16" /><line x1="8" y1="11" x2="8.01" y2="11" /><line x1="8" y1="16" x2="8.01" y2="16" /></g>)}
      {name === "timeoff" && (<g {...p}><circle cx="12" cy="12" r="4" /><line x1="12" y1="2" x2="12" y2="4" /><line x1="12" y1="20" x2="12" y2="22" /><line x1="4.93" y1="4.93" x2="6.34" y2="6.34" /><line x1="17.66" y1="17.66" x2="19.07" y2="19.07" /><line x1="2" y1="12" x2="4" y2="12" /><line x1="20" y1="12" x2="22" y2="12" /><line x1="4.93" y1="19.07" x2="6.34" y2="17.66" /><line x1="17.66" y1="6.34" x2="19.07" y2="4.93" /></g>)}
      {name === "writeup" && (<g {...p}><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></g>)}
    </svg>
  );
}

const DRAFTS: [string, string, string][] = [["dar", "DAR", "/dar"], ["calloff", "call-off", "/calloff"], ["timeoff", "time-off request", "/timeoff"]];

export default function FormsPage() {
  const [firstName, setFirstName] = useState("");
  const [installHint, setInstallHint] = useState<"" | "ios" | "android">("");
  const [drafts, setDrafts] = useState<[string, string][]>([]);

  useEffect(() => {
    // Unfinished forms saved on this phone (see lib/drafts.ts).
    try {
      setDrafts(DRAFTS.filter(([key]) => localStorage.getItem(`allied-draft:${key}`)).map(([, label, href]) => [label, href]));
    } catch { /* ignore */ }

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
            <a href="/signin" style={{ color: "rgba(255,255,255,0.85)", fontSize: "0.88rem", textDecoration: "none", fontWeight: 600 }}>Sign in</a>
          </div>
          <div style={{ color: WHITE, fontSize: "1.65rem", fontWeight: 700, marginTop: "1.25rem", lineHeight: 1.2 }}>
            {firstName ? `Hi, ${firstName} 👋` : "Hi there 👋"}
          </div>
          <div style={{ color: "rgba(255,255,255,0.8)", fontSize: "1rem", marginTop: 6 }}>What do you need to do?</div>
        </div>
      </div>

      <div style={{ maxWidth: 560, margin: "-2.25rem auto 0", padding: "0 1rem 2rem" }}>
        {drafts.map(([label, href]) => (
          <a key={href} href={href} style={{ display: "flex", alignItems: "center", gap: "0.75rem", background: "#fff7ed", border: "1.5px solid #fdba74", borderRadius: 16, padding: "0.9rem 1.1rem", marginBottom: "0.75rem", textDecoration: "none", color: "#9a3412", boxShadow: "0 10px 30px rgba(15,23,42,0.08)" }}>
            <span style={{ fontSize: "1.3rem" }}>📝</span>
            <span style={{ flex: 1 }}>
              <span style={{ display: "block", fontWeight: 700, fontSize: "1rem" }}>Continue your unfinished {label}</span>
              <span style={{ display: "block", fontSize: "0.88rem", opacity: 0.85 }}>It&apos;s saved on this phone. Pick up where you left off.</span>
            </span>
            <span style={{ fontWeight: 700 }}>›</span>
          </a>
        ))}
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
              <span style={{ width: 56, height: 56, borderRadius: 14, background: t.tint, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><TaskIcon name={t.icon} color={t.accent} /></span>
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
          No account needed. <a href="/signin" style={{ color: NAVY, fontWeight: 600 }}>Sign in</a> to see your history.
        </div>
      </div>
    </div>
  );
}
