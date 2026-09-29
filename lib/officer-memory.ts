// Remembers the officer's details on their phone so every Allied form can
// fill them in automatically. Stored in a cookie shared by all *.xing.wtf
// sites (so the call-off, DAR and time-off forms all see it), with a
// localStorage copy as a fallback. Nothing here is sent anywhere.

export interface OfficerMemory {
  name?: string;
  employeeNumber?: string;
  post?: string;
}

const COOKIE = "allied-officer";
const ONE_YEAR = 60 * 60 * 24 * 365;

export function getOfficer(): OfficerMemory {
  if (typeof document === "undefined") return {};
  try {
    const match = document.cookie.split("; ").find((c) => c.startsWith(`${COOKIE}=`));
    if (match) return JSON.parse(decodeURIComponent(match.slice(COOKIE.length + 1)));
  } catch { /* fall through */ }
  try {
    return JSON.parse(localStorage.getItem(COOKIE) || "{}");
  } catch {
    return {};
  }
}

export function rememberOfficer(update: OfficerMemory) {
  if (typeof document === "undefined") return;
  const clean = Object.fromEntries(
    Object.entries({ ...getOfficer(), ...update }).filter(([, v]) => typeof v === "string" && v.trim())
  ) as OfficerMemory;
  const value = encodeURIComponent(JSON.stringify(clean));
  const shared = window.location.hostname.endsWith("xing.wtf");
  try {
    document.cookie = `${COOKIE}=${value}; path=/; max-age=${ONE_YEAR}; samesite=lax${shared ? "; domain=.xing.wtf; secure" : ""}`;
  } catch { /* ignore */ }
  try {
    localStorage.setItem(COOKIE, JSON.stringify(clean));
  } catch { /* ignore */ }
}

export function forgetOfficer() {
  if (typeof document === "undefined") return;
  const shared = window.location.hostname.endsWith("xing.wtf");
  document.cookie = `${COOKIE}=; path=/; max-age=0${shared ? "; domain=.xing.wtf; secure" : ""}`;
  try { localStorage.removeItem(COOKIE); } catch { /* ignore */ }
}
