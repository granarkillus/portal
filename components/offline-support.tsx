"use client";

// Mounted on every page. Sends forms that were saved while there was no
// signal as soon as the connection is back, and shows what's still waiting.
// Also registers the service worker that lets the officer forms open with
// no signal at all.

import { useEffect, useState } from "react";
import { discardOutboxItem, flushOutbox, getOutbox, KIND_LABEL, onOutboxChange, OutboxItem } from "@/lib/outbox";
import { C } from "@/lib/theme";
import { fmtStamp } from "@/lib/format";
import Icon from "@/components/icon";

const RETRY_MS = 20000;

export default function OfflineSupport() {
  const [items, setItems] = useState<OutboxItem[]>([]);
  const [online, setOnline] = useState(true);
  const [sentNote, setSentNote] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const refresh = () => setItems(getOutbox());
    refresh();
    setOnline(navigator.onLine);

    let noteTimer: ReturnType<typeof setTimeout> | undefined;
    const flush = async () => {
      if (getOutbox().length === 0) return;
      const sent = await flushOutbox();
      if (sent.length > 0) {
        const what = sent.length === 1 ? `Your ${KIND_LABEL[sent[0].kind]}` : `${sent.length} saved forms`;
        const extra = sent.some((s) => s.kind === "calloff") ? " Your supervisor has been emailed." : "";
        setSentNote(`✓ ${what} ${sent.length === 1 ? "was" : "were"} sent.${extra}`);
        clearTimeout(noteTimer);
        noteTimer = setTimeout(() => setSentNote(""), 8000);
      }
    };

    const goOnline = () => { setOnline(true); flush(); };
    const goOffline = () => setOnline(false);
    const visible = () => { if (document.visibilityState === "visible") flush(); };
    const off = onOutboxChange(refresh);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    document.addEventListener("visibilitychange", visible);
    const interval = setInterval(flush, RETRY_MS);
    flush();

    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => { /* optional */ });
    }

    return () => {
      off();
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      document.removeEventListener("visibilitychange", visible);
      clearInterval(interval);
      clearTimeout(noteTimer);
    };
  }, []);

  if (sentNote) {
    return (
      <div role="status" style={{ ...bar, background: C.green }}>
        <span style={{ flex: 1 }}>{sentNote}</span>
        <button type="button" onClick={() => setSentNote("")} style={closeBtn} aria-label="Dismiss">✕</button>
      </div>
    );
  }

  if (items.length === 0) {
    if (online) return null;
    return (
      <div role="status" style={{ ...bar, background: C.slate }}>
        <Icon name="wifiOff" size={18} />
        <span style={{ flex: 1 }}>No signal. You can keep filling in forms; they&apos;ll send when you&apos;re back online.</span>
      </div>
    );
  }

  const failed = items.filter((i) => i.error);
  const waiting = items.length - failed.length;

  return (
    <div role="status" style={{ ...bar, background: failed.length ? C.red : C.orange, flexDirection: "column", alignItems: "stretch" }}>
      <button type="button" onClick={() => setOpen((o) => !o)} style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.6rem" }}>
        <Icon name={failed.length ? "alert" : "clock"} size={18} />
        <span style={{ flex: 1 }}>
          {waiting > 0 && <>{waiting === 1 ? "1 form is" : `${waiting} forms are`} waiting for signal. {online ? "Sending…" : "It'll send automatically."}</>}
          {waiting > 0 && failed.length > 0 && " "}
          {failed.length > 0 && <>{failed.length === 1 ? "1 form couldn't be sent." : `${failed.length} forms couldn't be sent.`}</>}
        </span>
        <span style={{ fontSize: "0.85rem", textDecoration: "underline" }}>{open ? "Hide" : "Details"}</span>
      </button>
      {open && (
        <div style={{ marginTop: "0.6rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
          {items.map((i) => (
            <div key={i.id} style={{ background: "rgba(255,255,255,0.14)", borderRadius: 10, padding: "0.55rem 0.75rem", fontSize: "0.88rem" }}>
              <div style={{ fontWeight: 700 }}>{i.label}</div>
              <div style={{ opacity: 0.85 }}>
                Saved {fmtStamp(new Date(i.savedAt).toISOString())}
                {i.error ? " · Couldn't be sent. Please fill it in again or contact your supervisor." : " · Waiting to send"}
              </div>
              {i.error && (
                <button type="button" onClick={() => discardOutboxItem(i.id)} style={{ marginTop: 6, background: C.white, color: C.red, border: "none", borderRadius: 8, padding: "0.35rem 0.75rem", fontWeight: 700, fontSize: "0.82rem", fontFamily: "inherit", cursor: "pointer", minHeight: 0 }}>
                  Remove
                </button>
              )}
            </div>
          ))}
          {items.some((i) => i.kind === "calloff" && !i.error) && (
            <div style={{ fontSize: "0.85rem", opacity: 0.9 }}>If your call-off is urgent, call your supervisor too.</div>
          )}
        </div>
      )}
    </div>
  );
}

const bar: React.CSSProperties = {
  position: "sticky", top: 0, zIndex: 1000, display: "flex", alignItems: "center", gap: "0.6rem",
  color: C.white, padding: "0.7rem 1rem", fontSize: "0.92rem", fontWeight: 600, lineHeight: 1.4,
  fontFamily: "var(--font-sans, system-ui, sans-serif)", boxShadow: "0 2px 10px rgba(15,23,42,0.18)",
};

const closeBtn: React.CSSProperties = { background: "none", border: "none", color: C.white, fontSize: "1rem", cursor: "pointer", padding: "0 0.25rem", minHeight: 0 };
