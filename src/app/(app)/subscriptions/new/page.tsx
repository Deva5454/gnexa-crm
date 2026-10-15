import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { requireStaff } from "@/lib/auth";
import { saveSubscription } from "../actions";
import { subscriptionOptions } from "../form-data";
import { SubscriptionForm } from "../subscription-form";

export const metadata: Metadata = { title: "New subscription" };

export default async function NewSubscriptionPage({ searchParams }: { searchParams: Promise<{ customer?: string }> }) {
  const { supabase, can } = await requireStaff();
  if (!can("sales", "edit")) notFound();
  const opts = await subscriptionOptions(supabase);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow={<Link href="/subscriptions" className="hover:text-brand-600">Subscriptions</Link>} title="New subscription" />
      <SubscriptionForm action={saveSubscription.bind(null, null)} {...opts} defaultCustomer={Number((await searchParams).customer) || undefined} cancelHref="/subscriptions" />
    </div>
  );
}
