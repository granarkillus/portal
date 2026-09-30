// Reads the dates officers type on time-off requests ("Sept 28-30",
// "8/26, 8/27, 8/28/2026", "Aug 14th thru 18th", "27/28/29 of November"...)
// into real calendar dates. Anything it isn't sure about is flagged so a
// supervisor can check it; it never needs to be perfect.

export interface ParsedDates {
  dates: string[]; // YYYY-MM-DD, sorted, unique
  confident: boolean;
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

type Token =
  | { t: "month"; m: number }
  | { t: "num"; n: number }
  | { t: "year"; y: number }
  | { t: "date"; m: number; d: number; y?: number }
  | { t: "range" };

interface Item { m: number; d: number; y?: number; guessedYear?: boolean; rangeFromPrev?: boolean }

const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

function validDay(y: number, m: number, d: number) {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function fullYear(y: number) { return y < 100 ? 2000 + y : y; }

export function parseRequestedDates(text: string, submittedAt?: string | null): ParsedDates {
  const ref = submittedAt ? new Date(submittedAt) : new Date();
  const refYear = ref.getFullYear();
  let doubt = false;

  let s = ` ${(text || "").toLowerCase()} `;
  s = s.replace(/\b\d{1,2}[.:]\d{2}\s*(am|pm)?\b/g, " ");                  // times like 2:45 pm
  s = s.replace(/\b(\d{1,2})\s*(am|pm)\b/g, " ");
  s = s.replace(/\b(mon|tues?|wed(nes)?|thu(rs)?|fri|sat(ur)?|sun)(day)?s?\b/g, " "); // weekdays
  s = s.replace(/(\d)(st|nd|rd|th)\b/g, "$1");                               // 5th -> 5
  s = s.replace(/[–—]/g, "-");
  s = s.replace(/\b(through|thru|until|till|to)\b/g, " - ");
  s = s.replace(/([a-z])[/.]/g, "$1 ").replace(/[/]([a-z])/g, " $1");        // august/22, sept.
  s = s.replace(/\.+/g, " ");

  // Words like "3 days in October" or "next Friday" can't be read reliably.
  if (/\b(days?|weeks?|next|every|each|half|month)\b/.test(s)) doubt = true;

  const hasMonthWord = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/.test(s);

  // Tokenise left to right.
  const tokens: Token[] = [];
  const re = /\b(\d{1,2})([/-])(\d{1,2})(?:\2(\d{4}|\d{2}))?\b|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b|\b(\d{4})\b|\b(\d{1,2})\b|(-)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(s))) {
    const [, a, sep, b, c, mon, year, num, dash] = match;
    if (a) {
      const x = +a, y = +b;
      // "5-14" next to a month word is a range of days, not May 14.
      if (sep === "-" && hasMonthWord) {
        tokens.push({ t: "num", n: x }, { t: "range" }, { t: "num", n: y });
        if (c) tokens.push({ t: "year", y: fullYear(+c) });
      } else if (x > 12) {
        // "27/28/29" is a list of days.
        tokens.push({ t: "num", n: x }, { t: "num", n: y });
        if (c && c.length === 2) tokens.push({ t: "num", n: +c });
        else if (c) tokens.push({ t: "year", y: +c });
      } else {
        tokens.push({ t: "date", m: x, d: y, y: c ? fullYear(+c) : undefined });
      }
    } else if (mon) tokens.push({ t: "month", m: MONTHS[mon] });
    else if (year) tokens.push({ t: "year", y: +year });
    else if (num) tokens.push({ t: "num", n: +num });
    else if (dash) tokens.push({ t: "range" });
  }

  // Turn tokens into dates.
  const items: Item[] = [];
  let month: number | null = null;
  let pendingDays: number[] = [];
  let range = false;
  let yearFrom = 0; // items from this index still need a year

  const push = (it: Item) => {
    if (range && items.length) it.rangeFromPrev = true;
    range = false;
    items.push(it);
  };

  for (const tk of tokens) {
    if (tk.t === "month") {
      month = tk.m;
      if (pendingDays.length) { for (const d of pendingDays) push({ m: tk.m, d }); pendingDays = []; }
    } else if (tk.t === "num") {
      if (tk.n < 1 || tk.n > 31) { doubt = true; continue; }
      if (month) push({ m: month, d: tk.n });
      else pendingDays.push(tk.n);
    } else if (tk.t === "date") {
      if (tk.m < 1 || tk.m > 12) { doubt = true; continue; }
      month = tk.m;
      push({ m: tk.m, d: tk.d, y: tk.y });
      if (tk.y) yearFrom = items.length;
    } else if (tk.t === "year") {
      range = false; // "October 23-2026" isn't a range
      if (tk.y < refYear - 1 || tk.y > refYear + 2) { doubt = true; yearFrom = items.length; continue; }
      for (let i = yearFrom; i < items.length; i++) if (!items[i].y) items[i].y = tk.y;
      yearFrom = items.length;
    } else if (tk.t === "range") {
      if (items.length || pendingDays.length) range = true;
    }
  }
  if (pendingDays.length) doubt = true;

  // Missing years: the first date on or after about a month before submitting.
  const floor = new Date(ref.getTime() - 31 * 86400000);
  const floorIso = iso(floor.getFullYear(), floor.getMonth() + 1, floor.getDate());
  for (const it of items) {
    if (it.y) continue;
    it.guessedYear = true;
    it.y = iso(refYear, it.m, it.d) >= floorIso ? refYear : refYear + 1;
  }

  const out = new Set<string>();
  items.forEach((it, i) => {
    if (!validDay(it.y!, it.m, it.d)) { doubt = true; return; }
    if (it.rangeFromPrev && i > 0) {
      const prev = items[i - 1];
      const start = Date.UTC(prev.y!, prev.m - 1, prev.d);
      let end = Date.UTC(it.y!, it.m - 1, it.d);
      // "Dec 30 - Jan 2" without years: the end rolls into next year.
      if (end < start && it.guessedYear) end = Date.UTC(it.y! + 1, it.m - 1, it.d);
      const days = Math.round((end - start) / 86400000);
      if (days < 0 || days > 31) { doubt = true; }
      else for (let k = 1; k <= days; k++) {
        const dt = new Date(start + k * 86400000);
        out.add(iso(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate()));
      }
    }
    out.add(iso(it.y!, it.m, it.d));
  });

  const dates = Array.from(out).sort();
  if (dates.length === 0) doubt = true;
  // Far from when it was asked for: probably misread.
  const maxIso = iso(refYear + 1, ref.getMonth() + 1, ref.getDate());
  if (dates.some((d) => d < floorIso || d > maxIso)) doubt = true;

  return { dates, confident: !doubt };
}

/** "Monday, Oct 13 – Wednesday, Oct 15, 2026; Friday, Oct 17, 2026" for the printed form. */
export function describeDates(dates: string[]): string {
  const sorted = Array.from(new Set(dates)).sort();
  if (sorted.length === 0) return "";
  const groups: string[][] = [];
  for (const d of sorted) {
    const last = groups[groups.length - 1];
    if (last && (Date.parse(d) - Date.parse(last[last.length - 1])) === 86400000) last.push(d);
    else groups.push([d]);
  }
  const fmt = (d: string, withYear: boolean) => new Date(`${d}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "long", month: "short", day: "numeric", ...(withYear ? { year: "numeric" } : {}),
  });
  return groups.map((g) => g.length === 1 ? fmt(g[0], true) : `${fmt(g[0], g[0].slice(0, 4) !== g[g.length - 1].slice(0, 4))} – ${fmt(g[g.length - 1], true)}`).join("; ");
}
