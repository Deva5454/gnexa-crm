import { NextResponse, type NextRequest } from "next/server";
import { personaByKey } from "@/lib/demo";
import { createClient } from "@/lib/supabase/server";

// Shared password of the demo persona accounts (see supabase/migrations/0004_demo_mode.sql).
// These accounts only ever hold demo data.
const DEMO_PASSWORD = "GnexaDemo#2026";

/** GET /demo?as=<persona>&next=<path> — sign in as a demo persona and continue. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const persona = personaByKey(searchParams.get("as")) ?? personaByKey("admin")!;
  const nextParam = searchParams.get("next");
  const safe = nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//") && !nextParam.startsWith("/demo") ? nextParam : null;
  // Clients only ever land in the portal; staff never do
  const next = persona.client ? (safe?.startsWith("/portal") ? safe : "/portal") : safe && !safe.startsWith("/portal") ? safe : "/dashboard";

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: persona.email, password: DEMO_PASSWORD });
  if (error) {
    return new NextResponse(
      `Demo sign-in failed for ${persona.role}: ${error.message}. Run supabase/migrations/0004_demo_mode.sql in the Supabase SQL Editor to create the demo accounts.`,
      { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } },
    );
  }
  return NextResponse.redirect(`${origin}${next}`);
}
