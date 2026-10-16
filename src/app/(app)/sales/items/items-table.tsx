"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { formatMoney } from "@/lib/utils";
import { deleteItem } from "../actions";
import { ItemForm, type ItemRow } from "./item-form";

export function ItemsTable({
  items,
  taxes,
  canEdit,
  canDelete,
}: {
  items: (ItemRow & { tax_name: string | null })[];
  taxes: { id: number; name: string }[];
  canEdit: boolean;
  canDelete: boolean;
}) {
  const [editing, setEditing] = useState<number | null>(null);
  return (
    <div className="overflow-x-auto">
      <table className="table-base">
        <thead>
          <tr>
            <th>Item</th>
            <th className="text-right">Rate</th>
            <th className="hidden sm:table-cell">Unit</th>
            <th className="hidden sm:table-cell">Tax</th>
            <th className="w-20" />
          </tr>
        </thead>
        <tbody>
          {items.map((i) =>
            editing === i.id ? (
              <tr key={i.id}>
                <td colSpan={5} className="bg-brand-50/40">
                  <ItemForm item={i} taxes={taxes} onDone={() => setEditing(null)} />
                </td>
              </tr>
            ) : (
              <tr key={i.id}>
                <td>
                  <div className="font-medium text-slate-900">{i.name}</div>
                  {i.description && <div className="text-xs text-slate-500">{i.description}</div>}
                  {i.hsn_sac && <div className="font-mono text-[11px] text-slate-400">HSN/SAC {i.hsn_sac}</div>}
                </td>
                <td className="whitespace-nowrap text-right font-semibold">{formatMoney(Number(i.rate))}</td>
                <td className="hidden text-slate-600 sm:table-cell">{i.unit ?? "—"}</td>
                <td className="hidden text-slate-600 sm:table-cell">{i.tax_name ?? "No tax"}</td>
                <td>
                  <div className="flex justify-end gap-1">
                    {canEdit && (
                      <button onClick={() => setEditing(i.id)} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label={`Edit ${i.name}`}>
                        <Pencil className="h-4 w-4" />
                      </button>
                    )}
                    {canDelete && (
                      <ConfirmForm action={deleteItem} message={`Delete “${i.name}” from the catalogue? Existing documents keep their lines.`}>
                        <input type="hidden" name="id" value={i.id} />
                        <button className="rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label={`Delete ${i.name}`}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </ConfirmForm>
                    )}
                  </div>
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  );
}
