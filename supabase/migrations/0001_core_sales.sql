-- Gnexa CRM — Phase 1: staff, roles, customers, contacts, leads, tasks, notes, activity

create extension if not exists pg_trgm;

-- ───────────────────────── Roles & staff ─────────────────────────
create table public.roles (
  id          bigint generated always as identity primary key,
  name        text not null unique,
  permissions jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null default '',
  email       text not null,
  phone       text,
  job_title   text,
  role_id     bigint references public.roles(id) on delete set null,
  is_admin    boolean not null default false,
  is_active   boolean not null default false,
  created_at  timestamptz not null default now()
);

create table public.company_settings (
  id            boolean primary key default true check (id),
  company_name  text not null default 'Gnexa CRM',
  currency      text not null default 'INR',
  date_format   text not null default 'dd MMM yyyy',
  updated_at    timestamptz not null default now()
);
insert into public.company_settings default values;

-- Helper predicates (security definer so they can read profiles under RLS)
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_active);
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_active and p.is_admin);
$$;

-- New auth user → profile. The very first user becomes an active admin;
-- everyone after that waits for an admin to activate them.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare first_user boolean;
begin
  select not exists (select 1 from public.profiles) into first_user;
  insert into public.profiles (id, email, full_name, is_admin, is_active)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    first_user,
    first_user
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Staff may edit their own name/phone/title but never their own admin/active/role flags
create or replace function public.guard_profile_update() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    if new.is_admin is distinct from old.is_admin
       or new.is_active is distinct from old.is_active
       or new.role_id is distinct from old.role_id
       or new.email is distinct from old.email then
      raise exception 'Only administrators can change roles or access';
    end if;
  end if;
  return new;
end;
$$;

create trigger profiles_guard before update on public.profiles
  for each row execute function public.guard_profile_update();

-- ───────────────────────── Customers ─────────────────────────
create table public.customer_groups (
  id    bigint generated always as identity primary key,
  name  text not null unique
);

create table public.customers (
  id          bigint generated always as identity primary key,
  company     text not null,
  vat         text,
  phone       text,
  website     text,
  address     text,
  city        text,
  state       text,
  zip         text,
  country     text,
  currency    text,
  group_id    bigint references public.customer_groups(id) on delete set null,
  is_active   boolean not null default true,
  created_by  uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now()
);
create index customers_company_trgm on public.customers using gin (company gin_trgm_ops);

create table public.contacts (
  id           bigint generated always as identity primary key,
  customer_id  bigint not null references public.customers(id) on delete cascade,
  first_name   text not null,
  last_name    text,
  email        text,
  phone        text,
  title        text,
  is_primary   boolean not null default false,
  created_at   timestamptz not null default now()
);
create index contacts_customer_idx on public.contacts(customer_id);

-- ───────────────────────── Leads ─────────────────────────
create table public.lead_statuses (
  id          bigint generated always as identity primary key,
  name        text not null unique,
  color       text not null default '#6366f1',
  sort_order  int not null default 0,
  is_won      boolean not null default false
);

create table public.lead_sources (
  id    bigint generated always as identity primary key,
  name  text not null unique
);

create table public.leads (
  id                     bigint generated always as identity primary key,
  name                   text not null,
  company                text,
  title                  text,
  email                  text,
  phone                  text,
  website                text,
  address                text,
  city                   text,
  country                text,
  value                  numeric(14,2),
  description            text,
  status_id              bigint references public.lead_statuses(id) on delete set null,
  source_id              bigint references public.lead_sources(id) on delete set null,
  assigned_to            uuid references public.profiles(id) on delete set null,
  position               double precision not null default 0,
  is_lost                boolean not null default false,
  is_junk                boolean not null default false,
  last_contact_at        timestamptz,
  converted_customer_id  bigint references public.customers(id) on delete set null,
  converted_at           timestamptz,
  created_by             uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at             timestamptz not null default now()
);
create index leads_status_idx on public.leads(status_id, position);
create index leads_assigned_idx on public.leads(assigned_to);
create index leads_name_trgm on public.leads using gin (name gin_trgm_ops);

-- ───────────────────────── Tasks ─────────────────────────
create type public.task_status as enum ('not_started','in_progress','testing','awaiting_feedback','complete');
create type public.task_priority as enum ('low','medium','high','urgent');

create table public.tasks (
  id            bigint generated always as identity primary key,
  name          text not null,
  description   text,
  status        public.task_status not null default 'not_started',
  priority      public.task_priority not null default 'medium',
  start_date    date default current_date,
  due_date      date,
  rel_type      text check (rel_type in ('customer','lead')),
  rel_id        bigint,
  completed_at  timestamptz,
  created_by    uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at    timestamptz not null default now()
);
create index tasks_rel_idx on public.tasks(rel_type, rel_id);
create index tasks_status_idx on public.tasks(status, due_date);

create table public.task_assignees (
  task_id   bigint not null references public.tasks(id) on delete cascade,
  staff_id  uuid not null references public.profiles(id) on delete cascade,
  primary key (task_id, staff_id)
);
create index task_assignees_staff_idx on public.task_assignees(staff_id);

create or replace function public.stamp_task_completion() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status = 'complete' and (tg_op = 'INSERT' or old.status <> 'complete') then
    new.completed_at := now();
  elsif new.status <> 'complete' then
    new.completed_at := null;
  end if;
  return new;
end;
$$;
create trigger tasks_completion before insert or update of status on public.tasks
  for each row execute function public.stamp_task_completion();

-- ───────────────────────── Notes & activity ─────────────────────────
create table public.notes (
  id          bigint generated always as identity primary key,
  rel_type    text not null check (rel_type in ('customer','lead')),
  rel_id      bigint not null,
  body        text not null,
  created_by  uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now()
);
create index notes_rel_idx on public.notes(rel_type, rel_id, created_at desc);

create table public.activity_log (
  id          bigint generated always as identity primary key,
  rel_type    text,
  rel_id      bigint,
  description text not null,
  actor_id    uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now()
);
create index activity_rel_idx on public.activity_log(rel_type, rel_id, created_at desc);
create index activity_created_idx on public.activity_log(created_at desc);

-- Convert a lead into a customer + primary contact atomically
create or replace function public.convert_lead(p_lead_id bigint) returns bigint
language plpgsql security invoker set search_path = '' as $$
declare
  l public.leads;
  cid bigint;
  won bigint;
begin
  if not public.is_staff() then raise exception 'not allowed'; end if;
  select * into l from public.leads where id = p_lead_id for update;
  if not found then raise exception 'lead not found'; end if;
  if l.converted_customer_id is not null then return l.converted_customer_id; end if;

  insert into public.customers (company, phone, website, address, city, country)
  values (coalesce(nullif(l.company, ''), l.name), l.phone, l.website, l.address, l.city, l.country)
  returning id into cid;

  insert into public.contacts (customer_id, first_name, last_name, email, phone, title, is_primary)
  values (cid, split_part(l.name, ' ', 1), nullif(substr(l.name, length(split_part(l.name, ' ', 1)) + 2), ''),
          l.email, l.phone, l.title, true);

  select id into won from public.lead_statuses where is_won order by sort_order limit 1;
  update public.leads
     set converted_customer_id = cid, converted_at = now(), status_id = coalesce(won, status_id)
   where id = p_lead_id;

  update public.notes set rel_type = 'customer', rel_id = cid where rel_type = 'lead' and rel_id = p_lead_id;

  insert into public.activity_log (rel_type, rel_id, description)
  values ('customer', cid, 'Converted from lead "' || l.name || '"');
  return cid;
end;
$$;

-- ───────────────────────── Row level security ─────────────────────────
alter table public.roles            enable row level security;
alter table public.profiles         enable row level security;
alter table public.company_settings enable row level security;
alter table public.customer_groups  enable row level security;
alter table public.customers        enable row level security;
alter table public.contacts         enable row level security;
alter table public.lead_statuses    enable row level security;
alter table public.lead_sources     enable row level security;
alter table public.leads            enable row level security;
alter table public.tasks            enable row level security;
alter table public.task_assignees   enable row level security;
alter table public.notes            enable row level security;
alter table public.activity_log     enable row level security;

-- Profiles: everyone signed in sees their own row (so pending users see their status);
-- staff see all; staff update self; admins update anyone.
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_staff()));
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy profiles_update_admin on public.profiles for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy profiles_delete_admin on public.profiles for delete to authenticated
  using ((select public.is_admin()) and id <> (select auth.uid()));

-- Admin-managed configuration: staff read, admins write
do $$
declare t text;
begin
  foreach t in array array['roles','company_settings','customer_groups','lead_statuses','lead_sources'] loop
    execute format('create policy %1$s_read on public.%1$I for select to authenticated using ((select public.is_staff()))', t);
    execute format('create policy %1$s_write on public.%1$I for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))', t);
  end loop;
end $$;

-- Shared CRM records: any active staff member has full access
do $$
declare t text;
begin
  foreach t in array array['customers','contacts','leads','tasks','task_assignees'] loop
    execute format('create policy %1$s_staff on public.%1$I for all to authenticated using ((select public.is_staff())) with check ((select public.is_staff()))', t);
  end loop;
end $$;

-- Notes/activity: staff read & add; only the author (or an admin) edits/deletes notes
create policy notes_select on public.notes for select to authenticated using ((select public.is_staff()));
create policy notes_insert on public.notes for insert to authenticated with check ((select public.is_staff()));
create policy notes_modify on public.notes for update to authenticated
  using ((select public.is_staff()) and (created_by = (select auth.uid()) or (select public.is_admin())));
create policy notes_delete on public.notes for delete to authenticated
  using ((select public.is_staff()) and (created_by = (select auth.uid()) or (select public.is_admin())));
create policy activity_select on public.activity_log for select to authenticated using ((select public.is_staff()));
create policy activity_insert on public.activity_log for insert to authenticated
  with check ((select public.is_staff()) and actor_id = (select auth.uid()));

revoke execute on function public.convert_lead(bigint) from public, anon;
grant execute on function public.convert_lead(bigint) to authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- ───────────────────────── Seed data ─────────────────────────
insert into public.roles (name, permissions) values
  ('Sales Manager', '{"customers":"full","leads":"full","tasks":"full"}'),
  ('Sales Executive', '{"customers":"edit","leads":"edit","tasks":"edit"}'),
  ('Support', '{"customers":"view","leads":"view","tasks":"edit"}');

insert into public.lead_statuses (name, color, sort_order, is_won) values
  ('New',          '#6366f1', 1, false),
  ('Contacted',    '#0ea5e9', 2, false),
  ('Qualified',    '#14b8a6', 3, false),
  ('Proposal Sent','#f59e0b', 4, false),
  ('Negotiation',  '#f97316', 5, false),
  ('Customer',     '#22c55e', 6, true);

insert into public.lead_sources (name) values
  ('Website'), ('Referral'), ('Google Ads'), ('Facebook'), ('LinkedIn'), ('Cold Call'), ('Trade Show');

insert into public.customer_groups (name) values ('VIP'), ('Wholesale'), ('Retail');
