-- Gnexa CRM — Phase 2: finance (proposals, estimates, invoices, credit notes, payments, expenses, items, taxes)

-- ───────────────────────── Company details printed on documents ─────────────────────────
alter table public.company_settings
  add column if not exists address       text,
  add column if not exists gstin         text,
  add column if not exists email         text,
  add column if not exists phone         text,
  add column if not exists bank_details  text,
  add column if not exists default_terms text;

-- ───────────────────────── Catalogue & lookups ─────────────────────────
create table public.taxes (
  id    bigint generated always as identity primary key,
  name  text not null unique,
  rate  numeric(5,2) not null check (rate >= 0 and rate <= 100)
);

create table public.items (
  id           bigint generated always as identity primary key,
  name         text not null,
  description  text,
  rate         numeric(14,2) not null default 0,
  unit         text,
  tax_id       bigint references public.taxes(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index items_tax_idx on public.items(tax_id);

create table public.payment_modes (
  id         bigint generated always as identity primary key,
  name       text not null unique,
  is_active  boolean not null default true
);

create table public.expense_categories (
  id    bigint generated always as identity primary key,
  name  text not null unique
);

-- ───────────────────────── Sales documents ─────────────────────────
create type public.doc_kind as enum ('proposal', 'estimate', 'invoice', 'credit_note');

-- One table for all four document types: they share customer, line items, tax and totals.
-- status: draft | sent | accepted | declined | cancelled   (paid/overdue/expired are derived)
create table public.sales_docs (
  id              bigint generated always as identity primary key,
  kind            public.doc_kind not null,
  number          int not null,
  customer_id     bigint references public.customers(id) on delete restrict,
  lead_id         bigint references public.leads(id) on delete cascade,
  subject         text,
  content         text,
  date            date not null default current_date,
  due_date        date,
  status          text not null default 'draft' check (status in ('draft','sent','accepted','declined','cancelled')),
  currency        text not null default 'INR',
  discount_percent numeric(5,2) not null default 0 check (discount_percent >= 0 and discount_percent <= 100),
  adjustment      numeric(14,2) not null default 0,
  subtotal        numeric(14,2) not null default 0,
  discount_total  numeric(14,2) not null default 0,
  tax_total       numeric(14,2) not null default 0,
  total           numeric(14,2) not null default 0,
  notes           text,
  terms           text,
  source_id       bigint references public.sales_docs(id) on delete set null,
  sent_at         timestamptz,
  created_by      uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at      timestamptz not null default now(),
  unique (kind, number),
  check (kind = 'proposal' or customer_id is not null),
  check (customer_id is not null or lead_id is not null)
);
create index sales_docs_kind_idx on public.sales_docs(kind, date desc);
create index sales_docs_customer_idx on public.sales_docs(customer_id);
create index sales_docs_lead_idx on public.sales_docs(lead_id);
create index sales_docs_source_idx on public.sales_docs(source_id);
create index sales_docs_created_by_idx on public.sales_docs(created_by);

create table public.sales_doc_items (
  id               bigint generated always as identity primary key,
  doc_id           bigint not null references public.sales_docs(id) on delete cascade,
  position         int not null default 0,
  item_id          bigint references public.items(id) on delete set null,
  description      text not null,
  long_description text,
  qty              numeric(12,2) not null default 1 check (qty > 0),
  unit             text,
  rate             numeric(14,2) not null default 0,
  tax_rate         numeric(5,2) not null default 0
);
create index sales_doc_items_doc_idx on public.sales_doc_items(doc_id, position);
create index sales_doc_items_item_idx on public.sales_doc_items(item_id);

-- Sequential numbers per document type
create or replace function private.assign_doc_number() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.number is null or new.number = 0 then
    perform pg_advisory_xact_lock(hashtext('sales_docs:' || new.kind::text));
    select coalesce(max(number), 0) + 1 into new.number from public.sales_docs where kind = new.kind;
  end if;
  return new;
end;
$$;
alter table public.sales_docs alter column number set default 0;
create trigger sales_docs_number before insert on public.sales_docs
  for each row execute function private.assign_doc_number();
revoke execute on function private.assign_doc_number() from public, anon, authenticated;

-- ───────────────────────── Money in / credits / money out ─────────────────────────
create table public.payments (
  id              bigint generated always as identity primary key,
  invoice_id      bigint not null references public.sales_docs(id) on delete cascade,
  amount          numeric(14,2) not null check (amount > 0),
  date            date not null default current_date,
  mode_id         bigint references public.payment_modes(id) on delete set null,
  transaction_id  text,
  note            text,
  created_by      uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at      timestamptz not null default now()
);
create index payments_invoice_idx on public.payments(invoice_id);
create index payments_mode_idx on public.payments(mode_id);
create index payments_date_idx on public.payments(date desc);
create index payments_created_by_idx on public.payments(created_by);

create table public.credit_applications (
  id              bigint generated always as identity primary key,
  credit_note_id  bigint not null references public.sales_docs(id) on delete cascade,
  invoice_id      bigint not null references public.sales_docs(id) on delete cascade,
  amount          numeric(14,2) not null check (amount > 0),
  date            date not null default current_date,
  created_by      uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at      timestamptz not null default now()
);
create index credit_apps_cn_idx on public.credit_applications(credit_note_id);
create index credit_apps_inv_idx on public.credit_applications(invoice_id);
create index credit_apps_created_by_idx on public.credit_applications(created_by);

create table public.expenses (
  id               bigint generated always as identity primary key,
  name             text not null,
  category_id      bigint references public.expense_categories(id) on delete set null,
  amount           numeric(14,2) not null check (amount >= 0),
  tax_rate         numeric(5,2) not null default 0,
  date             date not null default current_date,
  customer_id      bigint references public.customers(id) on delete set null,
  payment_mode_id  bigint references public.payment_modes(id) on delete set null,
  reference        text,
  note             text,
  is_billable      boolean not null default false,
  invoice_id       bigint references public.sales_docs(id) on delete set null,
  created_by       uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at       timestamptz not null default now()
);
create index expenses_date_idx on public.expenses(date desc);
create index expenses_category_idx on public.expenses(category_id);
create index expenses_customer_idx on public.expenses(customer_id);
create index expenses_mode_idx on public.expenses(payment_mode_id);
create index expenses_invoice_idx on public.expenses(invoice_id);
create index expenses_created_by_idx on public.expenses(created_by);

-- Paid / credited / balance per document (invoices: received money; credit notes: credit used)
create view public.doc_balances with (security_invoker = true) as
select d.id,
       coalesce(p.paid, 0)                         as paid,
       coalesce(ci.credited, 0)                    as credited,
       coalesce(cn.used, 0)                        as credit_used,
       d.total - coalesce(p.paid, 0) - coalesce(ci.credited, 0) - coalesce(cn.used, 0) as balance
from public.sales_docs d
left join (select invoice_id, sum(amount) paid from public.payments group by invoice_id) p on p.invoice_id = d.id
left join (select invoice_id, sum(amount) credited from public.credit_applications group by invoice_id) ci on ci.invoice_id = d.id
left join (select credit_note_id, sum(amount) used from public.credit_applications group by credit_note_id) cn on cn.credit_note_id = d.id;

-- ───────────────────────── RLS ─────────────────────────
alter table public.taxes               enable row level security;
alter table public.items               enable row level security;
alter table public.payment_modes       enable row level security;
alter table public.expense_categories  enable row level security;
alter table public.sales_docs          enable row level security;
alter table public.sales_doc_items     enable row level security;
alter table public.payments            enable row level security;
alter table public.credit_applications enable row level security;
alter table public.expenses            enable row level security;

-- Lookups: staff read, admins write (one policy per action)
do $$
declare t text;
begin
  foreach t in array array['taxes','payment_modes','expense_categories'] loop
    execute format('create policy %1$s_read on public.%1$I for select to authenticated using ((select private.is_staff()))', t);
    execute format('create policy %1$s_insert on public.%1$I for insert to authenticated with check ((select private.is_admin()))', t);
    execute format('create policy %1$s_update on public.%1$I for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()))', t);
    execute format('create policy %1$s_delete on public.%1$I for delete to authenticated using ((select private.is_admin()))', t);
  end loop;
end $$;

-- Business records: any active staff member (role rules are enforced in the app)
do $$
declare t text;
begin
  foreach t in array array['items','sales_docs','sales_doc_items','payments','credit_applications','expenses'] loop
    execute format('create policy %1$s_staff on public.%1$I for all to authenticated using ((select private.is_staff())) with check ((select private.is_staff()))', t);
  end loop;
end $$;

-- ───────────────────────── Role permissions for the new modules ─────────────────────────
update public.roles set permissions = permissions || '{"sales":"full","expenses":"full"}' where name = 'Sales Manager';
update public.roles set permissions = permissions || '{"sales":"edit","expenses":"edit"}' where name = 'Sales Executive';
update public.roles set permissions = permissions || '{"sales":"view","expenses":"none"}' where name = 'Support';

-- ───────────────────────── Seed lookups ─────────────────────────
insert into public.taxes (name, rate) values ('GST 5%', 5), ('GST 12%', 12), ('GST 18%', 18), ('GST 28%', 28);
insert into public.payment_modes (name) values ('Bank transfer (NEFT/RTGS)'), ('UPI'), ('Cheque'), ('Cash'), ('Card');
insert into public.expense_categories (name) values ('Travel'), ('Office supplies'), ('Software & subscriptions'), ('Marketing'), ('Meals & entertainment'), ('Utilities'), ('Contractors');

update public.company_settings set
  address = coalesce(address, E'4th Floor, Prestige Tech Park\nOuter Ring Road, Bengaluru 560103\nKarnataka, India'),
  gstin = coalesce(gstin, '29AAGCG1234F1Z5'),
  email = coalesce(email, 'accounts@gnexa.example.in'),
  phone = coalesce(phone, '+91 80 4000 2026'),
  bank_details = coalesce(bank_details, E'HDFC Bank · Koramangala branch\nA/c 50200012345678 · IFSC HDFC0001234'),
  default_terms = coalesce(default_terms, E'Payment due within 15 days of invoice date.\nPlease quote the invoice number with your payment.');
