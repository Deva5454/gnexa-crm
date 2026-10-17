import type { Metadata } from "next";
import { PortalDocView } from "../../doc-view";
export const metadata: Metadata = { title: "Invoice" };
export default async function PortalInvoice({ params }: { params: Promise<{ id: string }> }) {
  return <PortalDocView id={Number((await params).id)} kinds={["invoice", "credit_note"]} />;
}
