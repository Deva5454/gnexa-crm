import { StickyNote, Trash2 } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { deleteNote } from "@/lib/actions/notes";
import { requireStaff } from "@/lib/auth";
import { timeAgo } from "@/lib/utils";
import { NoteComposer } from "./note-composer";

export async function NotesPanel({ relType, relId, path }: { relType: "customer" | "lead"; relId: number; path: string }) {
  const { supabase, profile } = await requireStaff();
  const { data: notes } = await supabase
    .from("notes")
    .select("id, body, created_at, created_by, author:profiles!notes_created_by_fkey(full_name)")
    .eq("rel_type", relType)
    .eq("rel_id", relId)
    .order("created_at", { ascending: false });

  return (
    <Card>
      <CardHeader title="Notes" description="Visible to everyone on the team" />
      <CardBody className="space-y-5">
        <NoteComposer relType={relType} relId={relId} />
        {!notes?.length ? (
          <div className="flex items-center gap-2 rounded-xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-400">
            <StickyNote className="h-4 w-4" /> No notes yet.
          </div>
        ) : (
          <ul className="space-y-4">
            {notes.map((n) => (
              <li key={n.id} className="group flex gap-3">
                <Avatar name={n.author?.full_name} />
                <div className="min-w-0 flex-1 rounded-xl bg-slate-50 px-4 py-3">
                  <div className="mb-1 flex items-center justify-between gap-2 text-xs text-slate-500">
                    <span>
                      <b className="text-slate-700">{n.author?.full_name ?? "Former staff"}</b> · {timeAgo(n.created_at)}
                    </span>
                    {(n.created_by === profile.id || profile.is_admin) && (
                      <ConfirmForm action={deleteNote} message="Delete this note?">
                        <input type="hidden" name="id" value={n.id} />
                        <input type="hidden" name="path" value={path} />
                        <button className="text-slate-400 opacity-0 transition hover:text-rose-600 group-hover:opacity-100" aria-label="Delete note">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </ConfirmForm>
                    )}
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-slate-700">{n.body}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
