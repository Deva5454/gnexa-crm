-- Gnexa CRM — Invoices parity with Perfex (batch 12)
--
--   • Sale agent: the staff member credited with a sales document (filters and reports)
--   • Admin note: a private note on the document, never printed or shown to the customer. It lives in its own
--     staff-only table — portal users can read their own sales_docs rows, so a column there wouldn't be private
--   • Document files: attachments on invoices, estimates, proposals and credit notes, in a private
--     "sales-files" bucket that follows the sales permission (view to download, edit to upload;
--     the uploader or someone with full access removes a file)

alter table public.sales_docs add column if not exists sale_agent uuid references public.profiles(id) on delete set null;
create index if not exists sales_docs_sale_agent_idx on public.sales_docs(sale_agent);

create table if not exists public.sales_doc_notes (
  doc_id      bigint primary key references public.sales_docs(id) on delete cascade,
  note        text not null check (length(note) <= 5000),
  updated_by  uuid references public.profiles(id) on delete set null default auth.uid(),
  updated_at  timestamptz not null default now()
);
alter table public.sales_doc_notes enable row level security;
drop policy if exists sales_doc_notes_read on public.sales_doc_notes;
drop policy if exists sales_doc_notes_write on public.sales_doc_notes;
create policy sales_doc_notes_read on public.sales_doc_notes for select to authenticated
  using ((select private.has_perm('sales', 'view')));
create policy sales_doc_notes_write on public.sales_doc_notes for all to authenticated
  using ((select private.has_perm('sales', 'edit'))) with check ((select private.has_perm('sales', 'edit')));

create table if not exists public.sales_doc_files (
  id           bigint generated always as identity primary key,
  doc_id       bigint not null references public.sales_docs(id) on delete cascade,
  name         text not null,
  path         text not null unique,
  size         bigint not null default 0,
  mime         text,
  uploaded_by  uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now()
);
create index if not exists sales_doc_files_doc_idx on public.sales_doc_files(doc_id);
create index if not exists sales_doc_files_uploaded_by_idx on public.sales_doc_files(uploaded_by);
alter table public.sales_doc_files enable row level security;

drop policy if exists sales_doc_files_staff_read on public.sales_doc_files;
drop policy if exists sales_doc_files_staff_insert on public.sales_doc_files;
drop policy if exists sales_doc_files_staff_delete on public.sales_doc_files;
create policy sales_doc_files_staff_read on public.sales_doc_files for select to authenticated
  using ((select private.has_perm('sales', 'view')));
create policy sales_doc_files_staff_insert on public.sales_doc_files for insert to authenticated
  with check ((select private.has_perm('sales', 'edit')) and uploaded_by = (select auth.uid()));
create policy sales_doc_files_staff_delete on public.sales_doc_files for delete to authenticated
  using ((select private.has_perm('sales', 'full')) or (uploaded_by = (select auth.uid()) and (select private.has_perm('sales', 'edit'))));

insert into storage.buckets (id, name, public, file_size_limit)
values ('sales-files', 'sales-files', false, 10485760)
on conflict (id) do nothing;

drop policy if exists sales_files_read on storage.objects;
drop policy if exists sales_files_write on storage.objects;
drop policy if exists sales_files_remove on storage.objects;
create policy sales_files_read on storage.objects for select to authenticated
  using (bucket_id = 'sales-files' and (select private.has_perm('sales', 'view')));
create policy sales_files_write on storage.objects for insert to authenticated
  with check (bucket_id = 'sales-files' and (select private.has_perm('sales', 'edit')));
create policy sales_files_remove on storage.objects for delete to authenticated
  using (bucket_id = 'sales-files' and ((select private.has_perm('sales', 'full')) or (owner_id = (select auth.uid())::text and (select private.has_perm('sales', 'edit')))));
