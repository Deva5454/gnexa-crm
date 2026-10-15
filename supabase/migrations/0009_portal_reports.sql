-- Gnexa CRM — Phase 4: client portal, calendar, announcements, goals, reports permissions

-- ───────────────────────── Client portal accounts ─────────────────────────
-- A portal user is an auth account linked to one customer (and the contact they are).
create table public.portal_users (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  customer_id  bigint not null references public.customers(id) on delete cascade,
  contact_id   bigint references public.contacts(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index portal_users_customer_idx on public.portal_users(customer_id);
create index portal_users_contact_idx on public.portal_users(contact_id);

-- Portal accounts are not staff: don't give them a staff profile
create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare first_user boolean;
begin
  if coalesce(new.raw_user_meta_data->>'portal', '') = 'true' then
    return new;
  end if;
  select not exists (select 1 from public.profiles) into first_user;
  insert into public.profiles (id, email, full_name, is_admin, is_active)
  values (new.id, new.email,
          coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
          first_user, first_user);
  return new;
end;
$$;

-- The signed-in client's customer id (null for staff and everyone else)
create or replace function private.portal_customer() returns bigint
language sql stable security definer set search_path = '' as $$
  select customer_id from public.portal_users where user_id = auth.uid();
$$;
revoke execute on function private.portal_customer() from public, anon;
grant execute on function private.portal_customer() to authenticated;

alter table public.portal_users enable row level security;
create policy portal_users_read on public.portal_users for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_staff()));

-- ── Read access for clients: only their own customer's records, never drafts or internal notes ──
create policy customers_portal on public.customers for select to authenticated
  using (id = (select private.portal_customer()));
create policy contacts_portal on public.contacts for select to authenticated
  using (customer_id = (select private.portal_customer()));
create policy company_settings_portal on public.company_settings for select to authenticated
  using ((select private.portal_customer()) is not null);
create policy payment_modes_portal on public.payment_modes for select to authenticated
  using ((select private.portal_customer()) is not null);

create policy sales_docs_portal on public.sales_docs for select to authenticated
  using (customer_id = (select private.portal_customer()) and status <> 'draft');
create policy sales_doc_items_portal on public.sales_doc_items for select to authenticated
  using (doc_id in (select id from public.sales_docs where customer_id = (select private.portal_customer()) and status <> 'draft'));
create policy payments_portal on public.payments for select to authenticated
  using (invoice_id in (select id from public.sales_docs where customer_id = (select private.portal_customer()) and status <> 'draft'));
create policy credit_applications_portal on public.credit_applications for select to authenticated
  using (invoice_id in (select id from public.sales_docs where customer_id = (select private.portal_customer()) and status <> 'draft'));

create policy contracts_portal on public.contracts for select to authenticated
  using (customer_id = (select private.portal_customer()) and status <> 'draft');
create policy contract_types_portal on public.contract_types for select to authenticated
  using ((select private.portal_customer()) is not null);

create policy projects_portal on public.projects for select to authenticated
  using (customer_id = (select private.portal_customer()));
create policy milestones_portal on public.milestones for select to authenticated
  using (project_id in (select id from public.projects where customer_id = (select private.portal_customer())));
create policy tasks_portal on public.tasks for select to authenticated
  using (rel_type = 'project' and rel_id in (select id from public.projects where customer_id = (select private.portal_customer())));

create policy tickets_portal on public.tickets for select to authenticated
  using (customer_id = (select private.portal_customer()));
create policy ticket_replies_portal on public.ticket_replies for select to authenticated
  using (not is_internal and ticket_id in (select id from public.tickets where customer_id = (select private.portal_customer())));
create policy ticket_departments_portal on public.ticket_departments for select to authenticated
  using ((select private.portal_customer()) is not null);

create policy kb_articles_portal on public.kb_articles for select to authenticated
  using (is_published and (select private.portal_customer()) is not null);
create policy kb_groups_portal on public.kb_groups for select to authenticated
  using ((select private.portal_customer()) is not null);

-- ── Client actions go through functions that check ownership ──
create or replace function public.portal_respond(p_doc bigint, p_accept boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare d public.sales_docs;
begin
  select * into d from public.sales_docs where id = p_doc for update;
  if d.id is null or d.customer_id is distinct from private.portal_customer() then raise exception 'Not found'; end if;
  if d.kind not in ('estimate','proposal') then raise exception 'Only estimates and proposals can be accepted or declined'; end if;
  if d.status <> 'sent' then raise exception 'This document is no longer awaiting a response'; end if;
  update public.sales_docs set status = case when p_accept then 'accepted' else 'declined' end where id = p_doc;
  insert into public.activity_log (rel_type, rel_id, description, actor_id)
  values ('customer', d.customer_id,
          'client ' || case when p_accept then 'accepted ' else 'declined ' end || d.kind::text || ' #' || d.number || ' in the portal', null);
end;
$$;

create or replace function public.portal_sign_contract(p_contract bigint, p_name text) returns void
language plpgsql security definer set search_path = '' as $$
declare c public.contracts;
begin
  select * into c from public.contracts where id = p_contract for update;
  if c.id is null or c.customer_id is distinct from private.portal_customer() then raise exception 'Not found'; end if;
  if c.status <> 'sent' then raise exception 'This contract is not awaiting signature'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'Type your full name to sign'; end if;
  update public.contracts set status = 'signed', signed_by = trim(p_name), signed_at = now() where id = p_contract;
  insert into public.activity_log (rel_type, rel_id, description, actor_id)
  values ('customer', c.customer_id, trim(p_name) || ' signed contract “' || c.subject || '” in the portal', null);
end;
$$;

create or replace function public.portal_open_ticket(p_subject text, p_body text, p_department bigint, p_priority text) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  pu public.portal_users;
  who text;
  tid bigint;
begin
  select * into pu from public.portal_users where user_id = auth.uid();
  if pu.user_id is null then raise exception 'Not a portal user'; end if;
  if coalesce(trim(p_subject), '') = '' or coalesce(trim(p_body), '') = '' then raise exception 'Subject and message are required'; end if;
  select coalesce(nullif(trim(first_name || ' ' || coalesce(last_name, '')), ''), 'Customer') into who from public.contacts where id = pu.contact_id;
  insert into public.tickets (subject, customer_id, contact_id, department_id, priority, status, created_by)
  values (trim(p_subject), pu.customer_id, pu.contact_id, p_department,
          case when p_priority in ('low','medium','high','urgent') then p_priority else 'medium' end, 'open', null)
  returning id into tid;
  insert into public.ticket_replies (ticket_id, body, author_id, author_name) values (tid, trim(p_body), null, coalesce(who, 'Customer'));
  insert into public.activity_log (rel_type, rel_id, description, actor_id)
  values ('customer', pu.customer_id, coalesce(who, 'Client') || ' opened a ticket in the portal: “' || trim(p_subject) || '”', null);
  return tid;
end;
$$;

create or replace function public.portal_reply(p_ticket bigint, p_body text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  pu public.portal_users;
  who text;
begin
  select * into pu from public.portal_users where user_id = auth.uid();
  if pu.user_id is null or not exists (select 1 from public.tickets where id = p_ticket and customer_id = pu.customer_id) then
    raise exception 'Not found';
  end if;
  if coalesce(trim(p_body), '') = '' then raise exception 'Write a message first'; end if;
  select coalesce(nullif(trim(first_name || ' ' || coalesce(last_name, '')), ''), 'Customer') into who from public.contacts where id = pu.contact_id;
  insert into public.ticket_replies (ticket_id, body, author_id, author_name) values (p_ticket, trim(p_body), null, coalesce(who, 'Customer'));
  update public.tickets set status = 'open', last_reply_at = now(), closed_at = null where id = p_ticket;
end;
$$;

revoke execute on function public.portal_respond(bigint, boolean) from public, anon;
revoke execute on function public.portal_sign_contract(bigint, text) from public, anon;
revoke execute on function public.portal_open_ticket(text, text, bigint, text) from public, anon;
revoke execute on function public.portal_reply(bigint, text) from public, anon;
grant execute on function public.portal_respond(bigint, boolean) to authenticated;
grant execute on function public.portal_sign_contract(bigint, text) to authenticated;
grant execute on function public.portal_open_ticket(text, text, bigint, text) to authenticated;
grant execute on function public.portal_reply(bigint, text) to authenticated;

-- Staff "kb_track" works for clients too (view counts / votes from the help center)
create or replace function public.kb_track(p_article bigint, p_event text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_staff() and private.portal_customer() is null then raise exception 'not allowed'; end if;
  update public.kb_articles set
    views       = views       + (p_event = 'view')::int,
    helpful     = helpful     + (p_event = 'yes')::int,
    not_helpful = not_helpful + (p_event = 'no')::int
  where id = p_article and is_published;
end;
$$;

-- ───────────────────────── Calendar, announcements, goals ─────────────────────────
create table public.calendar_events (
  id           bigint generated always as identity primary key,
  title        text not null,
  description  text,
  starts_at    timestamptz not null,
  ends_at      timestamptz,
  all_day      boolean not null default false,
  color        text not null default '#6d55f2',
  created_by   uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now(),
  check (ends_at is null or ends_at >= starts_at)
);
create index calendar_events_start_idx on public.calendar_events(starts_at);
create index calendar_events_created_by_idx on public.calendar_events(created_by);

create table public.announcements (
  id               bigint generated always as identity primary key,
  title            text not null,
  body             text not null,
  show_to_staff    boolean not null default true,
  show_to_clients  boolean not null default false,
  created_by       uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at       timestamptz not null default now()
);
create index announcements_created_idx on public.announcements(created_at desc);
create index announcements_created_by_idx on public.announcements(created_by);

create table public.goals (
  id          bigint generated always as identity primary key,
  title       text not null,
  metric      text not null check (metric in ('invoiced','collected','leads_converted','new_customers','tickets_closed')),
  target      numeric(14,2) not null check (target > 0),
  start_date  date not null,
  end_date    date not null,
  staff_id    uuid references public.profiles(id) on delete cascade,
  created_by  uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now(),
  check (end_date >= start_date)
);
create index goals_staff_idx on public.goals(staff_id);
create index goals_created_by_idx on public.goals(created_by);

alter table public.calendar_events enable row level security;
alter table public.announcements   enable row level security;
alter table public.goals           enable row level security;

create policy calendar_events_staff on public.calendar_events for all to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));
create policy goals_staff on public.goals for all to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));
create policy announcements_read on public.announcements for select to authenticated
  using ((select private.is_staff()) or (show_to_clients and (select private.portal_customer()) is not null));
create policy announcements_insert on public.announcements for insert to authenticated with check ((select private.is_admin()));
create policy announcements_update on public.announcements for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy announcements_delete on public.announcements for delete to authenticated using ((select private.is_admin()));

-- Reports & goals permission
update public.roles set permissions = permissions || '{"reports":"full"}' where name = 'Sales Manager';
update public.roles set permissions = permissions || '{"reports":"view"}' where name in ('Sales Executive', 'Support');
