import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Download, Package, Trash2, Upload } from "lucide-react";
import { BulkBar } from "@/components/crm/bulk-bar";
import { LinkButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { ParamSelect } from "@/components/ui/param-select";
import { SearchInput } from "@/components/ui/search-input";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireStaff } from "@/lib/auth";
import { allRows } from "@/lib/fetch-all";
import { baseCurrency } from "@/lib/sales-data";
import { PAGE_SIZE, searchTerm } from "@/lib/utils";
import { bulkItems, deleteItemGroup, saveItemGroup } from "../actions";
import { ItemForm } from "./item-form";
import { ItemsTable } from "./items-table";

export const metadata: Metadata = { title: "Items" };

type SP = { q?: string; group?: string; sort?: string; page?: string };

const SORTS = [
  { value: "rate_desc", label: "Rate: high to low" },
  { value: "rate_asc", label: "Rate: low to high" },
  { value: "used", label: "Most used" },
  { value: "newest", label: "Newest first" },
];

export default async function ItemsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const { supabase, can } = await requireStaff();
  if (!can("sales", "view")) notFound();
  const canEdit = can("sales", "edit");
  const canDelete = can("sales", "full");

  const term = sp.q ? searchTerm(sp.q) : "";
  const [{ data: items }, { data: taxes }, { data: groups }, { data: currencies }, { data: lines }, { data: grouped }, base] = await Promise.all([
    allRows((a, b) => {
      let q = supabase.from("items").select("id, name, description, rate, unit, tax_id, hsn_sac, group_id, currency_rates, created_at, tax:taxes(name), group:item_groups(name)").order("id").range(a, b);
      if (term) q = q.or(`name.ilike.%${term}%,description.ilike.%${term}%,hsn_sac.ilike.%${term}%`);
      if (sp.group === "none") q = q.is("group_id", null);
      else if (Number(sp.group)) q = q.eq("group_id", Number(sp.group));
      return q;
    }),
    supabase.from("taxes").select("id, name").order("rate"),
    supabase.from("item_groups").select("id, name").order("position").order("name"),
    supabase.from("currencies").select("code, is_base").order("code"),
    allRows((a, b) => supabase.from("sales_doc_items").select("item_id").not("item_id", "is", null).order("id").range(a, b)),
    allRows((a, b) => supabase.from("items").select("group_id").not("group_id", "is", null).order("id").range(a, b)),
    baseCurrency(supabase),
  ]);

  // How many document lines use each item
  const used = new Map<number, number>();
  for (const l of lines ?? []) if (l.item_id) used.set(l.item_id, (used.get(l.item_id) ?? 0) + 1);
  const groupCount = new Map<number, number>();
  for (const i of grouped ?? []) if (i.group_id) groupCount.set(i.group_id, (groupCount.get(i.group_id) ?? 0) + 1);

  const rows = (items ?? []).map((i) => ({
    id: i.id, name: i.name, description: i.description, rate: Number(i.rate), unit: i.unit, tax_id: i.tax_id, hsn_sac: i.hsn_sac,
    group_id: i.group_id, currency_rates: (i.currency_rates ?? {}) as Record<string, number>, created_at: i.created_at,
    tax_name: i.tax?.name ?? null, group_name: i.group?.name ?? null, used: used.get(i.id) ?? 0,
  }));
  rows.sort((x, y) => {
    switch (sp.sort) {
      case "rate_desc": return y.rate - x.rate || x.name.localeCompare(y.name);
      case "rate_asc": return x.rate - y.rate || x.name.localeCompare(y.name);
      case "used": return y.used - x.used || x.name.localeCompare(y.name);
      case "newest": return y.created_at.localeCompare(x.created_at) || y.id - x.id;
      default: return x.name.localeCompare(y.name, undefined, { sensitivity: "base" });
    }
  });
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const others = (currencies ?? []).filter((c) => !c.is_base && c.code !== base).map((c) => c.code);
  const groupOpts = (groups ?? []).map((g) => ({ value: String(g.id), label: g.name }));
  const taxOpts = (taxes ?? []).map((t) => ({ value: String(t.id), label: t.name }));
  const filtered = Boolean(sp.q || sp.group);

  return (
    <>
      <PageHeader
        title="Items"
        description="Products and services you sell — pick them when building proposals, estimates and invoices."
        actions={
          <>
            <LinkButton href="/csv-export/items" variant="secondary"><Download className="h-4 w-4" /> Export</LinkButton>
            {canEdit && <LinkButton href="/sales/items/import" variant="secondary"><Upload className="h-4 w-4" /> Import</LinkButton>}
          </>
        }
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-6">
          {canEdit && (
            <Card>
              <CardHeader title="Add an item" />
              <CardBody><ItemForm taxes={taxes ?? []} groups={groups ?? []} currencies={others} base={base} /></CardBody>
            </Card>
          )}
          <Card>
            <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-1.5">
                <ParamSelect name="group" label="Group" allLabel="All groups" options={[...groupOpts, { value: "none", label: "No group" }]} />
                <ParamSelect name="sort" label="Sort" allLabel="Name A–Z" options={SORTS} />
                <span className="text-xs text-slate-400">{rows.length} item{rows.length === 1 ? "" : "s"}</span>
              </div>
              <SearchInput placeholder="Search name, description or HSN…" />
            </div>
            {!pageRows.length ? (
              <EmptyState icon={Package} title={filtered ? "No matching items" : "No items yet"} description={filtered ? "Nothing matches these filters." : "Add the products and services you sell most often."} />
            ) : (
              <>
                {canEdit && (
                  <BulkBar
                    id="item-bulk"
                    action={bulkItems}
                    noun="item"
                    ops={[
                      { value: "group", label: "Move to group", target: { label: "Group", options: [...groupOpts, { value: "none", label: "No group" }] } },
                      { value: "tax", label: "Change tax", target: { label: "Tax", options: [...taxOpts, { value: "none", label: "No tax" }] } },
                      ...(canDelete ? [{ value: "delete", label: "Delete", danger: true }] : []),
                    ]}
                  />
                )}
                <ItemsTable items={pageRows} taxes={taxes ?? []} groups={groups ?? []} currencies={others} base={base} canEdit={canEdit} canDelete={canDelete} />
                <Pagination page={page} pageSize={PAGE_SIZE} total={rows.length} basePath="/sales/items" params={{ q: sp.q, group: sp.group, sort: sp.sort }} />
              </>
            )}
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader title="Item groups" description="Group the catalogue — the item picker on documents follows these groups." />
          <CardBody className="space-y-2">
            {(groups ?? []).map((g) =>
              canEdit ? (
                <div key={g.id} className="flex items-center gap-1.5">
                  <form action={saveItemGroup} className="flex min-w-0 flex-1 items-center gap-1.5">
                    <input type="hidden" name="id" value={g.id} />
                    <input name="name" defaultValue={g.name} required maxLength={80} aria-label={`Rename group ${g.name}`} className="field h-8 min-w-0 flex-1 py-0 text-sm" />
                    <span className="w-6 text-right text-xs tabular-nums text-slate-400" title="Items in this group">{groupCount.get(g.id) ?? 0}</span>
                    <SubmitButton size="sm" variant="secondary">Save</SubmitButton>
                  </form>
                  <ConfirmForm action={deleteItemGroup} message={`Delete the group “${g.name}”? Its items stay in the catalogue without a group.`}>
                    <input type="hidden" name="id" value={g.id} />
                    <button className="rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label={`Delete group ${g.name}`}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </ConfirmForm>
                </div>
              ) : (
                <div key={g.id} className="flex justify-between text-sm text-slate-700">
                  <span>{g.name}</span>
                  <span className="text-xs text-slate-400">{groupCount.get(g.id) ?? 0}</span>
                </div>
              ),
            )}
            {!groups?.length && <p className="text-sm text-slate-500">No groups yet.</p>}
            {canEdit && (
              <form action={saveItemGroup} className="flex items-center gap-1.5 border-t border-slate-100 pt-3">
                <input name="name" required maxLength={80} placeholder="New group…" aria-label="New group name" className="field h-8 min-w-0 flex-1 py-0 text-sm" />
                <SubmitButton size="sm">Add</SubmitButton>
              </form>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
