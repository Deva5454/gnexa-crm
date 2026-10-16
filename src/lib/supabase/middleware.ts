import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/database.types";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Visitors without a session: in the demo they're signed in automatically (as the admin persona);
  // in a live CRM they go to the sign-in page. Public forms (/f/…) and surveys (/s/…) stay anonymous.
  const path = request.nextUrl.pathname;
  const isPublic = path.startsWith("/f/") || path.startsWith("/s/") || path === "/login";
  if (!user && path !== "/demo" && !isPublic) {
    const { data: demo } = await supabase.rpc("demo_mode");
    const url = request.nextUrl.clone();
    const next = path === "/" ? "" : path + request.nextUrl.search;
    if (demo !== false) {
      url.pathname = "/demo";
      const persona = path.startsWith("/portal") ? "as=client-tata&" : "";
      url.search = next ? `?${persona}next=${encodeURIComponent(next)}` : "";
    } else {
      url.pathname = "/login";
      url.search = next ? `?next=${encodeURIComponent(next)}` : "";
    }
    return NextResponse.redirect(url);
  }

  return response;
}
