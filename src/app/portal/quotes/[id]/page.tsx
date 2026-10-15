import type { Metadata } from "next";
import { PortalDocView } from "../../doc-view";
export const metadata: Metadata = { title: "Quote" };
export default async function PortalQuote({ params }: { params: Promise<{ id: string }> }) {
  return <PortalDocView id={Number((await params).id)} kinds={["estimate", "proposal"]} back="/portal/quotes" backLabel="All quotes" />;
}
