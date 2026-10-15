import { NextResponse, type NextRequest } from "next/server";
import { requireStaff } from "@/lib/auth";

// Short-lived signed link to an expense receipt
export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, can } = await requireStaff();
  if (!can("expenses", "view")) return new NextResponse("Not allowed", { status: 403 });
  const { data: e } = await supabase.from("expenses").select("receipt_path, receipt_name").eq("id", Number((await params).id)).maybeSingle();
  if (!e?.receipt_path) return new NextResponse("Not found", { status: 404 });
  const { data, error } = await supabase.storage.from("expense-receipts").createSignedUrl(e.receipt_path, 60, { download: e.receipt_name ?? "receipt" });
  if (error || !data) return new NextResponse(error?.message ?? "Could not create link", { status: 500 });
  return NextResponse.redirect(data.signedUrl);
}
