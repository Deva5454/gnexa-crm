-- Gnexa CRM — Customers parity with Perfex (batch 11)
--
--   • Shipping address on customers (the existing address is the billing address)
--   • Customer admins: staff assigned to look after a customer ("My customers")
--   • Customer files: attachments on the customer, in a private "customer-files" bucket that follows the
--     customers permission (view to download, edit to upload; the uploader or full access removes a file)

alter table public.customers add column if not exists shipping_address text;
alter table public.customers add column if not exists shipping_city text;
alter table public.customers add column if not exists shipping_state text;
alter table public.customers add column if not exists shipping_zip text;
alter table public.customers add column if not exists shipping_country text;

-- ───────────────────────── Customer admins ─────────────────────────
create table if not exists public.customer_admins (
  customer_id  bigint not null references public.customers(id) on delete cascade,
  staff_id     uuid not null references public.profiles(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (customer_id, staff_id)
);
create index if not exists customer_admins_staff_idx on public.customer_admins(staff_id);
alter table public.customer_admins enable row level security;

drop policy if exists customer_admins_read on public.customer_admins;
drop policy if exists customer_admins_insert on public.customer_admins;
drop policy if exists customer_admins_delete on public.customer_admins;
create policy customer_admins_read on public.customer_admins for select to authenticated
  using ((select private.has_perm('customers', 'view')));
create policy customer_admins_insert on public.customer_admins for insert to authenticated
  with check ((select private.has_perm('customers', 'edit')));
-- assigning people is part of editing the customer, so removing one is an edit too
create policy customer_admins_delete on public.customer_admins for delete to authenticated
  using ((select private.has_perm('customers', 'edit')));

-- ───────────────────────── Customer files ─────────────────────────
create table if not exists public.customer_files (
  id           bigint generated always as identity primary key,
  customer_id  bigint not null references public.customers(id) on delete cascade,
  name         text not null,
  path         text not null unique,
  size         bigint not null default 0,
  mime         text,
  uploaded_by  uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now()
);
create index if not exists customer_files_customer_idx on public.customer_files(customer_id);
create index if not exists customer_files_uploaded_by_idx on public.customer_files(uploaded_by);
alter table public.customer_files enable row level security;

drop policy if exists customer_files_staff_read on public.customer_files;
drop policy if exists customer_files_staff_insert on public.customer_files;
drop policy if exists customer_files_staff_delete on public.customer_files;
create policy customer_files_staff_read on public.customer_files for select to authenticated
  using ((select private.has_perm('customers', 'view')));
create policy customer_files_staff_insert on public.customer_files for insert to authenticated
  with check ((select private.has_perm('customers', 'edit')) and uploaded_by = (select auth.uid()));
create policy customer_files_staff_delete on public.customer_files for delete to authenticated
  using ((select private.has_perm('customers', 'full')) or (uploaded_by = (select auth.uid()) and (select private.has_perm('customers', 'edit'))));

insert into storage.buckets (id, name, public, file_size_limit)
values ('customer-files', 'customer-files', false, 10485760)
on conflict (id) do nothing;

drop policy if exists customer_files_read on storage.objects;
drop policy if exists customer_files_write on storage.objects;
drop policy if exists customer_files_remove on storage.objects;
create policy customer_files_read on storage.objects for select to authenticated
  using (bucket_id = 'customer-files' and (select private.has_perm('customers', 'view')));
create policy customer_files_write on storage.objects for insert to authenticated
  with check (bucket_id = 'customer-files' and (select private.has_perm('customers', 'edit')));
create policy customer_files_remove on storage.objects for delete to authenticated
  using (bucket_id = 'customer-files' and ((select private.has_perm('customers', 'full')) or (owner_id = (select auth.uid())::text and (select private.has_perm('customers', 'edit')))));
