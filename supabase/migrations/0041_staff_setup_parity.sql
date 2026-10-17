-- Gnexa CRM — Staff and Setup parity with Perfex (batch 27)
--
--   • Staff notes: private notes administrators keep on a team member (Perfex staff profile → Notes)
--   • Setup → Settings: invoice and quote defaults (due days, validity days, default notes and terms)
--     and the default country for new customers

create table if not exists public.staff_notes (
  id          bigint generated always as identity primary key,
  staff_id    uuid not null references public.profiles(id) on delete cascade,
  body        text not null check (length(trim(body)) between 1 and 5000),
  created_by  uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now()
);
create index if not exists staff_notes_staff_idx on public.staff_notes(staff_id, created_at desc);
create index if not exists staff_notes_created_by_idx on public.staff_notes(created_by);
alter table public.staff_notes enable row level security;
drop policy if exists staff_notes_admin on public.staff_notes;
create policy staff_notes_admin on public.staff_notes for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

alter table public.company_settings add column if not exists invoice_due_days int not null default 15;
alter table public.company_settings add column if not exists quote_valid_days int not null default 30;
alter table public.company_settings add column if not exists invoice_note text default 'Thank you for your business.';
alter table public.company_settings add column if not exists estimate_terms text default 'Prices valid until the expiry date. Taxes as applicable.';
alter table public.company_settings add column if not exists proposal_terms text;
alter table public.company_settings add column if not exists default_country text default 'India';
alter table public.company_settings drop constraint if exists company_settings_invoice_due_days_check;
alter table public.company_settings add constraint company_settings_invoice_due_days_check check (invoice_due_days between 0 and 365);
alter table public.company_settings drop constraint if exists company_settings_quote_valid_days_check;
alter table public.company_settings add constraint company_settings_quote_valid_days_check check (quote_valid_days between 1 and 365);
