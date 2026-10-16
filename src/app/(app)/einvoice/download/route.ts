import { NextResponse, type NextRequest } from "next/server";
import { logActivity } from "@/lib/activity";
import { requireStaff } from "@/lib/auth";
import { checkDoc, loadEInvoiceDocs, toEInvoice } from "@/lib/einvoice";

const iso = (v: string | null, fb: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : fb);

// GET /einvoice/download?from=YYYY-MM-DD&to=YYYY-MM-DD — e-invoice JSON for every B2B / export document ready to submit
export async function GET(req: NextRequest) {
  const { supabase, can } = await requireStaff();
  if (!can("sales", "view")) return new NextResponse("Not allowed", { status: 403 });
  const sp = req.nextUrl.searchParams;
  const to = iso(sp.get("to"), new Date().toISOString().slice(0, 10));
  const from = iso(sp.get("from"), to.slice(0, 8) + "01");
  const { docs, company } = await loadEInvoiceDocs(supabase, from, to);
  const ready = docs.filter((d) => {
    const c = checkDoc(d, company);
    return c.kind !== "b2c" && !c.issues.length;
  });
  await logActivity(supabase, `exported ${ready.length} e-invoice${ready.length === 1 ? "" : "s"} (${from} to ${to})`);
  return new NextResponse(JSON.stringify(ready.map((d) => toEInvoice(d, company)), null, 2), {
    headers: { "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename="e-invoices-${from}-to-${to}.json"` },
  });
}
