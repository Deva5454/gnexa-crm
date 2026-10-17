-- Gnexa CRM — Support parity with Perfex (batch 17)
--
--   • Services (Setup → Support → Services): what a ticket is about, alongside its department
--   • Attachments on tickets and replies, from staff and from the client portal ("ticket-files" bucket).
--     Files on internal notes stay staff-only.
--   • Merge tickets: replies and files move into one ticket; the others are closed and point at it
--   • Replies can be edited (marked "edited") and deleted by their author
--   • Auto-close: tickets left "Answered" with no customer reply for N hours close themselves (hourly job)
--   • Clients can close their own ticket from the portal

-- ───────────────────────── Services ─────────────────────────
create table if not exists public.ticket_services (
  id    bigint generated always as identity primary key,
  name  text not null unique check (length(trim(name)) between 1 and 120)
);
alter table public.ticket_services enable row level security;
drop policy if exists ticket_services_read on public.ticket_services;
drop policy if exists ticket_services_portal on public.ticket_services;
drop policy if exists ticket_services_insert on public.ticket_services;
drop policy if exists ticket_services_update on public.ticket_services;
drop policy if exists ticket_services_delete on public.ticket_services;
create policy ticket_services_read on public.ticket_services for select to authenticated using ((select private.is_staff()));
create policy ticket_services_portal on public.ticket_services for select to authenticated using ((select private.portal_customer()) is not null);
create policy ticket_services_insert on public.ticket_services for insert to authenticated with check ((select private.is_admin()));
create policy ticket_services_update on public.ticket_services for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy ticket_services_delete on public.ticket_services for delete to authenticated using ((select private.is_admin()));

insert into public.ticket_services (name) values ('CRM setup'), ('Data migration'), ('Training'), ('Integrations')
on conflict (name) do nothing;

alter table public.tickets add column if not exists service_id bigint references public.ticket_services(id) on delete set null;
create index if not exists tickets_service_idx on public.tickets(service_id);

-- Merged tickets point at the ticket that absorbed them
alter table public.tickets add column if not exists merged_into bigint references public.tickets(id) on delete set null;
create index if not exists tickets_merged_into_idx on public.tickets(merged_into);

alter table public.ticket_replies add column if not exists edited_at timestamptz;

-- A reply's author can delete it (anyone with full support access can delete any reply)
drop policy if exists ticket_replies_author_delete on public.ticket_replies;
create policy ticket_replies_author_delete on public.ticket_replies for delete to authenticated
  using (author_id = (select auth.uid()) and (select private.has_perm('support', 'edit')));

-- ───────────────────────── Attachments ─────────────────────────
create table if not exists public.ticket_files (
  id             bigint generated always as identity primary key,
  ticket_id      bigint not null references public.tickets(id) on delete cascade,
  reply_id       bigint references public.ticket_replies(id) on delete cascade,
  name           text not null,
  path           text not null unique,
  size           bigint not null default 0,
  mime           text,
  from_customer  boolean not null default false,
  uploaded_by    uuid references auth.users(id) on delete set null default auth.uid(),
  created_at     timestamptz not null default now()
);
create index if not exists ticket_files_ticket_idx on public.ticket_files(ticket_id);
create index if not exists ticket_files_reply_idx on public.ticket_files(reply_id);
create index if not exists ticket_files_uploaded_by_idx on public.ticket_files(uploaded_by);
alter table public.ticket_files enable row level security;

-- What a portal user may see: files on their own tickets, except those on internal notes
create or replace function private.portal_ticket_file(p_ticket bigint, p_reply bigint) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.tickets t where t.id = p_ticket and t.customer_id = private.portal_customer())
     and (p_reply is null or exists (select 1 from public.ticket_replies r where r.id = p_reply and r.ticket_id = p_ticket and not r.is_internal));
$$;
revoke execute on function private.portal_ticket_file(bigint, bigint) from public, anon;
grant execute on function private.portal_ticket_file(bigint, bigint) to authenticated;

drop policy if exists ticket_files_staff_read on public.ticket_files;
drop policy if exists ticket_files_staff_insert on public.ticket_files;
drop policy if exists ticket_files_staff_delete on public.ticket_files;
drop policy if exists ticket_files_portal_read on public.ticket_files;
drop policy if exists ticket_files_portal_insert on public.ticket_files;
create policy ticket_files_staff_read on public.ticket_files for select to authenticated
  using ((select private.has_perm('support', 'view')));
create policy ticket_files_staff_insert on public.ticket_files for insert to authenticated
  with check ((select private.has_perm('support', 'edit')) and uploaded_by = (select auth.uid()) and not from_customer);
create policy ticket_files_staff_delete on public.ticket_files for delete to authenticated
  using ((select private.has_perm('support', 'full')) or (uploaded_by = (select auth.uid()) and (select private.has_perm('support', 'edit'))));
create policy ticket_files_portal_read on public.ticket_files for select to authenticated
  using ((select private.portal_customer()) is not null and private.portal_ticket_file(ticket_id, reply_id));
create policy ticket_files_portal_insert on public.ticket_files for insert to authenticated
  with check (from_customer and uploaded_by = (select auth.uid()) and (select private.portal_customer()) is not null
              and private.portal_ticket_file(ticket_id, reply_id)
              and exists (select 1 from public.tickets t where t.id = ticket_id and t.status <> 'closed'));

insert into storage.buckets (id, name, public, file_size_limit)
values ('ticket-files', 'ticket-files', false, 10485760)
on conflict (id) do nothing;

-- Paths are "<ticket id>/<random>-<file name>"
drop policy if exists ticket_files_obj_read on storage.objects;
drop policy if exists ticket_files_obj_write on storage.objects;
drop policy if exists ticket_files_obj_remove on storage.objects;
create policy ticket_files_obj_read on storage.objects for select to authenticated
  using (bucket_id = 'ticket-files' and (
    (select private.has_perm('support', 'view'))
    or exists (select 1 from public.ticket_files f where f.path = objects.name and private.portal_ticket_file(f.ticket_id, f.reply_id))));
create policy ticket_files_obj_write on storage.objects for insert to authenticated
  with check (bucket_id = 'ticket-files' and (
    (select private.has_perm('support', 'edit'))
    or (storage.foldername(name))[1] in (select t.id::text from public.tickets t where t.customer_id = (select private.portal_customer()) and t.status <> 'closed')));
create policy ticket_files_obj_remove on storage.objects for delete to authenticated
  using (bucket_id = 'ticket-files' and ((select private.has_perm('support', 'full')) or (owner_id = (select auth.uid())::text)));

-- ───────────────────────── Merge ─────────────────────────
create or replace function public.merge_tickets(p_target bigint, p_sources bigint[]) returns int
language plpgsql security definer set search_path = '' as $$
declare
  t public.tickets;
  src bigint[];
  n int;
begin
  if not private.has_perm('support', 'edit') then raise exception 'You need edit access to Support to merge tickets'; end if;
  select * into t from public.tickets where id = p_target for update;
  if t.id is null then raise exception 'Ticket not found'; end if;
  select array_agg(distinct s) into src from unnest(p_sources) s where s <> p_target;
  if src is null then raise exception 'Pick at least one other ticket to merge'; end if;
  if exists (select 1 from public.tickets where id = any(src) and customer_id is distinct from t.customer_id) then
    raise exception 'Only tickets from the same customer can be merged';
  end if;
  perform 1 from public.tickets where id = any(src) for update;
  get diagnostics n = row_count;
  if n <> cardinality(src) then raise exception 'Ticket not found'; end if;

  update public.ticket_replies set ticket_id = p_target where ticket_id = any(src);
  update public.ticket_files set ticket_id = p_target where ticket_id = any(src);
  insert into public.ticket_replies (ticket_id, body, author_id, is_internal)
  select p_target, 'Merged ' || string_agg('TKT-' || lpad(id::text, 5, '0') || ' “' || subject || '”', ', ' order by id) || ' into this ticket.', auth.uid(), true
    from public.tickets where id = any(src);
  update public.tickets set status = 'closed', closed_at = now(), merged_into = p_target where id = any(src);
  update public.tickets
     set last_reply_at = greatest(last_reply_at, coalesce((select max(created_at) from public.ticket_replies where ticket_id = p_target and not is_internal), last_reply_at))
   where id = p_target;
  return cardinality(src);
end;
$$;
revoke execute on function public.merge_tickets(bigint, bigint[]) from public, anon;
grant execute on function public.merge_tickets(bigint, bigint[]) to authenticated;

-- ───────────────────────── Auto-close ─────────────────────────
alter table public.company_settings add column if not exists ticket_autoclose_hours int
  check (ticket_autoclose_hours is null or ticket_autoclose_hours between 1 and 8760);

create or replace function private.autoclose_tickets() returns int
language plpgsql security definer set search_path = '' as $$
declare
  hrs int := (select ticket_autoclose_hours from public.company_settings limit 1);
  n int;
begin
  if hrs is null then return 0; end if;
  with gone as (
    update public.tickets set status = 'closed', closed_at = now()
     where status = 'answered' and last_reply_at < now() - make_interval(hours => hrs)
    returning id
  )
  insert into public.ticket_replies (ticket_id, body, author_name, is_internal)
  select id, 'Closed automatically — no reply from the customer for ' || hrs || ' hours.', 'Gnexa', true from gone;
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke execute on function private.autoclose_tickets() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('gnexa-ticket-autoclose', '20 * * * *', 'select private.autoclose_tickets()');
  else
    raise notice 'pg_cron is not available here — tickets will not close automatically.';
  end if;
end $$;

-- ───────────────────────── Portal: close your own ticket ─────────────────────────
create or replace function public.portal_close_ticket(p_ticket bigint) returns void
language plpgsql security definer set search_path = '' as $$
declare
  pu public.portal_users;
  who text;
begin
  select * into pu from public.portal_users where user_id = auth.uid();
  if pu.user_id is null or not exists (select 1 from public.tickets where id = p_ticket and customer_id = pu.customer_id) then
    raise exception 'Not found';
  end if;
  select coalesce(nullif(trim(first_name || ' ' || coalesce(last_name, '')), ''), 'Customer') into who from public.contacts where id = pu.contact_id;
  update public.tickets set status = 'closed', closed_at = now() where id = p_ticket and status <> 'closed';
  if found then
    insert into public.ticket_replies (ticket_id, body, author_name, is_internal)
    values (p_ticket, coalesce(who, 'Customer') || ' closed this ticket in the portal.', 'Gnexa', true);
  end if;
end;
$$;
revoke execute on function public.portal_close_ticket(bigint) from public, anon;
grant execute on function public.portal_close_ticket(bigint) to authenticated;
