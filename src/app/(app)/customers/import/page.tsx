import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ImportWizard } from "@/components/crm/import-wizard";
import { PageHeader } from "@/components/ui/page-header";
import { importCustomers } from "@/lib/actions/import";
import { requireStaff } from "@/lib/auth";
import type { ImportField } from "@/lib/csv";

export const metadata: Metadata = { title: "Import customers" };

const FIELDS: ImportField[] = [
  { key: "company", label: "Company", required: true, aliases: ["company name", "customer", "organisation", "organization", "account"] },
  { key: "phone", label: "Phone", aliases: ["telephone", "company phone"] },
  { key: "website", label: "Website", aliases: ["url", "web"] },
  { key: "address", label: "Address", aliases: ["street", "address line 1"] },
  { key: "city", label: "City" },
  { key: "state", label: "State", aliases: ["province", "region"] },
  { key: "zip", label: "PIN / ZIP", aliases: ["pincode", "pin", "postcode", "postal code", "zip code"] },
  { key: "country", label: "Country" },
  { key: "vat", label: "GSTIN / VAT", aliases: ["gst", "gstin", "vat number", "tax id"] },
  { key: "currency", label: "Currency" },
  { key: "group", label: "Group", aliases: ["customer group", "segment"] },
  { key: "contact_first_name", label: "Contact first name", aliases: ["first name", "firstname", "contact"] },
  { key: "contact_last_name", label: "Contact last name", aliases: ["last name", "lastname", "surname"] },
  { key: "contact_email", label: "Contact e-mail", aliases: ["email", "e-mail", "contact email"] },
  { key: "contact_phone", label: "Contact phone", aliases: ["mobile", "contact phone"] },
];

const SAMPLE = `Company,Phone,City,State,Country,GSTIN,Group,First name,Last name,Email
Acme Industries,+91 22 4000 1234,Mumbai,Maharashtra,India,27AABCA1234F1Z5,Enterprise,Ravi,Shah,ravi@acme.example.in
Lotus Clinics,+91 80 4111 2222,Bengaluru,Karnataka,India,,SMB,Priti,Rao,priti@lotus.example.in
`;

export default async function ImportCustomersPage() {
  const { can } = await requireStaff();
  if (!can("customers", "edit")) notFound();
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader eyebrow={<Link href="/customers" className="hover:text-brand-600">Customers</Link>} title="Import customers" description="Bring in customers (and their main contact) from a spreadsheet. Companies that already exist are skipped." />
      <ImportWizard fields={FIELDS} action={importCustomers} sample={SAMPLE} sampleName="customers-sample.csv" doneHref="/customers" noun="customer" />
    </div>
  );
}
