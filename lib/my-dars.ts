// "My DARs" without a login: this phone/browser remembers the ids of the DARs
// it submitted, and the My DARs page looks up only those.

const KEY = "my-dar-ids";
const MAX = 50;

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

export function getRememberedDars(): string[] {
  try {
    const ids = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(ids) ? ids.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function rememberDar(id: string) {
  try {
    const ids = [id, ...getRememberedDars().filter((x) => x !== id)].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    // Private mode or storage blocked: the DAR is still submitted, it just won't show in My DARs.
  }
}
