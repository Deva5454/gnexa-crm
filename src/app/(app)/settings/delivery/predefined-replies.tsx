import { Plus, Trash2 } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { SubmitButton } from "@/components/ui/submit-button";
import { deletePredefinedReply, savePredefinedReply } from "../actions";

export function PredefinedReplies({ replies }: { replies: { id: number; title: string; body: string }[] }) {
  return (
    <Card>
      <CardHeader title="Predefined replies" description="Canned answers agents can drop into a ticket reply. {contact} and {agent} are filled in automatically." />
      <ul className="divide-y divide-slate-100">
        {replies.map((r) => (
          <li key={r.id} className="px-5 py-3">
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium text-slate-800">
                <span className="flex-1">{r.title}</span>
                <span className="text-xs text-slate-400 group-open:hidden">Edit</span>
              </summary>
              <div className="mt-3 flex gap-2">
                <form action={savePredefinedReply} className="flex-1 space-y-2">
                  <input type="hidden" name="id" value={r.id} />
                  <input name="title" defaultValue={r.title} required className="field" aria-label="Title" />
                  <textarea name="body" defaultValue={r.body} required rows={5} className="field resize-y" aria-label="Reply text" />
                  <SubmitButton size="sm" variant="secondary" pendingText="Saving…">Save</SubmitButton>
                </form>
                <ConfirmForm action={deletePredefinedReply} message={`Delete “${r.title}”?`}>
                  <input type="hidden" name="id" value={r.id} />
                  <button className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label={`Delete ${r.title}`}><Trash2 className="h-4 w-4" /></button>
                </ConfirmForm>
              </div>
            </details>
          </li>
        ))}
        {!replies.length && <li className="px-5 py-4 text-sm text-slate-400">None yet.</li>}
      </ul>
      <form action={savePredefinedReply} className="space-y-2 border-t border-slate-100 p-4">
        <input name="title" required placeholder="Title, e.g. “Need more details”" className="field" />
        <textarea name="body" required rows={3} placeholder={"Hi {contact},\n\n…\n\nRegards,\n{agent}"} className="field resize-y" />
        <SubmitButton size="sm" variant="secondary" pendingText="Adding…"><Plus className="h-4 w-4" /> Add reply</SubmitButton>
      </form>
    </Card>
  );
}
