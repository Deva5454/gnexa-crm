import { NextResponse, type NextRequest } from "next/server";
import { requireStaff } from "@/lib/auth";
import { csvText, DATASETS } from "@/lib/exports";

const iso = (v: string | null, fb: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : fb);

// GET /csv-export/<dataset>?from=YYYY-MM-DD&to=YYYY-MM-DD
export async function GET(req: NextRequest, { params }: { params: Promise<{ dataset: string }> }) {
  const { supabase, can } = await requireStaff();
  const { dataset } = await params;
  const ds = DATASETS.find((d) => d.key === dataset);
  if (!ds) return new NextResponse("Not found", { status: 404 });
  if (!can(ds.module, "view")) return new NextResponse("Your role can't view this list.", { status: 403 });
  const sp = req.nextUrl.searchParams;
  const from = iso(sp.get("from"), "2000-01-01");
  const to = iso(sp.get("to"), "2999-12-31");
  const { columns, rows } = await ds.load(supabase, from, to);
  return new NextResponse(csvText(columns, rows), {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="gnexa-${ds.key}-${from === "2000-01-01" ? "all" : `${from}-to-${to}`}.csv"` },
  });
}
