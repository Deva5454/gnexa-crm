-- Gnexa CRM — billable expenses on invoices: each invoice line remembers the expense it bills,
-- so removing the line (or cancelling the invoice) puts the expense back to "pending billing".

alter table public.sales_doc_items add column expense_id bigint references public.expenses(id) on delete set null;
create index sales_doc_items_expense_idx on public.sales_doc_items(expense_id);

-- Link lines for expenses that were already billed (one line per expense, matched by name)
update public.sales_doc_items i set expense_id = e.id
from public.expenses e
where e.invoice_id = i.doc_id and i.description = e.name and i.expense_id is null;
