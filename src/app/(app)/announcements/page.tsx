import type { Metadata } from "next";
import { Megaphone, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireFeature, requireStaff } from "@/lib/auth";
import { formatDateTime } from "@/lib/utils";
import { deleteAnnouncement } from "./actions";
import { AnnouncementForm } from "./announcement-form";

export const metadata: Metadata = { title: "Announcements" };

export default async function AnnouncementsPage() {
  await requireFeature("announcements"); // Setup → Modules
  const { supabase, profile } = await requireStaff();
  const { data } = await supabase.from("announcements").select("*, author:profiles(full_name)").order("created_at", { ascending: false });
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Announcements" description="News for the team and, optionally, for clients in their portal." />
      {profile.is_admin && (
        <Card className="mb-6">
          <CardHeader title="Post an announcement" />
          <CardBody><AnnouncementForm /></CardBody>
        </Card>
      )}
      {!data?.length ? <Card><EmptyState icon={Megaphone} title="No announcements" /></Card> : (
        <ul className="space-y-4">
          {data.map((a) => (
            <li key={a.id}>
              <Card className="group p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold text-slate-900">{a.title}</h2>
                    <p className="text-xs text-slate-500">{a.author?.full_name ?? "Admin"} · {formatDateTime(a.created_at)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {a.show_to_staff && <Badge>Team</Badge>}
                    {a.show_to_clients && <Badge className="bg-teal-50 text-teal-700 ring-teal-200">Clients</Badge>}
                    {profile.is_admin && (
                      <ConfirmForm action={deleteAnnouncement} message={`Delete “${a.title}”?`}>
                        <input type="hidden" name="id" value={a.id} />
                        <button className="rounded p-1 text-slate-300 opacity-0 hover:text-rose-600 group-hover:opacity-100 focus:opacity-100 [@media(hover:none)]:opacity-100" aria-label="Delete announcement"><Trash2 className="h-4 w-4" /></button>
                      </ConfirmForm>
                    )}
                  </div>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm text-slate-600">{a.body}</p>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
