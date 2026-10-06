// One way to show dates and times everywhere on screen (printed forms keep
// their paper-form formats). Times are 24-hour like the officers use: 0700.

const TZ = "America/Chicago";

/** "2026-10-06" (pinned to midday Central) or an ISO timestamp → Date. */
function toDate(v: string): Date | null {
  if (!v) return null;
  const d = /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T17:00:00Z`) : new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

const opts = (d: Date, o: Intl.DateTimeFormatOptions) => d.toLocaleDateString("en-US", { timeZone: TZ, ...o });

const thisYear = () => +new Date().toLocaleDateString("en-US", { timeZone: TZ, year: "numeric" });

/** "Tue, Oct 6" (adds the year when it isn't this year). */
export function fmtDate(v: string | null | undefined): string {
  const d = toDate(v || "");
  if (!d) return "";
  const y = +opts(d, { year: "numeric" });
  return opts(d, { weekday: "short", month: "short", day: "numeric", ...(y !== thisYear() ? { year: "numeric" } : {}) });
}

/** "Oct 6, 2026": for signatures and official dates. */
export function fmtDateFull(v: string | null | undefined): string {
  const d = toDate(v || "");
  return d ? opts(d, { month: "short", day: "numeric", year: "numeric" }) : "";
}

/** "1434" from a timestamp, or "0700" from a stored "07:00". */
export function fmtTime(v: string | null | undefined): string {
  if (!v) return "";
  const hm = v.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (hm) return hm[1].padStart(2, "0") + hm[2];
  if (!/\d{4}-\d{2}-\d{2}T/.test(v)) return v; // already "0700" or free text
  const d = toDate(v);
  if (!d) return v;
  return d.toLocaleTimeString("en-US", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).replace(":", "");
}

/** "Tue, Oct 6 · 1434": when something was submitted or saved. */
export function fmtStamp(v: string | null | undefined): string {
  if (!v) return "";
  return `${fmtDate(v)} · ${fmtTime(v)}`;
}
