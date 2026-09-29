import { NextRequest, NextResponse } from "next/server";

// The scanner is used by officers without logging in, so it can't require
// auth. These checks keep other sites and scripts from running up the
// Anthropic bill through it.
const MAX_IMAGE_CHARS = 8_000_000; // ~6 MB image as base64
const RATE_LIMIT = 20;              // scans per IP per hour (per server instance)
const hits = new Map<string, number[]>();

function allowedOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin") || req.headers.get("referer") || "";
  try {
    const host = new URL(origin).hostname;
    return host === req.nextUrl.hostname || host.endsWith(".xing.wtf") || host === "localhost";
  } catch {
    return false;
  }
}

function rateLimited(req: NextRequest): boolean {
  const ip = (req.headers.get("x-forwarded-for") || "unknown").split(",")[0].trim();
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 60 * 60 * 1000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > RATE_LIMIT;
}

export async function POST(req: NextRequest) {
  if (!allowedOrigin(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (rateLimited(req)) {
    return NextResponse.json({ error: "Too many scans. Please try again later." }, { status: 429 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "API key not configured" }, { status: 500 });
  }

  let body: { image: string; mediaType: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { image, mediaType } = body;
  if (!image || !mediaType) {
    return NextResponse.json({ error: "Missing image or mediaType" }, { status: 400 });
  }
  if (typeof image !== "string" || image.length > MAX_IMAGE_CHARS || !/^image\/(jpeg|png|gif|webp)$/.test(mediaType)) {
    return NextResponse.json({ error: "Image too large or unsupported type" }, { status: 400 });
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      messages: [{
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType, data: image }
          },
          {
            type: "text",
            text: `This is an Allied Universal Daily Activity Report form. Extract all filled-in fields and return ONLY a valid JSON object with no preamble, explanation, or markdown code fences. Use exactly these keys:

{
  "officer_name": "",
  "date": "YYYY-MM-DD format if possible, otherwise as written, or empty string",
  "scheduled_shift": "",
  "shift_start": "",
  "shift_end": "",
  "received_radio": false,
  "received_pager": false,
  "received_keys": false,
  "received_detex": false,
  "activity_log": [
    { "from": "", "to": "", "activity": "" }
  ],
  "signature": ""
}

Rules:
- If a field is blank or illegible, use an empty string or false for booleans
- For checkboxes, use true if checked/marked, false if empty
- Include only activity log rows that have actual content written in them
- Return ONLY the JSON object, nothing else`
          }
        ]
      }]
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    return NextResponse.json(
      { error: err?.error?.message || "Claude API error" },
      { status: response.status }
    );
  }

  const data = await response.json();
  const textBlock = data.content?.find((b: { type: string }) => b.type === "text");
  if (!textBlock?.text) {
    return NextResponse.json({ error: "No response from Claude" }, { status: 500 });
  }

  try {
    const clean = textBlock.text
      .trim()
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
    const parsed = JSON.parse(clean);
    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json(
      { error: "Claude returned an unexpected format. Try a clearer photo." },
      { status: 422 }
    );
  }
}
