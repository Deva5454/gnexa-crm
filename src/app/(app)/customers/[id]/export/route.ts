import { NextResponse, type NextRequest } from "next/server";
import { logActivity } from "@/lib/activity";
import { requireStaff } from "@/lib/auth";
import { customerDataExport, jsonDownload } from "@/lib/gdpr";

// GDPR data export for one customer (staff)
export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, can } = await requireStaff();
  if (!can("customers", "view")) return new NextResponse("Not allowed", { status: 403 });
  const id = Number((await params).id);
  const data = await customerDataExport(supabase, id);
  if (!data.customer) return new NextResponse("Not found", { status: 404 });
  await logActivity(supabase, "exported this customer's data (GDPR)", { type: "customer", id });
  const slug = data.customer.company.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
  return jsonDownload(data, `gnexa-${slug}-data.json`);
}
