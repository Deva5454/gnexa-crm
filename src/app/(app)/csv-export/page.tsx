import type { Metadata } from "next";
import { Download } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireStaff } from "@/lib/auth";
import { DATASETS } from "@/lib/exports";

export const metadata: Metadata = { title: "CSV export" };

export default async function CsvExportPage() {
  const { can } = await requireStaff();
  const sets = DATASETS.filter((d) => can(d.module, "view"));
  return (
    <>
      <PageHeader title="CSV export" description="Download any list as a CSV for Excel or Google Sheets. Leave the dates empty for everything." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sets.map((d) => (
          <Card key={d.key}>
            <CardHeader title={d.label} description={`Filtered by ${d.dateLabel.toLowerCase()} date`} />
            <CardBody>
              <form action={`/csv-export/${d.key}`} method="get" className="flex flex-wrap items-end gap-2">
                <label className="text-sm">
                  <span className="label">From</span>
                  <input type="date" name="from" className="field w-40" />
                </label>
                <label className="text-sm">
                  <span className="label">To</span>
                  <input type="date" name="to" className="field w-40" />
                </label>
                <button className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700">
                  <Download className="h-4 w-4" /> Download
                </button>
              </form>
            </CardBody>
          </Card>
        ))}
      </div>
    </>
  );
}
