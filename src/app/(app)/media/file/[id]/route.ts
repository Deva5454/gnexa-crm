import { NextResponse, type NextRequest } from "next/server";
import { requireStaff } from "@/lib/auth";

// Short-lived signed link to a media-library file. ?inline=1 previews instead of downloading.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { supabase } = await requireStaff();
  const { data: f } = await supabase.from("media_files").select("path, name").eq("id", Number((await params).id)).maybeSingle();
  if (!f) return new NextResponse("Not found", { status: 404 });
  const inline = req.nextUrl.searchParams.get("inline") === "1";
  const { data, error } = await supabase.storage.from("media").createSignedUrl(f.path, 120, inline ? undefined : { download: f.name });
  if (error || !data) return new NextResponse(error?.message ?? "Could not create link", { status: 500 });
  return NextResponse.redirect(data.signedUrl);
}
