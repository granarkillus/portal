"use client";

// Forms that couldn't be sent (no signal in a garage or basement) wait here,
// on this phone, and are sent automatically when the connection comes back.
//
// Every row carries an id made on the phone, so a retry after a send whose
// reply got lost can't create a duplicate: the database answers "already
// exists", which we count as sent.

import { getPublicSupabase } from "@/lib/supabase";

export type OutboxKind = "calloff" | "dar" | "timeoff";

export interface OutboxItem {
  id: string;
  kind: OutboxKind;
  table: string;
  row: Record<string, unknown>;
  label: string;
  savedAt: string;
  error?: string;
}

export type SendResult = { status: "sent" } | { status: "queued" } | { status: "failed"; message: string };

const KEY = "allied-outbox";
const EVENT = "allied-outbox-change";
const TIMEOUT_MS = 20000;

export const KIND_LABEL: Record<OutboxKind, string> = { calloff: "call-off", dar: "DAR", timeoff: "time-off request" };

export function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function getOutbox(): OutboxItem[] {
  try {
    const items = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

function saveOutbox(items: OutboxItem[]) {
  try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* ignore */ }
  window.dispatchEvent(new Event(EVENT));
}

export function onOutboxChange(cb: () => void): () => void {
  const storage = (e: StorageEvent) => { if (e.key === KEY) cb(); };
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", storage);
  return () => { window.removeEventListener(EVENT, cb); window.removeEventListener("storage", storage); };
}

export function discardOutboxItem(id: string) {
  saveOutbox(getOutbox().filter((i) => i.id !== id));
}

type Attempt = "sent" | "offline" | { message: string };

async function attempt(table: string, row: Record<string, unknown>): Promise<Attempt> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return "offline";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const { error } = await getPublicSupabase().from(table).insert([row]).abortSignal(controller.signal);
    if (!error) return "sent";
    // Already there: an earlier try went through but its reply was lost.
    if (error.code === "23505") return "sent";
    // No error code means the request never got an answer (no signal, timeout).
    if (!error.code) return "offline";
    return { message: error.message };
  } catch {
    return "offline";
  } finally {
    clearTimeout(timer);
  }
}

/** Sends now if possible; if there's no signal, keeps it to send later. */
export async function sendOrQueue(kind: OutboxKind, table: string, row: Record<string, unknown> & { id: string }, label: string): Promise<SendResult> {
  const result = await attempt(table, row);
  if (result === "sent") return { status: "sent" };
  if (result === "offline") {
    const items = getOutbox().filter((i) => i.id !== row.id);
    items.push({ id: row.id, kind, table, row, label, savedAt: new Date().toISOString() });
    saveOutbox(items);
    return { status: "queued" };
  }
  return { status: "failed", message: result.message };
}

let flushing = false;

/** Tries to send everything waiting. Returns the items that went through. */
export async function flushOutbox(): Promise<OutboxItem[]> {
  if (flushing) return [];
  const pending = getOutbox();
  if (pending.length === 0) return [];
  flushing = true;
  const sent: OutboxItem[] = [];
  try {
    for (const item of pending) {
      const result = await attempt(item.table, item.row);
      if (result === "offline") break;
      const current = getOutbox();
      if (result === "sent") {
        sent.push(item);
        saveOutbox(current.filter((i) => i.id !== item.id));
      } else {
        // The database refused it (not a signal problem). Keep it and say so.
        saveOutbox(current.map((i) => (i.id === item.id ? { ...i, error: result.message } : i)));
      }
    }
  } finally {
    flushing = false;
  }
  return sent;
}
