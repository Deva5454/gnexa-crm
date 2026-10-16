import { NextResponse, type NextRequest } from "next/server";
import { requireStaff } from "@/lib/auth";
import { REPORT_TABS, reportsFor, toCsv } from "@/lib/reports";
import { todayIST } from "@/lib/dates";

export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("report") ?? "";
  const tab = REPORT_TABS.find((t) => key.startsWith(`${t.key}-`));
  const { supabase, can } = await requireStaff();
  if (!tab || !can("reports", "view") || !can(tab.module, "view")) return new NextResponse("Not allowed", { status: 403 });
  const table = (await reportsFor(tab.key, supabase)).find((t) => t.key === key);
  if (!table) return new NextResponse("Unknown report", { status: 404 });
  return new NextResponse("﻿" + toCsv(table), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="gnexa-${key}-${todayIST()}.csv"`,
    },
  });
}
