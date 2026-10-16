import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { requireFeature, requireStaff } from "@/lib/auth";
import { saveSubscription } from "../../actions";
import { subscriptionOptions } from "../../form-data";
import { SubscriptionForm } from "../../subscription-form";

export const metadata: Metadata = { title: "Edit subscription" };

export default async function EditSubscriptionPage({ params }: { params: Promise<{ id: string }> }) {
  await requireFeature("subscriptions"); // Setup → Modules
  const id = Number((await params).id);
  const { supabase, can } = await requireStaff();
  if (!can("sales", "edit")) notFound();
  const [{ data: sub }, opts] = await Promise.all([supabase.from("subscriptions").select("*").eq("id", id).maybeSingle(), subscriptionOptions(supabase)]);
  if (!sub) notFound();
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow={<Link href={`/subscriptions/${id}`} className="hover:text-brand-600">Subscription</Link>} title={`Edit: ${sub.name}`} description="Changes apply from the next invoice." />
      <SubscriptionForm action={saveSubscription.bind(null, id)} sub={sub} {...opts} cancelHref={`/subscriptions/${id}`} />
    </div>
  );
}
