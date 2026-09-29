// "My DARs" without a login: this phone/browser remembers the ids of the DARs
// it submitted, and the My DARs page looks up only those.
//
// Stored in localStorage and in a cookie shared by all *.xing.wtf sites, so
// the list carries over from the old dar.xing.wtf site to portal.xing.wtf.

const KEY = "my-dar-ids";
const MAX = 50;
const ONE_YEAR = 60 * 60 * 24 * 365;

// Random id created before insert, so the page knows the new DAR's id without
// needing permission to read the table back.
export function newDarId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function readList(raw: string | null | undefined): string[] {
  try {
    const ids = JSON.parse(raw || "[]");
    return Array.isArray(ids) ? ids.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function getRememberedDars(): string[] {
  let fromStorage: string[] = [];
  let fromCookie: string[] = [];
  try { fromStorage = readList(localStorage.getItem(KEY)); } catch { /* ignore */ }
  try {
    const c = document.cookie.split("; ").find((x) => x.startsWith(`${KEY}=`));
    if (c) fromCookie = readList(decodeURIComponent(c.slice(KEY.length + 1)));
  } catch { /* ignore */ }
  return Array.from(new Set([...fromStorage, ...fromCookie])).slice(0, MAX);
}

export function rememberDar(id: string) {
  const ids = [id, ...getRememberedDars().filter((x) => x !== id)].slice(0, MAX);
  try { localStorage.setItem(KEY, JSON.stringify(ids)); } catch { /* ignore */ }
  try {
    const shared = window.location.hostname.endsWith("xing.wtf");
    document.cookie = `${KEY}=${encodeURIComponent(JSON.stringify(ids))}; path=/; max-age=${ONE_YEAR}; samesite=lax${shared ? "; domain=.xing.wtf; secure" : ""}`;
  } catch { /* ignore */ }
}
