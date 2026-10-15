-- Gnexa CRM — Phase 5 demo data: tags, checklists, comments, timers, reminders, to-dos, notifications

create or replace function private.seed_demo_collab() returns void
language plpgsql security definer set search_path = '' as $$
declare
  admin uuid := 'a0000000-0000-4000-8000-000000000001';
  mgr   uuid := 'a0000000-0000-4000-8000-000000000002';
  exec  uuid := 'a0000000-0000-4000-8000-000000000003';
  sup   uuid := 'a0000000-0000-4000-8000-000000000004';
  t_train bigint; t_golive bigint; t_invsync bigint; t_custsync bigint; t_deck bigint; t_demo bigint; t_login bigint; t_amc bigint;
begin
  select id into t_train    from public.tasks where name = 'Train plant sales teams (3 days)';
  select id into t_golive   from public.tasks where name = 'Go-live checklist & hypercare';
  select id into t_invsync  from public.tasks where name = 'Build invoice & payment sync';
  select id into t_custsync from public.tasks where name = 'Build customer sync job';
  select id into t_deck     from public.tasks where name = 'Prepare onboarding deck for Nimbus';
  select id into t_demo     from public.tasks where name = 'Product demo for Skyline Realty';
  select id into t_login    from public.tasks where name = 'Fix login issue on customer portal';
  select id into t_amc      from public.tasks where name = 'Review AMC contract draft';

  -- Support departments
  insert into public.staff_departments (staff_id, department_id)
  select x.staff, d.id from (values
    (sup, 'Technical support'), (sup, 'Billing'), (mgr, 'Onboarding'), (exec, 'Feature requests'), (admin, 'Billing')
  ) as x(staff, dept) join public.ticket_departments d on d.name = x.dept
  on conflict do nothing;

  -- Tags
  insert into public.taggables (tag_id, rel_type, rel_id)
  select g.id, x.rel_type, x.rel_id from (values
    ('VIP',         'customer', (select id from public.customers where company = 'Tata Advanced Materials')),
    ('Enterprise',  'customer', (select id from public.customers where company = 'Tata Advanced Materials')),
    ('Renewal due', 'customer', (select id from public.customers where company = 'Coastal Foods Exports')),
    ('SMB',         'customer', (select id from public.customers where company = 'Greenfield Agro')),
    ('VIP',         'customer', (select id from public.customers where company = 'Orchid Hotels & Resorts')),
    ('Enterprise',  'customer', (select id from public.customers where company = 'Nimbus Software Labs')),
    ('Hot',         'lead',     (select id from public.leads where company = 'Chopra Hospitality' limit 1)),
    ('Hot',         'lead',     (select id from public.leads where company = 'Skyline Realty' limit 1)),
    ('Follow-up',   'lead',     (select id from public.leads where company = 'Bansal Steel' limit 1)),
    ('Enterprise',  'lead',     (select id from public.leads where company = 'Shah Fintech' limit 1)),
    ('Onsite',      'task',     t_train),
    ('Follow-up',   'task',     t_deck),
    ('Bug',         'task',     t_login),
    ('Hot',         'task',     t_demo),
    ('Enterprise',  'project',  (select id from public.projects where name = 'Tata CRM rollout')),
    ('Onsite',      'project',  (select id from public.projects where name = 'Tata CRM rollout')),
    ('Billing',     'project',  (select id from public.projects where name = 'Nimbus ERP connector')),
    ('Bug',         'ticket',   (select id from public.tickets where subject = 'Login fails on Android app')),
    ('Bug',         'ticket',   (select id from public.tickets where subject = 'Customer sync skipping records with emojis')),
    ('Billing',     'ticket',   (select id from public.tickets where subject = 'Invoice raised twice for September')),
    ('Billing',     'ticket',   (select id from public.tickets where subject = 'Payment not reflecting on invoice'))
  ) as x(tag, rel_type, rel_id)
  join public.tags g on g.name = x.tag
  where x.rel_id is not null
  on conflict do nothing;

  -- Checklists
  insert into public.task_checklist_items (task_id, description, is_done, done_by, done_at, position, created_by)
  select x.task, x.descr, x.done, case when x.done then x.who end, case when x.done then now() - make_interval(days => x.pos) end, x.pos, x.who
  from (values
    (t_train,  'Book training room at plant 1',       true,  sup, 1),
    (t_train,  'Plant 1 — sales team (day 1)',        true,  sup, 2),
    (t_train,  'Plant 2 — sales team (day 2)',        false, sup, 3),
    (t_train,  'Plant 3 — sales team (day 3)',        false, sup, 4),
    (t_train,  'Share recordings & quick-start PDF',  false, sup, 5),
    (t_golive, 'Freeze old system for new entries',   false, mgr, 1),
    (t_golive, 'Final data delta import',             false, mgr, 2),
    (t_golive, 'Switch DNS for portal',               false, mgr, 3),
    (t_golive, 'Hypercare roster for week 1',         false, mgr, 4),
    (t_invsync,'Map invoice line items',              true,  exec, 1),
    (t_invsync,'Handle partial payments',             true,  exec, 2),
    (t_invsync,'Credit notes sync',                   false, exec, 3),
    (t_invsync,'Retry queue for failed syncs',        false, exec, 4),
    (t_demo,   'Load sample property listings',       true,  exec, 1),
    (t_demo,   'Prepare pricing for 25 users',        false, exec, 2)
  ) as x(task, descr, done, who, pos)
  where x.task is not null;

  -- Followers
  insert into public.task_followers (task_id, staff_id)
  select x.task, x.staff from (values (t_train, mgr), (t_invsync, mgr), (t_login, admin), (t_demo, mgr), (t_golive, admin)) as x(task, staff)
  where x.task is not null on conflict do nothing;

  -- Comments
  insert into public.task_comments (task_id, body, created_by, created_at)
  select x.task, x.body, x.who, now() - make_interval(hours => x.h)
  from (values
    (t_train,  'Plant 1 went well — 22 people attended. Plant 2 has asked to move to Thursday.', sup, 30),
    (t_train,  'Thursday is fine. Please share attendance sheet after each session.', mgr, 26),
    (t_invsync,'Partial payments are syncing now. Credit notes need a new endpoint on their side.', exec, 20),
    (t_invsync,'I''ll raise it with their CTO on tomorrow''s call.', mgr, 18),
    (t_login,  'Root cause is clock skew on older Android devices. Fix is in testing.', sup, 6),
    (t_demo,   'Their CFO will join — keep the finance part tight.', mgr, 10)
  ) as x(task, body, who, h)
  where x.task is not null;

  -- Timer history (non-project tasks; project time already sits in timesheets) + one running timer
  insert into public.task_timers (task_id, staff_id, started_at, ended_at, note)
  select x.task, x.who, now() - make_interval(days => x.d, mins => x.mins), now() - make_interval(days => x.d), x.note
  from (values
    (t_deck,  mgr, 2, 95, 'Draft slides'),
    (t_deck,  sup, 1, 40, 'Support section'),
    (t_login, sup, 1, 130, 'Reproduce on Android 14'),
    (t_login, sup, 0, 55, 'Verify fix'),
    (t_amc,   admin, 3, 45, 'Clause review')
  ) as x(task, who, d, mins, note)
  where x.task is not null;
  insert into public.task_timers (task_id, staff_id, started_at)
  select t_demo, exec, now() - interval '25 minutes' where t_demo is not null;
  update public.tasks set status = 'in_progress' where id = t_demo;

  -- Reminders (some already due, so the bell lights up on first visit)
  insert into public.reminders (rel_type, rel_id, staff_id, remind_at, description, created_by)
  select x.rel_type, x.rel_id, x.staff, now() + x.at, x.descr, x.staff
  from (values
    ('customer', (select id from public.customers where company = 'Coastal Foods Exports'), exec, interval '-2 hours', 'Call Coastal Foods about AMC renewal'),
    ('lead',     (select id from public.leads where company = 'Chopra Hospitality' limit 1), mgr, interval '-30 minutes', 'Confirm demo slot with Nikhil'),
    ('sales_doc',(select id from public.sales_docs where kind = 'invoice' order by due_date limit 1), admin, interval '-1 hour', 'Chase overdue payment'),
    ('ticket',   (select id from public.tickets where subject = 'Payment not reflecting on invoice'), sup, interval '-15 minutes', 'Check bank statement for Zenith UTR'),
    ('project',  (select id from public.projects where name = 'Tata CRM rollout'), mgr, interval '2 days', 'Go/no-go call with Tata IT'),
    ('contract', (select id from public.contracts order by end_date limit 1), admin, interval '3 days', 'Start renewal conversation'),
    ('lead',     (select id from public.leads where company = 'Shah Fintech' limit 1), exec, interval '1 day', 'Send revised payment terms'),
    ('customer', (select id from public.customers where company = 'Tata Advanced Materials'), admin, interval '5 days', 'Quarterly review with Rajesh')
  ) as x(rel_type, rel_id, staff, at, descr)
  where x.rel_id is not null;

  -- To-dos
  insert into public.todos (staff_id, body, is_done, done_at, position)
  select x.staff, x.body, x.done, case when x.done then now() - interval '1 day' end, x.pos
  from (values
    (admin, 'Approve October expense claims', false, 1), (admin, 'Review Q3 goals with Priya', false, 2), (admin, 'Renew domain gnexa.app', true, 3),
    (mgr, 'Prep pipeline review deck', false, 1), (mgr, 'Book flights for Jamshedpur', false, 2), (mgr, 'Send Nimbus SOW redlines', true, 3),
    (exec, 'Update Skyline demo data', false, 1), (exec, 'Log yesterday''s calls', false, 2), (exec, 'Expense: client lunch receipts', true, 3),
    (sup, 'Write KB article: Android login fix', false, 1), (sup, 'Close stale tickets older than 30 days', false, 2), (sup, 'Plant 2 attendance sheet', true, 3)
  ) as x(staff, body, done, pos);

  -- A few notifications so every persona has something in the bell
  insert into public.notifications (user_id, actor_id, title, body, link, is_read, created_at)
  select x.u, x.a, x.title, x.body, x.link, x.r, now() - make_interval(hours => x.h)
  from (values
    (exec, mgr, 'Priya Nair assigned you a task', 'Build invoice & payment sync', '/tasks/' || t_invsync, false, 3),
    (exec, mgr, 'Priya Nair commented on “Product demo for Skyline Realty”', 'Their CFO will join — keep the finance part tight.', '/tasks/' || t_demo, false, 10),
    (mgr, sup, 'Sneha Iyer commented on “Train plant sales teams (3 days)”', 'Plant 1 went well — 22 people attended.', '/tasks/' || t_train, false, 30),
    (mgr, exec, 'Rohan Kulkarni commented on “Build invoice & payment sync”', 'Partial payments are syncing now.', '/tasks/' || t_invsync, true, 20),
    (sup, admin, 'Aarav Mehta assigned you ticket TKT-' || lpad((select id from public.tickets where subject = 'Login fails on Android app')::text, 5, '0'), 'Login fails on Android app', '/support/' || (select id from public.tickets where subject = 'Login fails on Android app'), false, 5),
    (admin, sup, 'Sneha Iyer completed a task', 'Collect KYC documents', '/tasks/' || (select id from public.tasks where name = 'Collect KYC documents'), true, 48),
    (admin, null, 'Rajesh Khanna signed a contract', 'Annual maintenance — plant 1 & 2', '/contracts', false, 26)
  ) as x(u, a, title, body, link, r, h)
  where x.link is not null;
end;
$$;

-- Reset now also clears and re-seeds the Phase 5 data
create or replace function public.reset_demo_data() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'Only administrators can reset demo data'; end if;
  perform set_config('gnexa.seeding', 'on', true);  -- no notifications while re-seeding
  delete from public.notifications where true;
  delete from public.todos where true;
  delete from public.reminders where true;
  delete from public.taggables where true;
  delete from public.staff_departments where true;
  delete from public.task_timers where true;
  delete from public.task_comments where true;
  delete from public.task_checklist_items where true;
  delete from public.task_followers where true;
  delete from public.task_files where true;
  delete from public.goals where true;
  delete from public.announcements where true;
  delete from public.calendar_events where true;
  delete from public.ticket_replies where true;
  delete from public.tickets where true;
  delete from public.kb_articles where true;
  delete from public.contracts where true;
  delete from public.timesheets where true;
  delete from public.project_comments where true;
  delete from public.project_files where true;
  delete from public.task_assignees where true;
  delete from public.tasks where true;
  delete from public.milestones where true;
  delete from public.project_members where true;
  delete from public.projects where true;
  delete from public.credit_applications where true;
  delete from public.payments where true;
  delete from public.expenses where true;
  delete from public.sales_doc_items where true;
  delete from public.sales_docs where true;
  delete from public.items where true;
  delete from public.notes where true;
  delete from public.activity_log where true;
  delete from public.contacts where true;
  delete from public.leads where true;
  delete from public.customers where true;
  perform private.seed_demo_data();
  perform private.seed_demo_finance();
  perform private.seed_demo_work();
  perform private.seed_demo_extras();
  perform private.link_demo_portal();
  perform private.seed_demo_collab();
  perform set_config('gnexa.seeding', 'off', true);
end;
$$;

revoke execute on function private.seed_demo_collab() from public, anon, authenticated;
revoke execute on function public.reset_demo_data() from public, anon;
grant execute on function public.reset_demo_data() to authenticated;

do $$ begin
  if not exists (select 1 from public.todos) then perform private.seed_demo_collab(); end if;
end $$;
