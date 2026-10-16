-- Gnexa CRM — Projects parity with Perfex (batch 15)
--
--   • Estimated hours: the project's time budget, compared with hours logged
--   • Progress: worked out from tasks (default) or set by hand (0–100%)
--   • Portal settings per project: hide a project from the customer, and choose whether they see its tasks and
--     its timesheets (Perfex "Customer settings" on a project)
--   • Expenses can belong to a project (Expenses tab and totals on the project)
--   • Notes on projects (the Notes tab)

alter table public.projects add column if not exists estimated_hours numeric(8,2) check (estimated_hours is null or estimated_hours >= 0);
alter table public.projects add column if not exists progress_manual int check (progress_manual is null or progress_manual between 0 and 100);
alter table public.projects add column if not exists portal_visible boolean not null default true;
alter table public.projects add column if not exists portal_show_tasks boolean not null default true;
alter table public.projects add column if not exists portal_show_timesheets boolean not null default false;

alter table public.expenses add column if not exists project_id bigint references public.projects(id) on delete set null;
create index if not exists expenses_project_idx on public.expenses(project_id);

alter table public.notes drop constraint if exists notes_rel_type_check;
alter table public.notes add constraint notes_rel_type_check check (rel_type in ('customer', 'lead', 'project'));

-- ───────────────────────── Portal: follow the project's settings ─────────────────────────
drop policy if exists projects_portal on public.projects;
create policy projects_portal on public.projects for select to authenticated
  using (customer_id = (select private.portal_customer()) and portal_visible);

drop policy if exists milestones_portal on public.milestones;
create policy milestones_portal on public.milestones for select to authenticated
  using (project_id in (select id from public.projects where customer_id = (select private.portal_customer()) and portal_visible));

drop policy if exists tasks_portal on public.tasks;
create policy tasks_portal on public.tasks for select to authenticated
  using (rel_type = 'project' and rel_id in (
    select id from public.projects where customer_id = (select private.portal_customer()) and portal_visible and portal_show_tasks));

drop policy if exists timesheets_portal on public.timesheets;
create policy timesheets_portal on public.timesheets for select to authenticated
  using (project_id in (
    select id from public.projects where customer_id = (select private.portal_customer()) and portal_visible and portal_show_timesheets));
