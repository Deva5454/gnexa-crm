import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ImportWizard } from "@/components/crm/import-wizard";
import { PageHeader } from "@/components/ui/page-header";
import { importLeads } from "@/lib/actions/import";
import { requireStaff } from "@/lib/auth";
import type { ImportField } from "@/lib/csv";

export const metadata: Metadata = { title: "Import leads" };

const FIELDS: ImportField[] = [
  { key: "name", label: "Name", required: true, aliases: ["full name", "lead name", "contact name", "contact"] },
  { key: "company", label: "Company", aliases: ["company name", "organisation", "organization"] },
  { key: "title", label: "Job title", aliases: ["position", "designation"] },
  { key: "email", label: "E-mail", aliases: ["email address", "e-mail address"] },
  { key: "phone", label: "Phone", aliases: ["mobile", "telephone", "phone number"] },
  { key: "city", label: "City" },
  { key: "country", label: "Country" },
  { key: "value", label: "Deal value", aliases: ["value", "amount", "budget", "deal size"] },
  { key: "source", label: "Source", aliases: ["lead source", "channel"] },
  { key: "status", label: "Stage", aliases: ["status", "lead status", "stage"] },
  { key: "description", label: "Notes", aliases: ["description", "notes", "comments", "requirement"] },
];

const SAMPLE = `Name,Company,Email,Phone,City,Deal value,Source,Stage,Notes
Ankit Verma,Verma Textiles,ankit@vermatextiles.example.in,+91 98100 11223,Surat,250000,Trade Show,New,Met at the Surat expo
Sana Khan,Bloom Cafes,sana@bloomcafes.example.in,+91 99000 44556,Hyderabad,90000,Website,Contacted,8 outlets
`;

export default async function ImportLeadsPage() {
  const { can } = await requireStaff();
  if (!can("leads", "edit")) notFound();
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader eyebrow={<Link href="/leads" className="hover:text-brand-600">Leads</Link>} title="Import leads" description="Load a list of prospects from a spreadsheet. They're assigned to you; e-mails that are already leads are skipped." />
      <ImportWizard fields={FIELDS} action={importLeads} sample={SAMPLE} sampleName="leads-sample.csv" doneHref="/leads" noun="lead" />
    </div>
  );
}
