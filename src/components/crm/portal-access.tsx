import { Globe } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { requireStaff } from "@/lib/auth";
import { PORTAL_PERSONA_BY_USER } from "@/lib/demo";

/** Who at this customer can sign in to the client portal (and, in the demo, a way to see what they see). */
export async function PortalAccess({ customerId }: { customerId: number }) {
  const { supabase } = await requireStaff();
  const { data } = await supabase.from("portal_users").select("user_id, contact:contacts(first_name, last_name, email)").eq("customer_id", customerId);
  return (
    <Card>
      <CardHeader title={<span className="flex items-center gap-2"><Globe className="h-4 w-4 text-brand-500" /> Client portal</span>} />
      <CardBody className="space-y-3 text-sm">
        {!data?.length ? (
          <p className="text-slate-500">No portal logins for this customer yet. Portal invitations by email need the Supabase service key configured on the server.</p>
        ) : (
          data.map((u) => {
            const name = u.contact ? [u.contact.first_name, u.contact.last_name].filter(Boolean).join(" ") : "Portal user";
            const persona = PORTAL_PERSONA_BY_USER[u.user_id];
            return (
              <div key={u.user_id} className="flex items-center justify-between gap-3">
                <div><div className="font-medium text-slate-800">{name}</div><div className="text-xs text-slate-500">{u.contact?.email}</div></div>
                {persona && (
                  <a href={`/demo?as=${persona}&next=/portal`} className="rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100">View as client</a>
                )}
              </div>
            )
          })
        )}
      </CardBody>
    </Card>
  );
}
