import { NextResponse, type NextRequest } from "next/server";
import { requirePortal } from "@/lib/auth";

// Signed link to an attachment on one of the client's own tickets (the database decides what they may see)
export async function GET(_: NextRequest, { params }: { params: Promise<{ fileId: string }> }) {
  const { supabase } = await requirePortal();
  const { data: f } = await supabase.from("ticket_files").select("path, name").eq("id", Number((await params).fileId)).maybeSingle();
  if (!f) return new NextResponse("Not found", { status: 404 });
  const { data, error } = await supabase.storage.from("ticket-files").createSignedUrl(f.path, 60, { download: f.name });
  if (error || !data) return new NextResponse("Could not create link", { status: 500 });
  return NextResponse.redirect(data.signedUrl);
}
