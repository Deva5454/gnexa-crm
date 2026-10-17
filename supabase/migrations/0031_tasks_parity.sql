-- Gnexa CRM — Tasks parity with Perfex (batch 16)
--
--   • Tasks can be linked to a ticket, a contract or a sales document (invoice, estimate, proposal, credit
--     note) as well as a customer, lead or project. Deleting the linked record unlinks its tasks.
--   • Recurring tasks: repeat every N days / weeks / months / years, optionally until a date. A daily job
--     raises the next copy (with its assignees, followers and a fresh checklist).
--   • Checklist templates: checklist items saved for reuse.
--   • "Visible to customer" per task — a project task can be hidden from the client portal.

alter table public.tasks drop constraint if exists tasks_rel_type_check;
alter table public.tasks add constraint tasks_rel_type_check
  check (rel_type in ('customer', 'lead', 'project', 'ticket', 'contract', 'sales_doc'));

-- When a linked record goes: drop its tags, reminders and custom-field values (as before); its tasks stay but are unlinked (customers, leads and projects already delete theirs)
create or replace function private.cleanup_links() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.taggables where rel_type = tg_argv[0] and rel_id = old.id;
  delete from public.reminders where rel_type = tg_argv[0] and rel_id = old.id;
  delete from public.custom_field_values v using public.custom_fields f
   where v.field_id = f.id and f.entity = tg_argv[0] and v.rel_id = old.id;
  update public.tasks set rel_type = null, rel_id = null where rel_type = tg_argv[0] and rel_id = old.id;
  return old;
end;
$$;

alter table public.tasks add column if not exists visible_to_client boolean not null default true;

drop policy if exists tasks_portal on public.tasks;
create policy tasks_portal on public.tasks for select to authenticated
  using (rel_type = 'project' and visible_to_client and rel_id in (
    select id from public.projects where customer_id = (select private.portal_customer()) and portal_visible and portal_show_tasks));

-- ───────────────────────── Recurring tasks ─────────────────────────
alter table public.tasks add column if not exists recurring_every int check (recurring_every is null or recurring_every between 1 and 36);
alter table public.tasks add column if not exists recurring_unit text not null default 'week' check (recurring_unit in ('day', 'week', 'month', 'year'));
alter table public.tasks add column if not exists recurring_until date;
alter table public.tasks add column if not exists next_recurring_date date;
alter table public.tasks add column if not exists recurring_from bigint references public.tasks(id) on delete set null;
create index if not exists tasks_next_recurring_idx on public.tasks(next_recurring_date) where recurring_every is not null;

create or replace function private.run_recurring_tasks() returns int
language plpgsql security definer set search_path = '' as $$
declare
  t public.tasks;
  d date;
  span int;
  new_id bigint;
  n int := 0;
  guard int;
begin
  for t in select * from public.tasks where recurring_every is not null and next_recurring_date <= current_date for update loop
    d := t.next_recurring_date;
    span := case when t.due_date is not null and t.start_date is not null then t.due_date - t.start_date end;
    guard := 0;
    while d <= current_date and (t.recurring_until is null or d <= t.recurring_until) and guard < 60 loop
      insert into public.tasks (name, description, priority, status, start_date, due_date, rel_type, rel_id, milestone_id, visible_to_client, recurring_from, created_by)
      values (t.name, t.description, t.priority, 'not_started', d, case when span is not null then d + span else null end,
              t.rel_type, t.rel_id, t.milestone_id, t.visible_to_client, t.id, t.created_by)
      returning id into new_id;
      insert into public.task_assignees (task_id, staff_id) select new_id, staff_id from public.task_assignees where task_id = t.id;
      insert into public.task_followers (task_id, staff_id) select new_id, staff_id from public.task_followers where task_id = t.id;
      insert into public.task_checklist_items (task_id, description, position, created_by)
        select new_id, description, position, created_by from public.task_checklist_items where task_id = t.id;
      n := n + 1;
      d := private.add_interval(d, t.recurring_every, t.recurring_unit);
      guard := guard + 1;
    end loop;
    update public.tasks
       set next_recurring_date = case when t.recurring_until is not null and d > t.recurring_until then null else d end
     where id = t.id;
  end loop;
  return n;
end;
$$;
alter function private.run_recurring_tasks() set timezone = 'Asia/Kolkata';
revoke execute on function private.run_recurring_tasks() from public, anon, authenticated;

-- Saving a recurring task raises anything already due straight away (staff only)
create or replace function public.run_recurring_tasks() returns int
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_staff() then return 0; end if;
  return private.run_recurring_tasks();
end;
$$;
revoke execute on function public.run_recurring_tasks() from public, anon;
grant execute on function public.run_recurring_tasks() to authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    -- 06:00 India time every day; the same name again replaces the job
    perform cron.schedule('gnexa-recurring-tasks', '30 0 * * *', 'select private.run_recurring_tasks()');
  else
    raise notice 'pg_cron is not available here — recurring tasks will only be raised when a task is saved.';
  end if;
end $$;

-- ───────────────────────── Checklist templates ─────────────────────────
create table if not exists public.checklist_templates (
  id           bigint generated always as identity primary key,
  description  text not null unique check (length(trim(description)) between 1 and 300),
  created_by   uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now()
);
alter table public.checklist_templates enable row level security;
drop policy if exists checklist_templates_read on public.checklist_templates;
drop policy if exists checklist_templates_insert on public.checklist_templates;
drop policy if exists checklist_templates_delete on public.checklist_templates;
create policy checklist_templates_read on public.checklist_templates for select to authenticated
  using ((select private.has_perm('tasks', 'view')));
create policy checklist_templates_insert on public.checklist_templates for insert to authenticated
  with check ((select private.has_perm('tasks', 'edit')));
create policy checklist_templates_delete on public.checklist_templates for delete to authenticated
  using ((select private.has_perm('tasks', 'full')) or created_by = (select auth.uid()));

insert into public.checklist_templates (description) values
  ('Confirm requirements with the customer'),
  ('Internal review'),
  ('Send update to the customer'),
  ('Update the project timesheet')
on conflict (description) do nothing;
