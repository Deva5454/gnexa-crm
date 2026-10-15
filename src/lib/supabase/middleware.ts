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

  // Demo mode: visitors without a session are signed in automatically (as the admin persona).
  // Public forms (/f/…) and surveys (/s/…) are for anyone and stay anonymous.
  const path = request.nextUrl.pathname;
  const isPublic = path.startsWith("/f/") || path.startsWith("/s/");
  if (!user && path !== "/demo" && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/demo";
    const persona = path.startsWith("/portal") ? "as=client-tata&" : "";
    url.search = path === "/" ? "" : `?${persona}next=${encodeURIComponent(path + request.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }

  return response;
}
