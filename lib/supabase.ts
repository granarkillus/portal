import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { createBrowserClient } from "@supabase/ssr";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Supervisor login page; supervisor-only pages send people here and back.
export const SUPERVISOR_LOGIN_URL = "/supervisor";

// Public client for officer-facing pages (forms, links sent to officers).
// Never carries a login, so submissions always go in anonymously.
export function getPublicSupabase(): SupabaseClient {
  return createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}

// Supervisor client. The session is kept in a cookie shared by every
// *.xing.wtf site, so one supervisor login covers all the Allied apps.
// Its own cookie name keeps it separate from other xing.wtf apps.
let supervisorClient: SupabaseClient | null = null;
export function getSupabase(): SupabaseClient {
  if (!supervisorClient) {
    const shared = typeof window !== "undefined" && window.location.hostname.endsWith("xing.wtf");
    supervisorClient = createBrowserClient(URL, KEY, {
      // Implicit flow so password-reset links work when opened on another device.
      auth: { flowType: "implicit" },
      cookieOptions: {
        name: "allied-auth",
        path: "/",
        sameSite: "lax",
        secure: shared,
        ...(shared ? { domain: ".xing.wtf" } : {}),
      },
    });
  }
  return supervisorClient;
}

// Only allow returning to pages on our own sites after login.
export function safeNext(next: string | null): string | null {
  if (!next) return null;
  try {
    const u = new window.URL(next, window.location.origin);
    const ok = u.origin === window.location.origin || (u.protocol === "https:" && u.hostname.endsWith(".xing.wtf"));
    return ok ? u.toString() : null;
  } catch {
    return null;
  }
}

// Gate for supervisor-only pages. Resolves to the user, or sends them to the
// supervisor login (coming back here afterwards) and resolves to null.
export async function requireSupervisor(loginUrl: string = SUPERVISOR_LOGIN_URL): Promise<User | null> {
  const supabase = getSupabase();
  const { data } = await supabase.auth.getUser();
  if (data.user) {
    const { data: isSupervisor } = await supabase.rpc("is_supervisor");
    if (isSupervisor === true) return data.user;
  }
  const target = new window.URL(loginUrl, window.location.origin);
  target.searchParams.set("next", window.location.href);
  if (data.user) target.searchParams.set("denied", "1");
  window.location.href = target.toString();
  return null;
}
