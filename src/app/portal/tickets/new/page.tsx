import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardBody } from "@/components/ui/card";
import { requirePortal } from "@/lib/auth";
import { NewTicketForm } from "../../forms";

export const metadata: Metadata = { title: "New ticket" };

export default async function PortalNewTicket() {
  const { supabase } = await requirePortal();
  const { data: departments } = await supabase.from("ticket_departments").select("id, name").order("name");
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">Open a ticket</h1>
      <p className="mb-6 text-sm text-slate-500">Tip: the <Link href="/portal/help" className="font-medium text-brand-600">help center</Link> may already have the answer.</p>
      <Card><CardBody><NewTicketForm departments={departments ?? []} /></CardBody></Card>
    </div>
  );
}
