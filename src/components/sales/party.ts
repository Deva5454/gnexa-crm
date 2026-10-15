import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/lib/database.types";
import type { Party } from "./doc-paper";

/** Who a document is addressed to: customer (with primary contact) or, for proposals, a lead. */
export async function loadParty(supabase: SupabaseClient<Database>, doc: Pick<Tables<"sales_docs">, "customer_id" | "lead_id">): Promise<Party & { href: string | null }> {
  if (doc.customer_id) {
    const { data: c } = await supabase
      .from("customers")
      .select("id, company, address, city, state, zip, country, vat, phone, contacts(first_name, last_name, email, is_primary)")
      .eq("id", doc.customer_id)
      .maybeSingle();
    if (c) {
      const p = c.contacts.find((x) => x.is_primary) ?? c.contacts[0];
      return {
        name: c.company,
        contact: p ? [p.first_name, p.last_name].filter(Boolean).join(" ") : null,
        lines: [c.address, [c.city, c.state, c.zip].filter(Boolean).join(", "), c.country, p?.email ?? c.phone].filter((x): x is string => !!x),
        gstin: c.vat,
        href: `/customers/${c.id}`,
      };
    }
  }
  if (doc.lead_id) {
    const { data: l } = await supabase.from("leads").select("id, name, company, email, phone, city, country").eq("id", doc.lead_id).maybeSingle();
    if (l) {
      return {
        name: l.company || l.name,
        contact: l.company ? l.name : null,
        lines: [[l.city, l.country].filter(Boolean).join(", "), l.email, l.phone].filter((x): x is string => !!x),
        href: `/leads/${l.id}`,
      };
    }
  }
  return { name: "Unknown", lines: [], href: null };
}
