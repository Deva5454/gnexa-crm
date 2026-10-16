-- Gnexa CRM — Setup & utilities (batch 8)
--
-- Setup gains what Perfex has under Setup: Modules (switch whole features off), Menu Setup (reorder or hide
-- sidebar items), Theme Style (brand colour presets) and editable Estimate Request statuses.

alter table public.company_settings
  add column if not exists theme text not null default 'violet'
    check (theme in ('violet', 'indigo', 'blue', 'teal', 'emerald', 'rose', 'orange', 'slate')),
  add column if not exists disabled_modules text[] not null default '{}',
  add column if not exists menu_config jsonb not null default '{}'::jsonb;

-- ───────────────────────── Estimate request statuses ─────────────────────────
create table if not exists public.estimate_request_statuses (
  key         text primary key check (key ~ '^[a-z0-9_]{1,40}$'),
  name        text not null check (length(trim(name)) between 1 and 40),
  color       text not null default '#64748b' check (color ~ '^#[0-9a-fA-F]{6}$'),
  sort_order  int not null default 0,
  is_open     boolean not null default true   -- open requests show in the default list
);
insert into public.estimate_request_statuses (key, name, color, sort_order, is_open) values
  ('new', 'New', '#0ea5e9', 1, true),
  ('in_review', 'In review', '#f59e0b', 2, true),
  ('quoted', 'Quoted', '#10b981', 3, false),
  ('declined', 'Declined', '#64748b', 4, false)
on conflict (key) do nothing;

alter table public.estimate_request_statuses enable row level security;
drop policy if exists estimate_request_statuses_read on public.estimate_request_statuses;
drop policy if exists estimate_request_statuses_write on public.estimate_request_statuses;
create policy estimate_request_statuses_read on public.estimate_request_statuses for select to authenticated
  using ((select private.is_staff()));
create policy estimate_request_statuses_write on public.estimate_request_statuses for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- Requests point at a status row instead of a fixed list; a status in use can't be deleted
alter table public.estimate_requests drop constraint if exists estimate_requests_status_check;
alter table public.estimate_requests drop constraint if exists estimate_requests_status_fkey;
alter table public.estimate_requests add constraint estimate_requests_status_fkey
  foreign key (status) references public.estimate_request_statuses(key) on update cascade on delete restrict;
