import { NextResponse, type NextRequest } from "next/server";
import { requireStaff } from "@/lib/auth";

// Short-lived signed link to a private ticket attachment
export async function GET(_: NextRequest, { params }: { params: Promise<{ fileId: string }> }) {
  const { supabase, can } = await requireStaff();
  if (!can("support", "view")) return new NextResponse("Not allowed", { status: 403 });
  const { data: f } = await supabase.from("ticket_files").select("path, name").eq("id", Number((await params).fileId)).maybeSingle();
  if (!f) return new NextResponse("Not found", { status: 404 });
  const { data, error } = await supabase.storage.from("ticket-files").createSignedUrl(f.path, 60, { download: f.name });
  if (error || !data) return new NextResponse(error?.message ?? "Could not create link", { status: 500 });
  return NextResponse.redirect(data.signedUrl);
}
