"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { SelectAll } from "@/components/crm/bulk-bar";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { formatMoney } from "@/lib/utils";
import { deleteItem } from "../actions";
import { ItemForm, type ItemRow } from "./item-form";

export function ItemsTable({
  items,
  taxes,
  groups,
  currencies,
  base,
  canEdit,
  canDelete,
}: {
  items: (ItemRow & { tax_name: string | null; group_name: string | null; used: number })[];
  taxes: { id: number; name: string }[];
  groups: { id: number; name: string }[];
  currencies: string[];
  base: string;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const [editing, setEditing] = useState<number | null>(null);
  const cols = canEdit ? 8 : 7;
  return (
    <div className="overflow-x-auto">
      <table className="table-base">
        <thead>
          <tr>
            {canEdit && <th className="w-8"><SelectAll form="item-bulk" label="Select all items on this page" /></th>}
            <th>Item</th>
            <th className="hidden md:table-cell">Group</th>
            <th className="text-right">Rate</th>
            <th className="hidden sm:table-cell">Unit</th>
            <th className="hidden sm:table-cell">Tax</th>
            <th className="hidden lg:table-cell text-right">Used</th>
            <th className="w-20" />
          </tr>
        </thead>
        <tbody>
          {items.map((i) =>
            editing === i.id ? (
              <tr key={i.id}>
                <td colSpan={cols} className="bg-brand-50/40">
                  <ItemForm item={i} taxes={taxes} groups={groups} currencies={currencies} base={base} onDone={() => setEditing(null)} />
                </td>
              </tr>
            ) : (
              <tr key={i.id}>
                {canEdit && <td><input type="checkbox" name="ids" value={i.id} form="item-bulk" aria-label={`Select ${i.name}`} className="h-4 w-4 rounded border-slate-300 text-brand-600" /></td>}
                <td>
                  <div className="font-medium text-slate-900">{i.name}</div>
                  {i.description && <div className="text-xs text-slate-500">{i.description}</div>}
                  {i.hsn_sac && <div className="font-mono text-[11px] text-slate-400">HSN/SAC {i.hsn_sac}</div>}
                </td>
                <td className="hidden text-slate-600 md:table-cell">{i.group_name ?? "—"}</td>
                <td className="whitespace-nowrap text-right">
                  <div className="font-semibold">{formatMoney(Number(i.rate), base)}</div>
                  {Object.entries(i.currency_rates).map(([c, v]) => <div key={c} className="text-[11px] text-slate-500">{formatMoney(v, c)}</div>)}
                </td>
                <td className="hidden text-slate-600 sm:table-cell">{i.unit ?? "—"}</td>
                <td className="hidden text-slate-600 sm:table-cell">{i.tax_name ?? "No tax"}</td>
                <td className="hidden text-right tabular-nums text-slate-600 lg:table-cell" title="Lines on proposals, estimates and invoices">{i.used || "—"}</td>
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
