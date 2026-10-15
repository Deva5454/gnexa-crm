-- Gnexa CRM — Phase 5: task timers, checklists, comments, files & followers; reminders, to-dos,
-- notifications, tags, staff departments and predefined ticket replies

-- ───────────────────────── Tasks: checklist, comments, files, followers, timers ─────────────────────────
create table public.task_checklist_items (
  id           bigint generated always as identity primary key,
  task_id      bigint not null references public.tasks(id) on delete cascade,
  description  text not null,
  is_done      boolean not null default false,
  done_by      uuid references public.profiles(id) on delete set null,
  done_at      timestamptz,
  position     double precision not null default extract(epoch from clock_timestamp()),
  created_by   uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now()
);
create index task_checklist_task_idx on public.task_checklist_items(task_id, position);
create index task_checklist_done_by_idx on public.task_checklist_items(done_by);
create index task_checklist_created_by_idx on public.task_checklist_items(created_by);

create table public.task_comments (
  id          bigint generated always as identity primary key,
  task_id     bigint not null references public.tasks(id) on delete cascade,
  body        text not null,
  created_by  uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now()
);
create index task_comments_task_idx on public.task_comments(task_id, created_at);
create index task_comments_created_by_idx on public.task_comments(created_by);

create table public.task_files (
  id           bigint generated always as identity primary key,
  task_id      bigint not null references public.tasks(id) on delete cascade,
  name         text not null,
  path         text not null unique,
  size         bigint not null default 0,
  mime         text,
  uploaded_by  uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now()
);
create index task_files_task_idx on public.task_files(task_id);
create index task_files_uploaded_by_idx on public.task_files(uploaded_by);

create table public.task_followers (
  task_id   bigint not null references public.tasks(id) on delete cascade,
  staff_id  uuid not null references public.profiles(id) on delete cascade,
  primary key (task_id, staff_id)
);
create index task_followers_staff_idx on public.task_followers(staff_id);

create table public.task_timers (
  id            bigint generated always as identity primary key,
  task_id       bigint not null references public.tasks(id) on delete cascade,
  staff_id      uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  started_at    timestamptz not null default now(),
  ended_at      timestamptz,
  note          text,
  timesheet_id  bigint references public.timesheets(id) on delete set null,
  check (ended_at is null or ended_at >= started_at)
);
create index task_timers_task_idx on public.task_timers(task_id, started_at desc);
create index task_timers_timesheet_idx on public.task_timers(timesheet_id);
-- One running timer per person
create unique index task_timers_one_running on public.task_timers(staff_id) where ended_at is null;

-- Start a timer on a task (stops whatever the person had running first)
create or replace function public.start_task_timer(p_task bigint) returns bigint
language plpgsql security invoker set search_path = '' as $$
declare tid bigint; running bigint;
begin
  if not private.is_staff() then raise exception 'not allowed'; end if;
  select id into running from public.task_timers where staff_id = auth.uid() and ended_at is null;
  if running is not null then perform public.stop_task_timer(running, null); end if;
  insert into public.task_timers (task_id, staff_id) values (p_task, auth.uid()) returning id into tid;
  update public.tasks set status = 'in_progress' where id = p_task and status = 'not_started';
  return tid;
end;
$$;

-- Stop a running timer. For project tasks the time is also written to the project's timesheet.
create or replace function public.stop_task_timer(p_timer bigint, p_note text) returns numeric
language plpgsql security invoker set search_path = '' as $$
declare
  t public.task_timers;
  k public.tasks;
  hrs numeric;
  ts bigint;
begin
  select * into t from public.task_timers where id = p_timer and staff_id = auth.uid() and ended_at is null for update;
  if t.id is null then raise exception 'Timer not found or already stopped'; end if;
  hrs := greatest(0.01, round((extract(epoch from (now() - t.started_at)) / 3600)::numeric, 2));
  select * into k from public.tasks where id = t.task_id;
  if k.rel_type = 'project' and k.rel_id is not null then
    insert into public.timesheets (project_id, task_id, staff_id, date, hours, note, is_billable)
    values (k.rel_id, k.id, auth.uid(), (t.started_at at time zone 'Asia/Kolkata')::date, least(hrs, 24), nullif(trim(coalesce(p_note, '')), ''), true)
    returning id into ts;
  end if;
  update public.task_timers set ended_at = now(), note = nullif(trim(coalesce(p_note, '')), ''), timesheet_id = ts where id = t.id;
  return hrs;
end;
$$;

revoke execute on function public.start_task_timer(bigint) from public, anon;
revoke execute on function public.stop_task_timer(bigint, text) from public, anon;
grant execute on function public.start_task_timer(bigint) to authenticated;
grant execute on function public.stop_task_timer(bigint, text) to authenticated;

-- ───────────────────────── Reminders, to-dos ─────────────────────────
create table public.reminders (
  id           bigint generated always as identity primary key,
  rel_type     text not null check (rel_type in ('customer','lead','project','ticket','contract','sales_doc','task','expense')),
  rel_id       bigint not null,
  staff_id     uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  remind_at    timestamptz not null,
  description  text not null,
  is_notified  boolean not null default false,
  created_by   uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now()
);
create index reminders_rel_idx on public.reminders(rel_type, rel_id);
create index reminders_due_idx on public.reminders(staff_id, is_notified, remind_at);
create index reminders_created_by_idx on public.reminders(created_by);

create table public.todos (
  id          bigint generated always as identity primary key,
  staff_id    uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  body        text not null,
  is_done     boolean not null default false,
  done_at     timestamptz,
  position    double precision not null default extract(epoch from clock_timestamp()),
  created_at  timestamptz not null default now()
);
create index todos_staff_idx on public.todos(staff_id, is_done, position);

-- ───────────────────────── Notifications ─────────────────────────
create table public.notifications (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  actor_id    uuid references public.profiles(id) on delete set null,
  title       text not null,
  body        text,
  link        text,
  is_read     boolean not null default false,
  created_at  timestamptz not null default now()
);
create index notifications_user_idx on public.notifications(user_id, is_read, created_at desc);
create index notifications_actor_idx on public.notifications(actor_id);

-- Notify one staff member. Never notifies the person doing the action; system writes (no user) and demo
-- re-seeding (gnexa.seeding = on) are silent.
create or replace function private.notify(p_user uuid, p_title text, p_link text, p_body text default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or p_user is null or p_user = auth.uid() then return; end if;
  if current_setting('gnexa.seeding', true) = 'on' then return; end if;
  if not exists (select 1 from public.profiles where id = p_user and is_active) then return; end if;
  insert into public.notifications (user_id, actor_id, title, link, body)
  values (p_user, case when private.is_staff() then auth.uid() end, p_title, p_link, p_body);
end;
$$;

-- Fallback recipients when nobody owns a record: everyone in the ticket's department, else the admins
create or replace function private.notify_team(p_department bigint, p_title text, p_link text, p_body text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare r uuid;
begin
  for r in
    select sd.staff_id from public.staff_departments sd where p_department is not null and sd.department_id = p_department
    union
    select p.id from public.profiles p where p.is_admin and p.is_active
      and not exists (select 1 from public.staff_departments sd2 where p_department is not null and sd2.department_id = p_department)
  loop
    perform private.notify(r, p_title, p_link, p_body);
  end loop;
end;
$$;

create or replace function private.actor_name() returns text
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select full_name from public.profiles where id = auth.uid()),
    (select nullif(trim(c.first_name || ' ' || coalesce(c.last_name, '')), '') from public.portal_users pu join public.contacts c on c.id = pu.contact_id where pu.user_id = auth.uid()),
    'Someone');
$$;

-- Task assigned
create or replace function private.on_task_assignee() returns trigger
language plpgsql security definer set search_path = '' as $$
declare n text;
begin
  select name into n from public.tasks where id = new.task_id;
  perform private.notify(new.staff_id, private.actor_name() || ' assigned you a task', '/tasks/' || new.task_id, n);
  return new;
end;
$$;
create trigger task_assignee_notify after insert on public.task_assignees for each row execute function private.on_task_assignee();

-- Task comment → assignees and followers
create or replace function private.on_task_comment() returns trigger
language plpgsql security definer set search_path = '' as $$
declare n text; r uuid;
begin
  select name into n from public.tasks where id = new.task_id;
  for r in select staff_id from public.task_assignees where task_id = new.task_id
           union select staff_id from public.task_followers where task_id = new.task_id loop
    perform private.notify(r, private.actor_name() || ' commented on “' || n || '”', '/tasks/' || new.task_id, left(new.body, 140));
  end loop;
  return new;
end;
$$;
create trigger task_comment_notify after insert on public.task_comments for each row execute function private.on_task_comment();

-- Task completed → followers and the creator
create or replace function private.on_task_complete() returns trigger
language plpgsql security definer set search_path = '' as $$
declare r uuid;
begin
  if new.status = 'complete' and old.status is distinct from 'complete' then
    for r in select staff_id from public.task_followers where task_id = new.id union select new.created_by where new.created_by is not null loop
      perform private.notify(r, private.actor_name() || ' completed a task', '/tasks/' || new.id, new.name);
    end loop;
  end if;
  return new;
end;
$$;
create trigger task_complete_notify after update of status on public.tasks for each row execute function private.on_task_complete();

-- Ticket assigned; new ticket from the portal
create or replace function private.on_ticket() returns trigger
language plpgsql security definer set search_path = '' as $$
declare num text := 'TKT-' || lpad(new.id::text, 5, '0');
begin
  if new.assigned_to is not null and (tg_op = 'INSERT' or new.assigned_to is distinct from old.assigned_to) then
    perform private.notify(new.assigned_to, private.actor_name() || ' assigned you ticket ' || num, '/support/' || new.id, new.subject);
  end if;
  if tg_op = 'INSERT' and new.assigned_to is null and private.portal_customer() is not null then
    perform private.notify_team(new.department_id, private.actor_name() || ' opened ticket ' || num || ' in the portal', '/support/' || new.id, new.subject);
  end if;
  return new;
end;
$$;
create trigger ticket_notify after insert or update of assigned_to on public.tickets for each row execute function private.on_ticket();

-- Customer replied in the portal
create or replace function private.on_ticket_reply() returns trigger
language plpgsql security definer set search_path = '' as $$
declare t public.tickets;
begin
  if new.author_id is null and private.portal_customer() is not null then
    select * into t from public.tickets where id = new.ticket_id;
    if t.assigned_to is not null then
      perform private.notify(t.assigned_to, private.actor_name() || ' replied on TKT-' || lpad(t.id::text, 5, '0'), '/support/' || t.id, left(new.body, 140));
    elsif exists (select 1 from public.ticket_replies where ticket_id = t.id and id <> new.id) then
      perform private.notify_team(t.department_id, private.actor_name() || ' replied on TKT-' || lpad(t.id::text, 5, '0'), '/support/' || t.id, left(new.body, 140));
    end if;
  end if;
  return new;
end;
$$;
create trigger ticket_reply_notify after insert on public.ticket_replies for each row execute function private.on_ticket_reply();

-- Client accepted/declined a quote, or signed a contract, in the portal
create or replace function private.on_doc_response() returns trigger
language plpgsql security definer set search_path = '' as $$
declare label text; slug text; r uuid;
begin
  if private.portal_customer() is null or new.status = old.status or new.status not in ('accepted','declined') then return new; end if;
  label := case new.kind when 'proposal' then 'PRO-' else 'EST-' end || lpad(new.number::text, 5, '0');
  slug := case new.kind when 'proposal' then 'proposals' else 'estimates' end;
  for r in select new.created_by where new.created_by is not null
           union select id from public.profiles where is_admin and is_active and new.created_by is null loop
    perform private.notify(r, private.actor_name() || ' ' || new.status || ' ' || label, '/sales/' || slug || '/' || new.id, new.subject);
  end loop;
  return new;
end;
$$;
create trigger sales_doc_response_notify after update of status on public.sales_docs for each row execute function private.on_doc_response();

create or replace function private.on_contract_signed() returns trigger
language plpgsql security definer set search_path = '' as $$
declare r uuid;
begin
  if private.portal_customer() is null or new.status <> 'signed' or old.status = 'signed' then return new; end if;
  for r in select new.created_by where new.created_by is not null
           union select id from public.profiles where is_admin and is_active and new.created_by is null loop
    perform private.notify(r, coalesce(new.signed_by, private.actor_name()) || ' signed a contract', '/contracts/' || new.id, new.subject);
  end loop;
  return new;
end;
$$;
create trigger contract_signed_notify after update of status on public.contracts for each row execute function private.on_contract_signed();

-- Reminders fire when the person next loads the app: due reminders become notifications
create or replace function public.flush_reminders() returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if not private.is_staff() then return 0; end if;
  with due as (
    update public.reminders set is_notified = true
    where staff_id = auth.uid() and not is_notified and remind_at <= now()
    returning id, rel_type, rel_id, description, created_by
  )
  insert into public.notifications (user_id, actor_id, title, body, link)
  select auth.uid(), nullif(d.created_by, auth.uid()), 'Reminder', d.description,
         case d.rel_type
           when 'customer' then '/customers/' || d.rel_id
           when 'lead' then '/leads/' || d.rel_id
           when 'project' then '/projects/' || d.rel_id
           when 'ticket' then '/support/' || d.rel_id
           when 'contract' then '/contracts/' || d.rel_id
           when 'task' then '/tasks/' || d.rel_id
           when 'expense' then '/expenses/' || d.rel_id
           when 'sales_doc' then (select '/sales/' || case s.kind when 'proposal' then 'proposals' when 'estimate' then 'estimates' when 'invoice' then 'invoices' else 'credit-notes' end || '/' || s.id from public.sales_docs s where s.id = d.rel_id)
         end
  from due d;
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke execute on function public.flush_reminders() from public, anon;
grant execute on function public.flush_reminders() to authenticated;

-- ───────────────────────── Tags ─────────────────────────
create table public.tags (
  id     bigint generated always as identity primary key,
  name   text not null check (length(trim(name)) between 1 and 40),
  color  text not null default '#6d55f2'
);
create unique index tags_name_key on public.tags(lower(name));

create table public.taggables (
  tag_id    bigint not null references public.tags(id) on delete cascade,
  rel_type  text not null check (rel_type in ('customer','lead','task','project','ticket')),
  rel_id    bigint not null,
  primary key (tag_id, rel_type, rel_id)
);
create index taggables_rel_idx on public.taggables(rel_type, rel_id);

-- Tags and reminders point at records loosely; tidy them up when the record goes
create or replace function private.cleanup_links() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.taggables where rel_type = tg_argv[0] and rel_id = old.id;
  delete from public.reminders where rel_type = tg_argv[0] and rel_id = old.id;
  return old;
end;
$$;
create trigger customers_cleanup after delete on public.customers for each row execute function private.cleanup_links('customer');
create trigger leads_cleanup     after delete on public.leads     for each row execute function private.cleanup_links('lead');
create trigger tasks_cleanup     after delete on public.tasks     for each row execute function private.cleanup_links('task');
create trigger projects_cleanup  after delete on public.projects  for each row execute function private.cleanup_links('project');
create trigger tickets_cleanup   after delete on public.tickets   for each row execute function private.cleanup_links('ticket');
create trigger contracts_cleanup after delete on public.contracts for each row execute function private.cleanup_links('contract');
create trigger sales_docs_cleanup after delete on public.sales_docs for each row execute function private.cleanup_links('sales_doc');
create trigger expenses_cleanup  after delete on public.expenses  for each row execute function private.cleanup_links('expense');

-- ───────────────────────── Staff departments, predefined replies ─────────────────────────
create table public.staff_departments (
  staff_id       uuid not null references public.profiles(id) on delete cascade,
  department_id  bigint not null references public.ticket_departments(id) on delete cascade,
  primary key (staff_id, department_id)
);
create index staff_departments_dept_idx on public.staff_departments(department_id);

create table public.predefined_replies (
  id          bigint generated always as identity primary key,
  title       text not null,
  body        text not null,
  created_at  timestamptz not null default now()
);

-- ───────────────────────── RLS ─────────────────────────
alter table public.task_checklist_items enable row level security;
alter table public.task_comments        enable row level security;
alter table public.task_files           enable row level security;
alter table public.task_followers       enable row level security;
alter table public.task_timers          enable row level security;
alter table public.reminders            enable row level security;
alter table public.todos                enable row level security;
alter table public.notifications        enable row level security;
alter table public.tags                 enable row level security;
alter table public.taggables            enable row level security;
alter table public.staff_departments    enable row level security;
alter table public.predefined_replies   enable row level security;

do $$
declare t text;
begin
  foreach t in array array['task_checklist_items','task_comments','task_files','task_followers','tags','taggables'] loop
    execute format('create policy %1$s_staff on public.%1$I for all to authenticated using ((select private.is_staff())) with check ((select private.is_staff()))', t);
  end loop;
  foreach t in array array['staff_departments','predefined_replies'] loop
    execute format('create policy %1$s_read on public.%1$I for select to authenticated using ((select private.is_staff()))', t);
    execute format('create policy %1$s_insert on public.%1$I for insert to authenticated with check ((select private.is_admin()))', t);
    execute format('create policy %1$s_update on public.%1$I for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()))', t);
    execute format('create policy %1$s_delete on public.%1$I for delete to authenticated using ((select private.is_admin()))', t);
  end loop;
end $$;

-- Timers: everyone sees them (for totals); you only start/stop your own
create policy task_timers_read on public.task_timers for select to authenticated using ((select private.is_staff()));
create policy task_timers_insert on public.task_timers for insert to authenticated
  with check ((select private.is_staff()) and staff_id = (select auth.uid()));
create policy task_timers_update on public.task_timers for update to authenticated
  using (staff_id = (select auth.uid())) with check (staff_id = (select auth.uid()));
create policy task_timers_delete on public.task_timers for delete to authenticated
  using (staff_id = (select auth.uid()) or (select private.is_admin()));

-- Reminders: visible on the record to the whole team; only the owner, creator or an admin changes them
create policy reminders_read on public.reminders for select to authenticated using ((select private.is_staff()));
create policy reminders_insert on public.reminders for insert to authenticated with check ((select private.is_staff()));
create policy reminders_update on public.reminders for update to authenticated
  using (staff_id = (select auth.uid()) or created_by = (select auth.uid()) or (select private.is_admin()))
  with check ((select private.is_staff()));
create policy reminders_delete on public.reminders for delete to authenticated
  using (staff_id = (select auth.uid()) or created_by = (select auth.uid()) or (select private.is_admin()));

-- To-dos and notifications are private to their owner
create policy todos_own on public.todos for all to authenticated
  using (staff_id = (select auth.uid()) and (select private.is_staff()))
  with check (staff_id = (select auth.uid()) and (select private.is_staff()));
create policy notifications_read on public.notifications for select to authenticated using (user_id = (select auth.uid()));
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy notifications_delete on public.notifications for delete to authenticated using (user_id = (select auth.uid()));

-- ───────────────────────── Task attachments bucket ─────────────────────────
insert into storage.buckets (id, name, public, file_size_limit)
values ('task-files', 'task-files', false, 10485760)
on conflict (id) do nothing;

create policy task_files_read on storage.objects for select to authenticated
  using (bucket_id = 'task-files' and (select private.is_staff()));
create policy task_files_write on storage.objects for insert to authenticated
  with check (bucket_id = 'task-files' and (select private.is_staff()));
create policy task_files_remove on storage.objects for delete to authenticated
  using (bucket_id = 'task-files' and (select private.is_staff()));

-- ───────────────────────── Lookups ─────────────────────────
insert into public.tags (name, color) values
  ('VIP', '#e11d48'), ('Renewal due', '#f59e0b'), ('Enterprise', '#6d55f2'), ('SMB', '#0d9488'),
  ('Hot', '#ea580c'), ('Follow-up', '#0ea5e9'), ('Bug', '#dc2626'), ('Billing', '#7c3aed'), ('Onsite', '#16a34a');

insert into public.predefined_replies (title, body) values
  ('Acknowledge — looking into it', E'Hi {contact},\n\nThanks for reaching out. We have received your request and an engineer is looking into it now. We will update you within 4 business hours.\n\nRegards,\n{agent}'),
  ('Need more details', E'Hi {contact},\n\nCould you share a screenshot of the error and the steps you followed just before it appeared? That will help us reproduce it quickly.\n\nRegards,\n{agent}'),
  ('Resolved — please confirm', E'Hi {contact},\n\nWe have deployed a fix for this. Could you please check on your side and confirm everything works? We will close this ticket in 48 hours if we do not hear back.\n\nRegards,\n{agent}'),
  ('Invoice copy', E'Hi {contact},\n\nYou can download a copy of every invoice from your client portal under Invoices. Let us know if you need a GST-specific format.\n\nRegards,\n{agent}');
