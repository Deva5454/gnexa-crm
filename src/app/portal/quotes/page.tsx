import type { Metadata } from "next";
import { PortalDocList } from "../doc-list";
export const metadata: Metadata = { title: "Quotes" };
export default function PortalQuotes() {
  return (
    <>
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">Quotes</h1>
      <p className="mb-6 text-sm text-slate-500">Estimates and proposals we&apos;ve sent you — accept or decline them online.</p>
      <PortalDocList kinds={["estimate", "proposal"]} base="/portal/quotes" />
    </>
  );
}
