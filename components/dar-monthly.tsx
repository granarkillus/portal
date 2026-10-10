"use client";

// DARs page → "Monthly totals": how many DARs each officer turned in for a month.

import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { C, btnStyle } from "@/lib/theme";
import { fmtDate } from "@/lib/format";
import { monthTotals, monthRange, monthLabel, totalsDocument, OfficerTotal } from "@/lib/dar-totals";
import { Skeleton } from "@/components/feedback";
import Icon from "@/components/icon";

const thisMonth = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" }).slice(0, 7);

/** The current month and the 11 before it, newest first. */
function recentMonths(): string[] {
  const [y, m] = thisMonth().split("-").map(Number);
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}

export default function DarMonthly() {
  const months = recentMonths();
  const [ym, setYm] = useState(months[0]);
  const [roster, setRoster] = useState<string[] | null>(null);
  const [totals, setTotals] = useState<OfficerTotal[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getSupabase().from("officers").select("full_name").then(({ data }) => setRoster((data || []).map((o: { full_name: string }) => o.full_name)));
  }, []);

  useEffect(() => {
    if (!roster) return;
    setTotals(null); setOpen(null); setError("");
    const [from, to] = monthRange(ym);
    getSupabase().from("dar_submissions").select("officer_name, date").gte("date", from).lte("date", to).limit(5000)
      .then(({ data, error: e }) => {
        if (e) { setError("Couldn't load DARs. Check your connection and try again."); setTotals([]); return; }
        setTotals(monthTotals((data || []) as { officer_name: string; date: string }[], roster));
      });
  }, [ym, roster]);

  const sum = (totals || []).reduce((n, t) => n + t.count, 0);
  const max = Math.max(1, ...(totals || []).map((t) => t.count));
  const inProgress = ym === thisMonth();
  const asOf = inProgress ? fmtDate(new Date().toISOString()) : undefined;

  const print = () => {
    if (!totals) return;
    const win = window.open("", "_blank");
    if (win) { win.document.write(totalsDocument([{ ym, totals, asOf }])); win.document.close(); win.onload = () => { win.focus(); win.print(); }; }
  };

  return (
    <div style={{ background: C.white, border: `1px solid ${C.border}`, borderTop: "none", borderRadius: "0 0 16px 16px", overflow: "hidden" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "center", padding: "1rem 1.25rem", borderBottom: `1px solid ${C.border}` }}>
        <select value={ym} onChange={(e) => setYm(e.target.value)} aria-label="Month" style={{ flex: "1 1 200px", padding: "0.5rem 0.75rem", border: `1px solid ${C.border}`, borderRadius: 12, color: C.text, background: C.white, fontFamily: "inherit", fontWeight: 600 }}>
          {months.map((m) => <option key={m} value={m}>{monthLabel(m)}{m === months[0] ? " (so far)" : ""}</option>)}
        </select>
        <div style={{ fontSize: "0.9rem", color: C.muted }}>
          {totals ? <><strong style={{ color: C.text }}>{sum}</strong> DARs · <strong style={{ color: C.text }}>{totals.length}</strong> officers</> : "…"}
        </div>
        <button onClick={print} disabled={!totals || totals.length === 0} style={{ ...btnStyle(C.navy), width: "auto", padding: "0.55rem 1.1rem", fontSize: "0.88rem", display: "inline-flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>
          <Icon name="printer" size={15} />Print list
        </button>
      </div>

      {error && <div style={{ margin: "1rem 1.25rem 0", background: C.redTint, border: `1px solid ${C.redLine}`, borderRadius: 12, padding: "0.6rem 1rem", fontSize: "0.85rem", color: C.red }}>{error}</div>}

      {!totals ? <Skeleton rows={6} card={false} /> : totals.length === 0 ? (
        <div style={{ padding: "2rem", textAlign: "center", color: C.muted }}>No DARs for {monthLabel(ym)}.</div>
      ) : (
        <div>
          {totals.map((t, i) => {
            const isOpen = open === t.name;
            return (
              <div key={t.name} style={{ borderTop: i ? `1px solid ${C.border}` : "none" }}>
                <button onClick={() => setOpen(isOpen ? null : t.name)} aria-expanded={isOpen} style={{ width: "100%", display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.7rem 1.25rem", background: isOpen ? C.softBg : C.white, border: "none", textAlign: "left", fontFamily: "inherit" }}>
                  <span style={{ width: 22, color: C.faint, fontSize: "0.85rem", fontVariantNumeric: "tabular-nums" }}>{i + 1}</span>
                  <span style={{ flex: "1 1 auto", minWidth: 0 }}>
                    <span style={{ display: "block", fontWeight: 700, color: C.text, fontSize: "0.95rem" }}>{t.name}</span>
                    <span style={{ display: "block", height: 6, marginTop: 5, borderRadius: 99, background: C.navyTint, overflow: "hidden" }}>
                      <span style={{ display: "block", height: "100%", width: `${(t.count / max) * 100}%`, background: C.navy, borderRadius: 99 }} />
                    </span>
                  </span>
                  <span style={{ fontWeight: 800, fontSize: "1.05rem", color: C.text, minWidth: 32, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{t.count}</span>
                </button>
                {isOpen && (
                  <div style={{ padding: "0 1.25rem 0.9rem 3.3rem", background: C.softBg }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {t.dates.map((d, j) => <span key={j} style={{ fontSize: "0.8rem", background: C.white, border: `1px solid ${C.border}`, borderRadius: 999, padding: "2px 9px", color: C.slate }}>{fmtDate(d)}</span>)}
                    </div>
                    {t.typedAs.length > 0 && <div style={{ fontSize: "0.8rem", color: C.muted, marginTop: 8 }}>Also typed as: {t.typedAs.map((s) => `“${s}”`).join(", ")}</div>}
                  </div>
                )}
              </div>
            );
          })}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "0.75rem 1.25rem", borderTop: `1.5px solid ${C.text}`, fontWeight: 700, color: C.text }}>
            <span>Total{inProgress ? ` (through ${asOf})` : ""}</span><span>{sum}</span>
          </div>
        </div>
      )}
    </div>
  );
}
