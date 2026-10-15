-- Gnexa CRM — Phase 3: projects (milestones, timesheets, files, discussion), contracts, support tickets, knowledge base

-- ───────────────────────── Projects ─────────────────────────
create table public.projects (
  id            bigint generated always as identity primary key,
  name          text not null,
  customer_id   bigint not null references public.customers(id) on delete restrict,
  status        text not null default 'not_started'
                check (status in ('not_started','in_progress','on_hold','cancelled','finished')),
  billing_type  text not null default 'fixed' check (billing_type in ('fixed','hourly')),
  fixed_price   numeric(14,2),
  hourly_rate   numeric(14,2),
  start_date    date not null default current_date,
  deadline      date,
  description   text,
  created_by    uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at    timestamptz not null default now(),
  check (deadline is null or deadline >= start_date)
);
create index projects_customer_idx on public.projects(customer_id);
create index projects_status_idx on public.projects(status);
create index projects_created_by_idx on public.projects(created_by);

create table public.project_members (
  project_id  bigint not null references public.projects(id) on delete cascade,
  staff_id    uuid not null references public.profiles(id) on delete cascade,
  primary key (project_id, staff_id)
);
create index project_members_staff_idx on public.project_members(staff_id);

create table public.milestones (
  id           bigint generated always as identity primary key,
  project_id   bigint not null references public.projects(id) on delete cascade,
  name         text not null,
  description  text,
  due_date     date,
  position     int not null default 0,
  is_complete  boolean not null default false
);
create index milestones_project_idx on public.milestones(project_id, position);

-- Invoices raised from a project remember it
alter table public.sales_docs add column if not exists project_id bigint references public.projects(id) on delete set null;
create index if not exists sales_docs_project_idx on public.sales_docs(project_id);

-- Tasks can now belong to a project (and one of its milestones)
alter table public.tasks drop constraint if exists tasks_rel_type_check;
alter table public.tasks add constraint tasks_rel_type_check check (rel_type in ('customer','lead','project'));
alter table public.tasks add column if not exists milestone_id bigint references public.milestones(id) on delete set null;
create index if not exists tasks_milestone_idx on public.tasks(milestone_id);

create table public.timesheets (
  id           bigint generated always as identity primary key,
  project_id   bigint not null references public.projects(id) on delete cascade,
  task_id      bigint references public.tasks(id) on delete set null,
  staff_id     uuid references public.profiles(id) on delete set null default auth.uid(),
  date         date not null default current_date,
  hours        numeric(5,2) not null check (hours > 0 and hours <= 24),
  note         text,
  is_billable  boolean not null default true,
  invoice_id   bigint references public.sales_docs(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index timesheets_project_idx on public.timesheets(project_id, date desc);
create index timesheets_task_idx on public.timesheets(task_id);
create index timesheets_staff_idx on public.timesheets(staff_id);
create index timesheets_invoice_idx on public.timesheets(invoice_id);

create table public.project_files (
  id           bigint generated always as identity primary key,
  project_id   bigint not null references public.projects(id) on delete cascade,
  name         text not null,
  path         text not null unique,
  size         bigint not null default 0,
  mime         text,
  uploaded_by  uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now()
);
create index project_files_project_idx on public.project_files(project_id);
create index project_files_uploaded_by_idx on public.project_files(uploaded_by);

create table public.project_comments (
  id          bigint generated always as identity primary key,
  project_id  bigint not null references public.projects(id) on delete cascade,
  body        text not null,
  created_by  uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now()
);
create index project_comments_project_idx on public.project_comments(project_id, created_at desc);
create index project_comments_created_by_idx on public.project_comments(created_by);

-- ───────────────────────── Contracts ─────────────────────────
create table public.contract_types (
  id    bigint generated always as identity primary key,
  name  text not null unique
);

-- status: draft | sent | signed | cancelled  (active / expiring / expired are derived from dates)
create table public.contracts (
  id           bigint generated always as identity primary key,
  customer_id  bigint not null references public.customers(id) on delete restrict,
  type_id      bigint references public.contract_types(id) on delete set null,
  subject      text not null,
  value        numeric(14,2),
  start_date   date not null default current_date,
  end_date     date,
  content      text,
  status       text not null default 'draft' check (status in ('draft','sent','signed','cancelled')),
  signed_by    text,
  signed_at    timestamptz,
  created_by   uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now(),
  check (end_date is null or end_date >= start_date)
);
create index contracts_customer_idx on public.contracts(customer_id);
create index contracts_type_idx on public.contracts(type_id);
create index contracts_end_idx on public.contracts(end_date);
create index contracts_created_by_idx on public.contracts(created_by);

-- ───────────────────────── Support ─────────────────────────
create table public.ticket_departments (
  id    bigint generated always as identity primary key,
  name  text not null unique
);

create table public.tickets (
  id             bigint generated always as identity primary key,
  subject        text not null,
  customer_id    bigint references public.customers(id) on delete set null,
  contact_id     bigint references public.contacts(id) on delete set null,
  department_id  bigint references public.ticket_departments(id) on delete set null,
  project_id     bigint references public.projects(id) on delete set null,
  priority       text not null default 'medium' check (priority in ('low','medium','high','urgent')),
  status         text not null default 'open' check (status in ('open','in_progress','answered','on_hold','closed')),
  assigned_to    uuid references public.profiles(id) on delete set null,
  last_reply_at  timestamptz not null default now(),
  closed_at      timestamptz,
  created_by     uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at     timestamptz not null default now()
);
create index tickets_status_idx on public.tickets(status, last_reply_at desc);
create index tickets_customer_idx on public.tickets(customer_id);
create index tickets_contact_idx on public.tickets(contact_id);
create index tickets_department_idx on public.tickets(department_id);
create index tickets_project_idx on public.tickets(project_id);
create index tickets_assigned_idx on public.tickets(assigned_to);
create index tickets_created_by_idx on public.tickets(created_by);

-- author_id = staff reply; author_name = reply on behalf of the customer's contact
create table public.ticket_replies (
  id           bigint generated always as identity primary key,
  ticket_id    bigint not null references public.tickets(id) on delete cascade,
  body         text not null,
  author_id    uuid references public.profiles(id) on delete set null,
  author_name  text,
  is_internal  boolean not null default false,
  created_at   timestamptz not null default now()
);
create index ticket_replies_ticket_idx on public.ticket_replies(ticket_id, created_at);
create index ticket_replies_author_idx on public.ticket_replies(author_id);

-- ───────────────────────── Knowledge base ─────────────────────────
create table public.kb_groups (
  id           bigint generated always as identity primary key,
  name         text not null unique,
  description  text,
  position     int not null default 0
);

create table public.kb_articles (
  id            bigint generated always as identity primary key,
  group_id      bigint references public.kb_groups(id) on delete set null,
  title         text not null,
  slug          text not null unique,
  body          text not null default '',
  is_published  boolean not null default true,
  views         int not null default 0,
  helpful       int not null default 0,
  not_helpful   int not null default 0,
  created_by    uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index kb_articles_group_idx on public.kb_articles(group_id);
create index kb_articles_created_by_idx on public.kb_articles(created_by);

-- Counting views / votes must work for view-only roles too, so it goes through a function
create or replace function public.kb_track(p_article bigint, p_event text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_staff() then raise exception 'not allowed'; end if;
  update public.kb_articles set
    views       = views       + (p_event = 'view')::int,
    helpful     = helpful     + (p_event = 'yes')::int,
    not_helpful = not_helpful + (p_event = 'no')::int
  where id = p_article;
end;
$$;
revoke execute on function public.kb_track(bigint, text) from public, anon;
grant execute on function public.kb_track(bigint, text) to authenticated;

-- ───────────────────────── RLS ─────────────────────────
alter table public.projects           enable row level security;
alter table public.project_members    enable row level security;
alter table public.milestones         enable row level security;
alter table public.timesheets         enable row level security;
alter table public.project_files      enable row level security;
alter table public.project_comments   enable row level security;
alter table public.contract_types     enable row level security;
alter table public.contracts          enable row level security;
alter table public.ticket_departments enable row level security;
alter table public.tickets            enable row level security;
alter table public.ticket_replies     enable row level security;
alter table public.kb_groups          enable row level security;
alter table public.kb_articles        enable row level security;

do $$
declare t text;
begin
  foreach t in array array['contract_types','ticket_departments','kb_groups'] loop
    execute format('create policy %1$s_read on public.%1$I for select to authenticated using ((select private.is_staff()))', t);
    execute format('create policy %1$s_insert on public.%1$I for insert to authenticated with check ((select private.is_admin()))', t);
    execute format('create policy %1$s_update on public.%1$I for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()))', t);
    execute format('create policy %1$s_delete on public.%1$I for delete to authenticated using ((select private.is_admin()))', t);
  end loop;
  foreach t in array array['projects','project_members','milestones','timesheets','project_files','project_comments','contracts','tickets','ticket_replies','kb_articles'] loop
    execute format('create policy %1$s_staff on public.%1$I for all to authenticated using ((select private.is_staff())) with check ((select private.is_staff()))', t);
  end loop;
end $$;

-- ───────────────────────── File storage for project files ─────────────────────────
insert into storage.buckets (id, name, public, file_size_limit)
values ('project-files', 'project-files', false, 10485760)
on conflict (id) do nothing;

create policy project_files_read on storage.objects for select to authenticated
  using (bucket_id = 'project-files' and (select private.is_staff()));
create policy project_files_write on storage.objects for insert to authenticated
  with check (bucket_id = 'project-files' and (select private.is_staff()));
create policy project_files_remove on storage.objects for delete to authenticated
  using (bucket_id = 'project-files' and (select private.is_staff()));

-- ───────────────────────── Role permissions & lookups ─────────────────────────
update public.roles set permissions = permissions || '{"projects":"full","contracts":"full","support":"full","knowledge_base":"full"}' where name = 'Sales Manager';
update public.roles set permissions = permissions || '{"projects":"edit","contracts":"edit","support":"edit","knowledge_base":"view"}' where name = 'Sales Executive';
update public.roles set permissions = permissions || '{"projects":"view","contracts":"view","support":"full","knowledge_base":"full"}' where name = 'Support';

insert into public.contract_types (name) values ('Annual Maintenance (AMC)'), ('Software Licence'), ('Service Agreement'), ('NDA'), ('Statement of Work');
insert into public.ticket_departments (name) values ('Technical support'), ('Billing'), ('Onboarding'), ('Feature requests');
insert into public.kb_groups (name, description, position) values
  ('Getting started', 'First steps for new users', 1),
  ('Billing & invoices', 'Invoices, payments and GST', 2),
  ('Troubleshooting', 'Fixes for common problems', 3);
