"use client";

// Hour-only time picker. Shifts start on the hour, so officers pick from one
// list of 24 ("6 PM · 1800") instead of spinning a minutes wheel. The value is
// "HH:00", the same format the old time inputs produced.

const HOURS = Array.from({ length: 24 }, (_, h) => {
  const label = h === 0 ? "12 AM" : h < 12 ? `${h} AM` : h === 12 ? "12 PM" : `${h - 12} PM`;
  const value = `${String(h).padStart(2, "0")}:00`;
  return { value, label: `${label} · ${String(h).padStart(2, "0")}00` };
});

export default function HourSelect({ value, onChange, style, placeholder = "Pick a time", ariaLabel, optional = false }: {
  value: string;
  onChange: (value: string) => void;
  style?: React.CSSProperties;
  placeholder?: string;
  ariaLabel?: string;
  optional?: boolean; // lets them go back to "no time" after picking one
}) {
  // A saved draft from before this change might hold minutes (e.g. 18:30);
  // keep it selectable rather than silently changing it.
  const extra = value && !HOURS.some((h) => h.value === value) ? [{ value, label: value }] : [];
  return (
    <select
      aria-label={ariaLabel}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        appearance: "none", WebkitAppearance: "none", cursor: "pointer",
        backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%235b6474' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")",
        backgroundRepeat: "no-repeat", backgroundPosition: "right 0.9rem center", paddingRight: "2.4rem",
        color: value ? "#0f172a" : "#94a3b8",
        ...style,
      }}
    >
      <option value="" disabled={!optional}>{placeholder}</option>
      {extra.concat(HOURS).map((h) => <option key={h.value} value={h.value} style={{ color: "#0f172a" }}>{h.label}</option>)}
    </select>
  );
}
