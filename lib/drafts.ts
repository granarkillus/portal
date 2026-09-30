"use client";

// Keeps a half-filled form on this phone so a locked screen, a phone call or
// an accidental refresh doesn't wipe it. Nothing is sent anywhere; the draft
// is cleared as soon as the form is submitted (or queued to send).

import { useEffect, useRef, useState } from "react";

const PREFIX = "allied-draft:";
const MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;

interface Stored<T> { savedAt: number; value: T }

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const stored = JSON.parse(raw) as Stored<T>;
    if (!stored || Date.now() - stored.savedAt > MAX_AGE_MS) {
      localStorage.removeItem(PREFIX + key);
      return null;
    }
    return stored.value;
  } catch {
    return null;
  }
}

export function clearDraft(key: string) {
  try { localStorage.removeItem(PREFIX + key); } catch { /* ignore */ }
}

/**
 * Restores a saved draft once on load (calling `restore`), then saves `value`
 * whenever it changes while `hasContent` is true. Returns whether a draft was
 * restored, so the page can show "we kept your unsent form".
 */
export function useDraft<T>(key: string | null, value: T, restore: (saved: T) => void, hasContent: boolean): boolean {
  const [restored, setRestored] = useState(false);
  const ready = useRef(false);
  const restoreRef = useRef(restore);
  restoreRef.current = restore;

  useEffect(() => {
    if (!key) return;
    const saved = read<T>(key);
    if (saved) {
      restoreRef.current(saved);
      setRestored(true);
    }
  }, [key]);

  useEffect(() => {
    if (!key) return;
    // Skip the very first pass: it still holds the blank form from before the
    // restore above, and saving it would overwrite the draft.
    if (!ready.current) { ready.current = true; return; }
    const t = setTimeout(() => {
      try {
        if (hasContent) localStorage.setItem(PREFIX + key, JSON.stringify({ savedAt: Date.now(), value }));
        else localStorage.removeItem(PREFIX + key);
      } catch { /* storage full or blocked: drafts are best-effort */ }
    }, 300);
    return () => clearTimeout(t);
  }, [key, value, hasContent]);

  return restored;
}
