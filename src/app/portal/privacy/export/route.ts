import { requirePortal } from "@/lib/auth";
import { customerDataExport, jsonDownload } from "@/lib/gdpr";

// "Download my data" — RLS limits every query to the client's own records
export async function GET() {
  const { supabase, customerId } = await requirePortal();
  const data = await customerDataExport(supabase, customerId);
  return jsonDownload(data, "my-data.json");
}
