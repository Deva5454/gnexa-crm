import type { Metadata } from "next";
import { PortalDocList } from "../doc-list";
import { PortalSubscriptions } from "../subscriptions-card";
export const metadata: Metadata = { title: "Invoices" };
export default function PortalInvoices() {
  return (
    <>
      <h1 className="mb-6 text-2xl font-bold tracking-tight text-slate-900">Invoices</h1>
      <PortalDocList kinds={["invoice", "credit_note"]} base="/portal/invoices" />
      <PortalSubscriptions />
    </>
  );
}
