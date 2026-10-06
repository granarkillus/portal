// The site's colors and the standard button, in one place so every page matches.
// (Printed form templates keep their own paper-form styling.)

export const C = {
  navy: "#1a4480",
  navyTint: "#eaf1fb",
  dark: "#243b5e",
  softBg: "#f2f5fa",
  white: "#ffffff",
  text: "#0f172a",
  slate: "#334155",
  muted: "#5b6474",
  faint: "#94a3b8",
  border: "#dbe2ec",
  green: "#15803d",
  greenDark: "#2f6b3a",
  greenTint: "#e8f5e9",
  greenLine: "#a5d6a7",
  red: "#b91c1c",
  redTint: "#fef2f2",
  redLine: "#fca5a5",
  amber: "#92400e",
  amberTint: "#fff3cd",
  amberLine: "#fcd34d",
  orange: "#9a3412",
  orangeTint: "#fff7ed",
};

/** Full-width solid button. */
export function btnStyle(bg: string): React.CSSProperties {
  return { background: bg, color: C.white, border: "none", borderRadius: 12, padding: "0.7rem 1.75rem", fontSize: "0.95rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", width: "100%", textAlign: "center" };
}
