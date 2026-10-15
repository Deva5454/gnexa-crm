import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { addNamed, deleteNamed } from "./actions";

export function NamedList({
  table,
  title,
  description,
  items,
}: {
  table: "lead_sources" | "customer_groups" | "roles";
  title: string;
  description?: string;
  items: { id: number; name: string; extra?: React.ReactNode }[];
}) {
  return (
    <Card>
      <CardHeader title={title} description={description} />
      <ul className="divide-y divide-slate-100">
        {items.map((i) => (
          <li key={i.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
            <span className="flex-1 font-medium text-slate-700">{i.name}</span>
            {i.extra}
            <ConfirmForm action={deleteNamed} message={`Delete “${i.name}”? Records using it will be cleared.`}>
              <input type="hidden" name="table" value={table} />
              <input type="hidden" name="id" value={i.id} />
              <button className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label={`Delete ${i.name}`}>
                <Trash2 className="h-4 w-4" />
              </button>
            </ConfirmForm>
          </li>
        ))}
        {!items.length && <li className="px-5 py-4 text-sm text-slate-400">Nothing yet.</li>}
      </ul>
      <form action={addNamed} className="flex gap-2 border-t border-slate-100 p-4">
        <input type="hidden" name="table" value={table} />
        <input name="name" required placeholder="Add new…" className="field" />
        <Button variant="secondary"><Plus className="h-4 w-4" /> Add</Button>
      </form>
    </Card>
  );
}
