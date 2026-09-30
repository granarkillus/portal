"use client";

import { useState } from "react";

// Shown at the top of a form when an unsent draft was brought back.
export default function DraftNotice({ what, onStartOver }: { what: string; onStartOver: () => void }) {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  return (
    <div role="status" style={{ display: "flex", alignItems: "center", gap: "0.75rem", background: "#eaf1fb", border: "1px solid #bcd0ec", borderRadius: 12, padding: "0.8rem 1rem", fontSize: "0.92rem", color: "#0f2d57", lineHeight: 1.45 }}>
      <span style={{ fontSize: "1.2rem" }}>📝</span>
      <span style={{ flex: 1 }}>We kept your unsent {what}, so you can pick up where you left off.</span>
      <button
        type="button"
        onClick={() => { if (window.confirm(`Clear this ${what} and start a new one?`)) { onStartOver(); setHidden(true); } }}
        style={{ background: "none", border: "none", padding: 0, minHeight: 0, color: "#1a4480", fontWeight: 700, textDecoration: "underline", cursor: "pointer", fontFamily: "inherit", fontSize: "0.88rem", whiteSpace: "nowrap" }}
      >
        Start over
      </button>
    </div>
  );
}
