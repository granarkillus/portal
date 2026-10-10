// Officers type their own names on the DAR, so the same person shows up as
// "Almonte Criss", "Almonte Criss ", "angela s", "Daniel b carr", etc.
// matchOfficer() maps a typed name to the officer roster's spelling.

/** Lowercase name parts, accents and punctuation stripped, single letters (middle initials) dropped. */
function parts(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/ı/g, "i")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .split(/[^a-z]+/)
    .filter((p) => p.length > 1);
}

function editDistance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]++;
    for (let j = 1; j <= b.length; j++) {
      const cur = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
  }
  return row[b.length];
}

// Other names an officer has used (e.g. maiden names), keyed by letters only.
const ALIASES: Record<string, string> = {
  tamaramarble: "Tamara Nelson",
};

/** "  almonte   criss " → "Almonte Criss" */
export function tidyName(s: string): string {
  return s.trim().replace(/\s+/g, " ").replace(/(^|[\s-])(\S)/g, (m) => m.toUpperCase());
}

/**
 * Returns a function mapping a typed name to the roster spelling. A name is
 * only merged when exactly one officer fits, so unclear names stay separate.
 */
export function makeOfficerMatcher(roster: string[]): (typed: string) => string {
  const offs = roster.map((name) => {
    const p = parts(name);
    return { name, p, key: p.join(""), first: p[0] || "", last: p[p.length - 1] || "" };
  });
  const only = <T,>(xs: T[]) => (xs.length === 1 ? xs[0] : null);

  return (typed: string) => {
    const p = parts(typed);
    if (p.length === 0) return tidyName(typed);
    const key = p.join("");
    const first = p[0], last = p[p.length - 1];

    if (ALIASES[key]) return ALIASES[key];

    // Same letters, ignoring spaces, case and punctuation ("Martinezbates", "Ta’Lor nixon")
    const exact = only(offs.filter((o) => o.key === key));
    if (exact) return exact.name;

    // Short or partial forms: "Josh Lawson", "Angela S", "Damian Micheal Black", "Soreal"
    const pre = (a: string, b: string) => a.startsWith(b) || b.startsWith(a);
    const partial = only(offs.filter((o) => pre(o.first, first) && (p.length === 1 || o.p.slice(1).some((x) => pre(x, last)))));
    if (partial) return partial.name;

    // Small typo in the last name: "Soreal Gtay", "Ibrahim Hssan"
    if (p.length > 1) {
      const typo = only(offs.filter((o) => o.first === first && editDistance(last, o.last) <= 2));
      if (typo) return typo.name;
    }

    // Last name only ("S/O Fenton")
    if (p.length === 1) {
      const byLast = only(offs.filter((o) => o.last === first));
      if (byLast) return byLast.name;
    }

    return tidyName(typed);
  };
}
