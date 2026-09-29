// app/api/notify-calloff/route.ts  (calloff repo)
//
// Fired by a Supabase Database Webhook whenever a row is inserted into
// calloff_submissions. Sends an email notification via Resend.
//
// Required Vercel environment variables (calloff project):
//   WEBHOOK_SECRET   any long random string; must match the header set in Supabase
//   RESEND_API_KEY   from resend.com
//   NOTIFY_FROM      e.g. "AUS Call-Offs <calloffs@xing.wtf>" (domain must be verified in Resend)
// Optional:
//   NOTIFY_EMAILS    comma-separated override; if unset, uses DEFAULT_RECIPIENTS below

import { NextRequest, NextResponse } from "next/server";

// Who gets the call-off email. Set NOTIFY_EMAILS in Vercel to override
// without editing code.
const DEFAULT_RECIPIENTS = ["mlgartley@aol.com"];

interface CallOffRecord {
  id: string;
  officer_name: string;
  employee_number: string | null;
  post: string;
  shift_date: string;
  shift_start: string;
  shift_end: string | null;
  notice_type: string;
  reason: string;
  coverage_found: boolean | null;
  coverage_name: string | null;
  comments: string | null;
  document_url: string | null;
  submitted_at: string;
}

function esc(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("T")[0].split("-");
  return y && m && d ? `${m}/${d}/${y}` : iso;
}

function formatSubmitted(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso || "";
  return (
    d.toLocaleString("en-US", {
      timeZone: "America/Chicago",
      month: "numeric",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }) + " CT"
  );
}

async function sendEmail(r: CallOffRecord) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.NOTIFY_FROM;
  const envList = (process.env.NOTIFY_EMAILS || "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
  const to = envList.length > 0 ? envList : DEFAULT_RECIPIENTS;

  if (!key || !from || to.length === 0) return "skipped";

  const lateNotice = /less than 4/i.test(r.notice_type || "");
  const shift = `${r.shift_start}${r.shift_end ? ` – ${r.shift_end}` : ""}`;
  const coverage = r.coverage_found
    ? `Yes${r.coverage_name ? ` (${r.coverage_name})` : ""}`
    : "No";

  const rows: [string, string][] = [
    ["Officer", r.officer_name],
    ["Employee #", r.employee_number || ""],
    ["Post", r.post],
    ["Date of absence", formatDate(r.shift_date)],
    ["Shift", shift],
    ["Notice type", r.notice_type],
    ["Reason", r.reason],
    ["Coverage found", coverage],
    ["Comments", r.comments || ""],
    ["Documentation", r.document_url ? "Attached" : "None"],
    ["Submitted", formatSubmitted(r.submitted_at)],
  ];

  const html = `
<div style="font-family:Helvetica,Arial,sans-serif;max-width:560px;color:#1a1a2e;">
  <div style="background:#1f4e79;color:#fff;padding:14px 18px;font-weight:700;font-size:15px;">
    Call-Off Submitted${lateNotice ? " &mdash; LESS THAN 4 HOURS NOTICE" : ""}
  </div>
  <table style="width:100%;border-collapse:collapse;font-size:14px;">
    ${rows
      .filter(([, v]) => v)
      .map(
        ([k, v]) => `<tr>
      <td style="padding:7px 18px;border-bottom:1px solid #e5e7eb;color:#6b7280;width:38%;">${esc(k)}</td>
      <td style="padding:7px 18px;border-bottom:1px solid #e5e7eb;font-weight:600;">${esc(v)}</td>
    </tr>`
      )
      .join("")}
  </table>
  <div style="padding:14px 18px;">
    <a href="https://portal.xing.wtf/supervisor/calloffs" style="background:#1f4e79;color:#fff;text-decoration:none;padding:9px 16px;border-radius:4px;font-weight:700;font-size:13px;">
      Review in Supervisor Portal
    </a>
  </div>
  <div style="padding:0 18px 14px;font-size:11px;color:#6b7280;">
    Automated notice from the AUS call-off system &middot; Washington University
  </div>
</div>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject: `${lateNotice ? "[<4 HR] " : ""}Call-Off: ${r.officer_name} – ${formatDate(r.shift_date)} (${r.post})`,
      html,
    }),
  });

  return res.ok ? "sent" : `failed (${res.status}: ${await res.text()})`;
}

export async function POST(req: NextRequest) {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret || req.headers.get("x-webhook-secret") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let payload: { type?: string; table?: string; record?: CallOffRecord };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "bad payload" }, { status: 400 });
  }

  if (payload.type !== "INSERT" || !payload.record) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const r = payload.record;

  let email: string;
  try {
    email = await sendEmail(r);
  } catch (err) {
    email = `error: ${err instanceof Error ? err.message : String(err)}`;
  }

  console.log("calloff notify", r.id, email);
  return NextResponse.json({ ok: true, email });
}
