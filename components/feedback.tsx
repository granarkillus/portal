"use client";

// Small shared feedback pieces: gray placeholder rows while lists load, and a
// short confirmation popup ("Forwarded to management") after an action.

import { useEffect, useState } from "react";
import Icon from "@/components/icon";
import { C } from "@/lib/theme";

export function Skeleton({ rows = 3, card = true }: { rows?: number; card?: boolean }) {
  return (
    <div aria-busy="true" aria-label="Loading" style={card ? { background: C.white, border: "1px solid #dbe2ec", borderRadius: 16, overflow: "hidden" } : undefined}>
      <style>{`@keyframes sk-pulse { 0%,100% { opacity: 1 } 50% { opacity: .45 } }`}</style>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ padding: "1rem 1.1rem", borderTop: i ? "1px solid #dbe2ec" : "none", display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ height: 14, width: `${42 + ((i * 17) % 30)}%`, background: "#e5eaf1", borderRadius: 6, animation: "sk-pulse 1.4s ease-in-out infinite" }} />
          <div style={{ height: 11, width: `${60 + ((i * 11) % 25)}%`, background: "#eef2f7", borderRadius: 6, animation: "sk-pulse 1.4s ease-in-out infinite" }} />
        </div>
      ))}
    </div>
  );
}

/** Whole-page placeholder while a record loads: header band plus a card of gray rows. */
export function PageSkeleton({ width = 760 }: { width?: number }) {
  return (
    <div style={{ minHeight: "100vh", background: C.softBg, padding: "1rem 0.75rem" }}>
      <div style={{ maxWidth: width, margin: "0 auto" }}>
        <div style={{ height: 96, borderRadius: "16px 16px 0 0", background: "linear-gradient(135deg, #0f2d57 0%, #1d4f91 100%)" }} />
        <div style={{ background: C.white, borderRadius: "0 0 16px 16px", overflow: "hidden" }}><Skeleton rows={5} card={false} /></div>
      </div>
    </div>
  );
}

/** Show a short confirmation at the bottom of the screen. */
export function toast(message: string) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("app-toast", { detail: message }));
}

/** Mounted once in the root layout. */
export function Toaster() {
  const [msg, setMsg] = useState("");
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const on = (e: Event) => {
      setMsg((e as CustomEvent<string>).detail);
      clearTimeout(t);
      t = setTimeout(() => setMsg(""), 2600);
    };
    window.addEventListener("app-toast", on);
    return () => { window.removeEventListener("app-toast", on); clearTimeout(t); };
  }, []);
  if (!msg) return null;
  return (
    <>
    <style>{`@keyframes toast-in { from { opacity: 0; transform: translate(-50%, 8px) } to { opacity: 1; transform: translate(-50%, 0) } } @media print { .app-toast { display: none !important } }`}</style>
    <div role="status" className="app-toast" aria-live="polite" style={{ position: "fixed", left: "50%", bottom: "calc(5.5rem + env(safe-area-inset-bottom))", transform: "translateX(-50%)", zIndex: 1000, background: C.text, color: C.white, borderRadius: 999, padding: "0.6rem 1.1rem", fontSize: "0.9rem", fontWeight: 600, boxShadow: "0 8px 24px rgba(15,23,42,0.25)", display: "flex", alignItems: "center", gap: 8, maxWidth: "calc(100vw - 32px)", animation: "toast-in .18s ease-out" }}>
      <Icon name="check" size={16} color="#4ade80" strokeWidth={3} />
      {msg}
    </div>
    </>
  );
}
