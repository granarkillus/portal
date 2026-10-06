"use client";

import { C } from "@/lib/theme";

// One header for every supervisor page: brand, page title, and a nav row
// that scrolls sideways on phones instead of squeezing or cutting off.
// On a computer (1100px+) the nav moves to a slim sidebar on the left.

const SIDEBAR_W = 216;
const SIDEBAR_CSS = `
.sv-sidebar { display: none; }
@media (min-width: 1100px) {
  .sv-sidebar { display: flex; }
  .sv-navrow { display: none !important; }
  .sv-brand { display: none !important; }
  body { padding-left: ${SIDEBAR_W}px; }
}
@media print {
  .sv-sidebar { display: none !important; }
  body { padding-left: 0 !important; }
}
`;

const NAV: [string, string, string][] = [
  ["dashboard", "Dashboard", "/supervisor/dashboard"],
  ["calendar", "Calendar", "/supervisor/calendar"],
  ["timeoff", "Time-off", "/timeoff/requests"],
  ["calloffs", "Call-offs", "/supervisor/calloffs"],
  ["writeups", "Write-ups", "/writeup/records"],
  ["dars", "DARs", "/dar/report"],
];

export type SupervisorSection = "dashboard" | "calendar" | "timeoff" | "calloffs" | "writeups" | "dars";

export default function SupervisorHeader({ title, subtitle, active, right, actions, rounded = true }: {
  title: string;
  subtitle?: string;
  active?: SupervisorSection;
  right?: React.ReactNode; // e.g. Sign out
  actions?: React.ReactNode; // page buttons (back, print, edit) shown under the title
  rounded?: boolean;
}) {
  return (
    <>
    <style>{SIDEBAR_CSS}</style>
    <aside className="sv-sidebar" style={{ position: "fixed", top: 0, left: 0, bottom: 0, width: SIDEBAR_W, zIndex: 50, flexDirection: "column", background: "#0f2d57", padding: "1.25rem 0.85rem", boxSizing: "border-box" }}>
      <a href="/supervisor/dashboard" style={{ color: C.white, textDecoration: "none", fontSize: "0.95rem", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", whiteSpace: "nowrap", padding: "0 0.6rem" }}>
        Allied<span style={{ fontWeight: 300 }}>Universal</span><sup style={{ fontSize: "0.5rem", fontWeight: 300, marginLeft: 1 }}>™</sup>
      </a>
      <div style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", padding: "0.3rem 0.6rem 1.25rem" }}>Supervisor</div>
      <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {NAV.map(([key, label, href]) => {
          const on = key === active;
          return (
            <a key={key} href={href} aria-current={on ? "page" : undefined} style={{
              textDecoration: "none", fontSize: "0.92rem", fontWeight: on ? 700 : 600, borderRadius: 10, padding: "0.55rem 0.75rem",
              background: on ? "rgba(255,255,255,0.14)" : "transparent", color: on ? C.white : "rgba(255,255,255,0.72)",
              boxShadow: on ? "inset 3px 0 0 #fff" : "none",
            }}>
              {label}
            </a>
          );
        })}
      </nav>
      <div style={{ marginTop: "auto", padding: "0 0.6rem", fontSize: "0.75rem", color: "rgba(255,255,255,0.45)" }}>portal.xing.wtf</div>
    </aside>
    <div style={{ background: "linear-gradient(135deg, #0f2d57 0%, #1d4f91 100%)", padding: "1.1rem 1.25rem 0.85rem", borderRadius: rounded ? "16px 16px 0 0" : 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", minWidth: 0 }}>
          <span className="sv-brand" style={{ color: C.white, fontSize: "0.95rem", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
            Allied<span style={{ fontWeight: 300 }}>Universal</span><sup style={{ fontSize: "0.5rem", fontWeight: 300, marginLeft: 1 }}>™</sup>
          </span>
          {!right && <span className="sv-brand" style={{ color: "rgba(255,255,255,0.85)", fontSize: "0.72rem", fontWeight: 700, border: "1px solid rgba(255,255,255,0.35)", borderRadius: 999, padding: "0.1rem 0.5rem", whiteSpace: "nowrap" }}>Supervisor</span>}
        </div>
        {right}
      </div>
      <div style={{ color: C.white, fontSize: "1.4rem", fontWeight: 700, marginTop: "0.65rem", lineHeight: 1.2 }}>{title}</div>
      {subtitle && <div style={{ color: "rgba(255,255,255,0.8)", fontSize: "0.9rem", marginTop: 3 }}>{subtitle}</div>}
      {actions && <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.75rem" }}>{actions}</div>}
      <nav className="sv-navrow" style={{ display: "flex", gap: "0.4rem", marginTop: "0.85rem", overflowX: "auto", scrollbarWidth: "none", WebkitOverflowScrolling: "touch", paddingBottom: 2 }}>
        {NAV.map(([key, label, href]) => {
          const on = key === active;
          return (
            <a key={key} href={href} aria-current={on ? "page" : undefined} style={{
              flexShrink: 0, textDecoration: "none", fontSize: "0.85rem", fontWeight: 700, borderRadius: 999, padding: "0.4rem 0.85rem",
              background: on ? C.white : "rgba(255,255,255,0.12)", color: on ? C.navy : C.white, border: `1px solid ${on ? C.white : "rgba(255,255,255,0.25)"}`,
            }}>
              {label}
            </a>
          );
        })}
      </nav>
    </div>
    </>
  );
}

/** Light stats row under the header; wraps on phones. */
export function StatStrip({ items, action }: { items: [string, number | string, string?][]; action?: React.ReactNode }) {
  return (
    <div style={{ background: C.white, borderLeft: "1px solid #dbe2ec", borderRight: "1px solid #dbe2ec", padding: "0.85rem 1.25rem", display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
      {items.map(([label, value, color]) => (
        <div key={label} style={{ background: C.softBg, border: "1px solid #dbe2ec", borderRadius: 12, padding: "0.4rem 0.75rem", display: "flex", alignItems: "baseline", gap: 6 }}>
          <span style={{ fontSize: "1.05rem", fontWeight: 800, color: color || C.text }}>{value}</span>
          <span style={{ fontSize: "0.8rem", color: C.muted, fontWeight: 600 }}>{label}</span>
        </div>
      ))}
      {action && <div style={{ marginLeft: "auto" }}>{action}</div>}
    </div>
  );
}

/** Buttons for the header's action row. */
export const headerButton = (primary = false): React.CSSProperties => ({
  display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none", fontSize: "0.88rem", fontWeight: 700,
  borderRadius: 999, padding: "0.45rem 0.95rem", cursor: "pointer", fontFamily: "inherit", minHeight: 0,
  background: primary ? C.green : "transparent", color: C.white, border: `1px solid ${primary ? C.green : "rgba(255,255,255,0.45)"}`,
});
