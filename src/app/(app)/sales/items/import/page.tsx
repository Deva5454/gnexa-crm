import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ImportWizard } from "@/components/crm/import-wizard";
import { PageHeader } from "@/components/ui/page-header";
import { importItems } from "@/lib/actions/import";
import { requireStaff } from "@/lib/auth";
import type { ImportField } from "@/lib/csv";

export const metadata: Metadata = { title: "Import items" };

const FIELDS: ImportField[] = [
  { key: "name", label: "Name", required: true, aliases: ["item", "item name", "product", "service", "title"] },
  { key: "description", label: "Description", aliases: ["long description", "details"] },
  { key: "rate", label: "Rate", aliases: ["price", "unit price", "amount", "cost"] },
  { key: "unit", label: "Unit", aliases: ["uom", "unit of measure"] },
  { key: "tax", label: "Tax (name or %)", aliases: ["gst", "tax rate", "gst %", "tax name"] },
  { key: "hsn_sac", label: "HSN / SAC", aliases: ["hsn", "sac", "hsn code", "sac code"] },
  { key: "group", label: "Group", aliases: ["item group", "category"] },
];

const SAMPLE = `Name,Description,Rate,Unit,Tax,HSN/SAC,Group
CRM seat licence,Per user per month,1200,seat,18,997331,Software licences
Onboarding workshop,Half-day remote training,25000,session,GST 18%,998393,Services
`;

export default async function ImportItemsPage() {
  const { can } = await requireStaff();
  if (!can("sales", "edit")) notFound();
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader eyebrow={<Link href="/sales/items" className="hover:text-brand-600">Items</Link>} title="Import items" description="Bring in your product and service catalogue from a spreadsheet. Items whose name already exists are skipped; new groups are created as needed." />
      <ImportWizard fields={FIELDS} action={importItems} sample={SAMPLE} sampleName="items-sample.csv" doneHref="/sales/items" noun="item" />
    </div>
  );
}
