"use client";

// Shared building blocks for the officer forms, so every form looks and
// behaves like the call-off form: one header style, sentence-case labels,
// tap buttons instead of tiny checkboxes, and a Submit bar that stays on screen.

import { useState } from "react";
import { C } from "@/lib/theme";
import Icon from "@/components/icon";

export { C };

export const SUPERVISORS = ["Markham Gartley", "Shawn Furlow", "Justin Barnes"];

/** Page frame: gradient header with the form's title, white card, footer note. */
export function FormShell({ title, subtitle, children, footer, bar }: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: string;
  bar?: React.ReactNode; // sticky bottom bar (Submit)
}) {
  return (
    <div style={{ minHeight: "100vh", background: C.softBg, fontFamily: "var(--font-sans)", padding: "1rem 0.75rem 0" }}>
      <div style={{ maxWidth: 640, margin: "0 auto", background: C.white, borderRadius: 16, boxShadow: "0 10px 30px rgba(15,23,42,0.08), 0 1px 3px rgba(15,23,42,0.06)", overflow: "clip" }}>
        <div style={{ background: "linear-gradient(135deg, #0f2d57 0%, #1d4f91 100%)", padding: "1.25rem 1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ color: C.white, fontSize: "0.95rem", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Allied<span style={{ fontWeight: 300 }}>Universal</span><sup style={{ fontSize: "0.5rem", fontWeight: 300, marginLeft: 1 }}>™</sup>
            </div>
            <a href="/forms" style={{ color: "rgba(255,255,255,0.85)", fontSize: "0.85rem", textDecoration: "none", fontWeight: 600 }}>‹ All forms</a>
          </div>
          <div style={{ color: C.white, fontSize: "1.5rem", fontWeight: 700, marginTop: "0.6rem", lineHeight: 1.2 }}>{title}</div>
          {subtitle && <div style={{ color: "rgba(255,255,255,0.8)", fontSize: "0.95rem", marginTop: 4, lineHeight: 1.4 }}>{subtitle}</div>}
        </div>
        <div style={{ padding: "0.25rem 1.25rem 1.5rem" }}>{children}</div>
        {bar}
      </div>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "1rem 0.5rem 2rem", fontSize: "0.8rem", color: C.muted, textAlign: "center", lineHeight: 1.5 }}>
        {footer || "Allied Universal Security Services · Washington University"}
      </div>
    </div>
  );
}

export function Section({ title, subtitle, children, id }: { title: string; subtitle?: string; children: React.ReactNode; id?: string }) {
  return (
    <div id={id} style={{ marginTop: "1.75rem" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem", marginBottom: "0.9rem" }}>
        <div style={{ fontSize: "1.15rem", fontWeight: 700, color: C.text }}>{title}</div>
        {subtitle && <div style={{ fontSize: "0.85rem", color: C.muted }}>{subtitle}</div>}
      </div>
      {children}
    </div>
  );
}

export function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: "0.95rem", fontWeight: 600, color: C.slate, marginBottom: 8 }}>{children}</div>;
}
export function Req() { return <span style={{ color: C.red }} aria-label="required"> *</span>; }
export function Optional() { return <span style={{ color: C.muted, fontWeight: 400, fontSize: "0.85rem" }}> (optional)</span>; }
export function FieldError({ msg }: { msg?: string | false | null }) {
  if (!msg) return null;
  return <div style={{ color: C.red, fontSize: "0.88rem", fontWeight: 600, marginTop: 6 }}>{msg}</div>;
}

export function inputStyle(hasError = false): React.CSSProperties {
  return { width: "100%", boxSizing: "border-box", padding: "0.75rem 0.9rem", border: `1.5px solid ${hasError ? C.red : C.border}`, borderRadius: 12, fontSize: "1rem", color: C.text, background: C.white, fontFamily: "inherit" };
}

export function TextField({ label, value, onChange, required, optional, placeholder, error, type = "text", inputMode, id, autoComplete }: {
  label: string; value: string; onChange: (v: string) => void;
  required?: boolean; optional?: boolean; placeholder?: string; error?: string | false | null;
  type?: string; inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"]; id?: string; autoComplete?: string;
}) {
  return (
    <div id={id} style={{ marginBottom: "1.25rem" }}>
      <Label>{label}{required && <Req />}{optional && <Optional />}</Label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} inputMode={inputMode} autoComplete={autoComplete} style={inputStyle(!!error)} />
      <FieldError msg={error} />
    </div>
  );
}

export const chipWrap: React.CSSProperties = { display: "flex", flexWrap: "wrap", gap: "0.5rem" };

export function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      style={{
        minHeight: 46, padding: "0.55rem 1rem", borderRadius: 999, fontFamily: "inherit", fontSize: "0.95rem", fontWeight: 600, cursor: "pointer",
        border: `1.5px solid ${selected ? C.navy : C.border}`, background: selected ? C.navy : C.white, color: selected ? C.white : C.text,
        boxShadow: selected ? "0 2px 8px rgba(26,68,128,0.25)" : "none",
      }}
    >
      {selected && "✓ "}{children}
    </button>
  );
}

/**
 * Tap-to-pick from a list, with an "Other" button that opens a text box.
 * Used for posts, supervisors, managers and position titles.
 */
export function ChoiceField({ label, options, value, onChange, required, optional, error, otherLabel = "Other", otherPlaceholder = "Type it", id }: {
  label: string; options: string[]; value: string; onChange: (v: string) => void;
  required?: boolean; optional?: boolean; error?: string | false | null; otherLabel?: string; otherPlaceholder?: string; id?: string;
}) {
  const inList = options.some((o) => o.toLowerCase() === value.trim().toLowerCase());
  const [other, setOther] = useState(!!value && !inList);
  const showOther = other || (!!value && !inList);
  return (
    <div id={id} style={{ marginBottom: "1.25rem" }}>
      <Label>{label}{required && <Req />}{optional && <Optional />}</Label>
      <div style={chipWrap}>
        {options.map((o) => (
          <Chip key={o} selected={!showOther && value.trim().toLowerCase() === o.toLowerCase()} onClick={() => { setOther(false); onChange(value === o ? "" : o); }}>{o}</Chip>
        ))}
        <Chip selected={showOther} onClick={() => { setOther(true); if (inList) onChange(""); }}>{otherLabel}</Chip>
      </div>
      {showOther && (
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={otherPlaceholder} style={{ ...inputStyle(!!error), marginTop: "0.6rem" }} autoFocus={other && !value} />
      )}
      <FieldError msg={error} />
    </div>
  );
}

/** "Washington University · Saint Louis   Edit": fixed details shown as one line. */
export function FixedLine({ text, editing, onToggle }: { text: string; editing: boolean; onToggle: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.9rem", color: C.muted, marginBottom: "1rem" }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Icon name="pin" size={15} />{text}</span>
      <button type="button" onClick={onToggle} style={{ background: "none", border: "none", padding: 0, minHeight: 0, color: C.navy, fontWeight: 700, textDecoration: "underline", cursor: "pointer", fontFamily: "inherit", fontSize: "0.88rem" }}>{editing ? "Done" : "Edit"}</button>
    </div>
  );
}

/** One-tap signature: ticking the box signs with the officer's name. */
export function SignBox({ name, signed, onChange, error, id = "sign-box", statement }: {
  name: string; signed: boolean; onChange: (signed: boolean) => void; error?: boolean; id?: string; statement?: React.ReactNode;
}) {
  const n = name.trim();
  return (
    <div id={id}>
      <label style={{ display: "flex", gap: "0.85rem", alignItems: "flex-start", cursor: n ? "pointer" : "default", border: `1.5px solid ${error ? C.red : signed ? C.navy : C.border}`, background: signed ? C.navyTint : C.white, borderRadius: 12, padding: "1rem" }}>
        <input type="checkbox" checked={signed} disabled={!n} onChange={(e) => onChange(e.target.checked)} style={{ width: 24, height: 24, marginTop: 1, accentColor: C.navy, flexShrink: 0 }} />
        <span style={{ fontSize: "0.95rem", color: C.text, lineHeight: 1.5 }}>
          {statement && <span style={{ display: "block", marginBottom: 4 }}>{statement}</span>}
          {n ? <>Sign as <strong>{n}</strong></> : <span style={{ color: C.muted }}>Enter your name above to sign</span>}
          {signed && <span style={{ display: "block", marginTop: 4, color: C.muted, fontSize: "0.85rem" }}>Signed: <em style={{ fontFamily: "Georgia, serif", color: C.text }}>{n}</em></span>}
        </span>
      </label>
    </div>
  );
}

/** Submit bar that stays at the bottom of the screen. */
export function StickyBar({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: "sticky", bottom: 0, background: "rgba(255,255,255,0.97)", borderTop: `1px solid ${C.border}`, padding: "0.85rem 1.25rem calc(0.85rem + env(safe-area-inset-bottom))", backdropFilter: "blur(6px)", zIndex: 5 }}>
      {children}
    </div>
  );
}

export function PrimaryButton({ onClick, disabled, children, color = C.navy }: { onClick: () => void; disabled?: boolean; children: React.ReactNode; color?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} style={{ width: "100%", minHeight: 54, background: disabled ? C.faint : color, color: C.white, border: "none", borderRadius: 12, fontSize: "1.05rem", fontWeight: 700, fontFamily: "inherit", cursor: disabled ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
      {children}
    </button>
  );
}

export function MissingNote({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div style={{ fontSize: "0.88rem", color: C.red, fontWeight: 600, marginBottom: "0.6rem", textAlign: "center", lineHeight: 1.4 }}>
      {items.length === 1 ? `Still needed: ${items[0]}` : `Still needed: ${items.join(", ")}`}
    </div>
  );
}

/** Today in St. Louis as YYYY-MM-DD (for date inputs). */
export const todayIso = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });

/** Success screen used after submitting. */
export function DoneCard({ title, children, tone = "ok" }: { title: string; children: React.ReactNode; tone?: "ok" | "wait" }) {
  return (
    <div style={{ minHeight: "100vh", background: C.softBg, fontFamily: "var(--font-sans)", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem 1rem" }}>
      <div style={{ maxWidth: 480, width: "100%", background: C.white, borderRadius: 16, boxShadow: "0 10px 30px rgba(15,23,42,0.08), 0 1px 3px rgba(15,23,42,0.06)", overflow: "hidden", textAlign: "center" }}>
        <div style={{ background: "linear-gradient(135deg, #0f2d57 0%, #1d4f91 100%)", padding: "1.1rem 1.5rem", color: C.white, fontSize: "0.95rem", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase" }}>
          Allied<span style={{ fontWeight: 300 }}>Universal</span><sup style={{ fontSize: "0.5rem", fontWeight: 300 }}>™</sup>
        </div>
        <div style={{ padding: "2rem 1.5rem" }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: tone === "ok" ? C.greenTint : C.orangeTint, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem", fontSize: "1.5rem" }}>
            {tone === "ok"
              ? <Icon name="check" size={28} color={C.greenDark} strokeWidth={2.5} />
              : <Icon name="clock" size={28} color={C.orange} />}
          </div>
          <div style={{ fontSize: "1.2rem", fontWeight: 700, color: C.text, marginBottom: 8 }}>{title}</div>
          {children}
        </div>
      </div>
    </div>
  );
}

export const outlineButton: React.CSSProperties = {
  display: "block", width: "100%", boxSizing: "border-box", textAlign: "center", textDecoration: "none", background: C.white,
  color: C.navy, border: `1.5px solid ${C.navy}`, borderRadius: 12, padding: "0.8rem 1rem", fontWeight: 700, fontSize: "0.98rem", fontFamily: "inherit", cursor: "pointer",
};
