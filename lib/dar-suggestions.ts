// Tap-to-fill phrases for DAR activity entries. Each "___" is a blank the
// officer must fill (a place, a person, a number), so every line carries at
// least one real detail and nobody can submit a line they didn't write.

export const BLANK = "___";

export const PHRASES = {
  start: [
    "Began shift, received radio, keys and pass-down from ___",
    "Arrived on post at ___, checked in with ___",
    "Began shift, tested radio and checked equipment, all working",
  ],
  patrol: [
    "Patrolled ___, all doors and gates secure",
    "Completed interior patrol of ___, no issues found",
    "Completed exterior perimeter patrol of ___, all clear",
    "Foot patrol of ___, area quiet, no suspicious activity",
    "Walked ___ and checked lighting, all lights working",
    "Patrolled ___ parking area, ___ vehicles, nothing suspicious",
  ],
  monitor: [
    "Monitored cameras for ___, no suspicious activity observed",
    "Posted at ___, monitored foot traffic, no issues",
    "Monitored ___ entrance, checked IDs of ___ visitors",
  ],
  check: [
    "Checked exterior doors at ___, all locked and secure",
    "Checked ___ for unauthorized persons, none found",
    "Checked fire exits and extinguishers at ___, all clear",
    "Checked stairwells in ___, all clear",
  ],
  people: [
    "Assisted ___ with ___",
    "Gave directions to visitor at ___",
    "Escorted ___ to ___",
    "Radio check with ___, all good",
  ],
  report: [
    "Observed ___ at ___, reported to supervisor",
    "Reported ___ at ___ to WUPD",
    "Found ___ at ___, secured it and notified ___",
  ],
  break: ["Break, post covered by ___", "Lunch break, post covered by ___"],
  end: [
    "Final patrol of ___, all secure, pass-down to ___",
    "Ended shift, returned radio and keys, all secure",
  ],
};

export type PhraseGroup = keyof typeof PHRASES;

// Places to drop into a blank. Post-specific places first, then general ones.
const GENERAL_PLACES = [
  "main entrance", "lobby", "parking garage", "parking lot", "perimeter", "stairwells",
  "hallways", "loading dock", "exterior doors", "walkway", "elevators", "mail room",
];

const POST_PLACES: [RegExp, string[]][] = [
  [/loft/i, ["The Lofts lobby", "Lofts garage", "Lofts perimeter", "Lofts stairwells", "Enright entrance"]],
  [/ackert/i, ["Ackert Walkway", "walkway lighting", "Ackert entrance"]],
  [/greenway/i, ["Greenway Walk", "Greenway path", "Greenway lighting"]],
  [/west/i, ["West Campus garage", "main building", "West Campus parking lot", "main building hallways"]],
  [/north/i, ["North Campus parking lot", "North Campus building", "North Campus perimeter"]],
  [/south/i, ["South Campus building", "South Campus parking lot", "South Campus perimeter"]],
  [/mcpherson/i, ["McPherson building", "McPherson entrance"]],
  [/core/i, ["Core building", "Core entrance"]],
];

export const PEOPLE = ["supervisor", "WUPD", "relief officer", "resident", "student", "staff member", "visitor", "maintenance"];

export function placesFor(post: string): string[] {
  const specific = POST_PLACES.filter(([re]) => re.test(post || "")).flatMap(([, list]) => list);
  return Array.from(new Set([...specific, ...GENERAL_PLACES]));
}

// Small seeded shuffle so each entry shows a different mix, and "More ideas"
// gives a fresh set.
function shuffled<T>(list: T[], seed: number): T[] {
  const out = list.slice();
  let s = seed * 9301 + 49297;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** About 6 suggestions for one entry: shift start/end phrases on the first
 *  and last entries, a mix of groups otherwise, skipping ones already used. */
export function suggestionsFor(index: number, total: number, seed: number, used: string[]): string[] {
  const groups: PhraseGroup[] = index === 0
    ? ["start", "patrol", "check"]
    : index === total - 1
      ? ["end", "patrol", "check", "monitor"]
      : ["patrol", "monitor", "check", "people", "report", "break"];
  const picks: string[] = [];
  const pools = groups.map((g, gi) => shuffled(PHRASES[g], seed + index * 7 + gi).filter((p) => !used.includes(p)));
  // Round-robin across groups so the mix varies.
  for (let round = 0; picks.length < 6 && round < 6; round++) {
    for (const pool of pools) if (pool[round] && picks.length < 6) picks.push(pool[round]);
  }
  return picks;
}

// ---- Validation --------------------------------------------------------

const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
const isBreak = (s: string) => /\b(break|lunch|dinner|meal)\b/i.test(s);

export function entryProblem(e: { from: string; to: string; activity: string }): string | null {
  const a = e.activity.trim();
  if (!e.from.trim() || !e.to.trim()) return "Add the From and To times";
  if (!a) return "Describe what you did";
  if (a.includes(BLANK)) return "Fill in the blank (___)";
  const words = wordCount(a);
  // One-word lines ("Clear", "Patrol", "Secured") are never enough.
  if (words < 2) return "One word isn't enough. Tap an idea below to build a full entry, or describe what you did (at least 4 words)";
  if (!isBreak(a) && words < 4) return "Too short. Tap an idea below, or add where you were and what you checked (at least 4 words)";
  return null;
}

export const MIN_ENTRIES = 4;

// ---- Shift times -------------------------------------------------------

/** "18:00" or "1800" -> minutes after midnight. */
export function toMinutes(t: string): number | null {
  const m = (t || "").trim().match(/^(\d{1,2}):?(\d{2})$/);
  if (!m) return null;
  const h = +m[1], min = +m[2];
  if (h > 24 || min > 59) return null;
  return (h % 24) * 60 + min;
}

export const hhmm = (mins: number) => {
  const m = ((mins % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}${String(m % 60).padStart(2, "0")}`;
};

/** Splits the shift into time blocks: 4 blocks for up to 8 hours, then
 *  about one block per 2 hours (max 8). Overnight shifts wrap past midnight. */
export function shiftBlocks(start: string, end: string): { from: string; to: string }[] {
  const s = toMinutes(start), e0 = toMinutes(end);
  if (s === null || e0 === null) return [];
  let e = e0;
  if (e <= s) e += 1440;
  const dur = e - s;
  const n = Math.min(8, Math.max(MIN_ENTRIES, Math.round(dur / 120)));
  const step = Math.max(15, Math.round(dur / n / 15) * 15);
  return Array.from({ length: n }, (_, i) => ({
    from: hhmm(s + i * step),
    to: i === n - 1 ? hhmm(e) : hhmm(s + (i + 1) * step),
  }));
}

/**
 * Tidies a typed entry time into the paper form's 24-hour "HHMM".
 * Clear cases convert directly ("10pm" -> 2200, "7:45 am" -> 0745, "1830" stays).
 * Ambiguous ones ("745", "7:45", "7") are settled by the shift: whichever of
 * AM/PM falls inside the shift wins. If the shift doesn't settle it, or the
 * text isn't a time, it's returned unchanged.
 */
export function normalizeTime(raw: string, shiftStart: string, shiftEnd: string): string {
  const t = raw.trim().toLowerCase().replace(/\s+/g, " ");
  if (!t) return raw;

  // With am/pm: exact.
  let m = t.match(/^(\d{1,2})(?:[:.]? ?(\d{2}))? ?([ap])\.? ?m?\.?$/);
  if (m) {
    let h = +m[1];
    const min = m[2] ? +m[2] : 0;
    if (h < 1 || h > 12 || min > 59) return raw;
    if (m[3] === "a") h = h === 12 ? 0 : h;
    else h = h === 12 ? 12 : h + 12;
    return hhmm(h * 60 + min);
  }

  // Four digits is already military time ("0745", "1830", "2400").
  if (/^\d{4}$/.test(t)) {
    const h = +t.slice(0, 2), min = +t.slice(2);
    return h <= 24 && min <= 59 ? t : raw;
  }

  // "19:45" is clear; "7:45", "745" and "7" need the shift to decide.
  m = t.match(/^(\d{1,2})(?:[:.] ?(\d{2}))?$/) || t.match(/^(\d)(\d{2})$/);
  if (!m) return raw;
  const h = +m[1], min = m[2] ? +m[2] : 0;
  if (h > 24 || min > 59) return raw;
  if (h === 0 || h >= 13) return hhmm(h * 60 + min);

  const s = toMinutes(shiftStart), e0 = toMinutes(shiftEnd);
  if (s === null || e0 === null) return raw;
  const e = e0 <= s ? e0 + 1440 : e0;
  const inShift = (mins: number) => [mins, mins + 1440].some((x) => x >= s && x <= e);
  const am = (h % 12) * 60 + min;
  const pm = am + 720;
  const okAm = inShift(am), okPm = inShift(pm);
  if (okAm && !okPm) return hhmm(am);
  if (okPm && !okAm) return hhmm(pm);
  return raw;
}
