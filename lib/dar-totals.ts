// Monthly DAR counts per officer, with typed-name variants merged.

import { makeOfficerMatcher } from "@/lib/officer-names";

export interface OfficerTotal {
  name: string;
  count: number;
  dates: string[]; // shift dates, oldest first
  typedAs: string[]; // other spellings merged into this name
}

export function monthTotals(rows: { officer_name: string; date: string }[], roster: string[]): OfficerTotal[] {
  const match = makeOfficerMatcher(roster);
  const byName = new Map<string, OfficerTotal>();
  for (const r of rows) {
    const name = match(r.officer_name || "");
    const t = byName.get(name) || { name, count: 0, dates: [], typedAs: [] };
    t.count++;
    t.dates.push(r.date);
    const typed = (r.officer_name || "").trim().replace(/\s+/g, " ");
    if (typed && typed !== name && !t.typedAs.includes(typed)) t.typedAs.push(typed);
    byName.set(name, t);
  }
  return Array.from(byName.values())
    .map((t) => ({ ...t, dates: t.dates.sort() }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** "2026-09" → "September 2026" */
export const monthLabel = (ym: string) => new Date(`${ym}-15T12:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

/** First and last day of a "YYYY-MM" month. */
export function monthRange(ym: string): [string, string] {
  const [y, m] = ym.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return [`${ym}-01`, `${ym}-${String(last).padStart(2, "0")}`];
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

/** Printable page: one table per month. `asOf` notes a month still in progress. */
export function totalsDocument(months: { ym: string; totals: OfficerTotal[]; asOf?: string }[]): string {
  const sections = months.map(({ ym, totals, asOf }) => {
    const sum = totals.reduce((n, t) => n + t.count, 0);
    const rows = totals.map((t, i) => `<tr><td class="n">${i + 1}</td><td>${esc(t.name)}</td><td class="c">${t.count}</td></tr>`).join("");
    return `<section>
      <h2>${monthLabel(ym)}${asOf ? ` <span class="asof">through ${esc(asOf)}</span>` : ""}</h2>
      <table><thead><tr><th class="n">#</th><th>Officer</th><th class="c">DARs</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="3" class="empty">No DARs this month.</td></tr>`}</tbody>
      <tfoot><tr><td></td><td>Total · ${totals.length} officer${totals.length === 1 ? "" : "s"}</td><td class="c">${sum}</td></tr></tfoot></table>
    </section>`;
  }).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>DAR totals by officer</title><style>
    @page { size: letter; margin: 0.6in; }
    body { font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; color: #0f172a; margin: 0; }
    header { border-bottom: 3px solid #1a4480; padding-bottom: 10px; margin-bottom: 18px; display: flex; justify-content: space-between; align-items: flex-end; }
    .brand { font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: #1a4480; font-size: 15px; }
    .brand span { font-weight: 300; }
    h1 { font-size: 20px; margin: 4px 0 0; }
    .meta { font-size: 11px; color: #5b6474; text-align: right; }
    section { break-inside: avoid; margin-bottom: 26px; }
    h2 { font-size: 15px; margin: 0 0 8px; color: #1a4480; }
    .asof { font-weight: 400; color: #5b6474; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
    th { text-align: left; font-size: 10.5px; text-transform: uppercase; letter-spacing: .05em; color: #5b6474; border-bottom: 1.5px solid #0f172a; padding: 5px 8px; }
    td { padding: 5px 8px; border-bottom: 1px solid #dbe2ec; }
    tbody tr:nth-child(even) td { background: #f6f8fb; }
    tfoot td { font-weight: 700; border-top: 1.5px solid #0f172a; border-bottom: none; }
    .n { width: 32px; color: #5b6474; } .c { text-align: right; width: 70px; font-variant-numeric: tabular-nums; }
    .empty { color: #5b6474; text-align: center; padding: 14px; }
    footer { font-size: 10px; color: #5b6474; margin-top: 8px; }
  </style></head><body>
    <header><div><div class="brand">Allied<span>Universal</span></div><h1>DAR totals by officer</h1></div>
    <div class="meta">Washington University<br>Generated ${esc(new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Chicago" }))}</div></header>
    ${sections}
    <footer>Counts are DARs by shift date. Name spellings are matched to the officer roster.</footer>
  </body></html>`;
}
