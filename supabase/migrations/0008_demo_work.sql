-- Gnexa CRM — demo data for projects, contracts, support tickets and the knowledge base

create or replace function private.seed_demo_work() returns void
language plpgsql security definer set search_path = '' as $$
declare
  admin uuid := 'a0000000-0000-4000-8000-000000000001';
  mgr   uuid := 'a0000000-0000-4000-8000-000000000002';
  exec  uuid := 'a0000000-0000-4000-8000-000000000003';
  sup   uuid := 'a0000000-0000-4000-8000-000000000004';
  p_tata bigint; p_nimbus bigint; p_orchid bigint; p_saffron bigint; p_everest bigint;
  m bigint; m2 bigint; m3 bigint; t bigint; tk bigint;
  cust bigint;
begin
  -- ── Projects ──
  insert into public.projects (name, customer_id, status, billing_type, fixed_price, start_date, deadline, description, created_by, created_at)
  values ('Tata CRM rollout', (select id from public.customers where company = 'Tata Advanced Materials'), 'in_progress', 'fixed', 200000,
          current_date - 45, current_date + 20, 'Company-wide CRM rollout across 3 plants: setup, migration, training and go-live.', mgr, now() - interval '45 days')
  returning id into p_tata;
  insert into public.projects (name, customer_id, status, billing_type, hourly_rate, start_date, deadline, description, created_by, created_at)
  values ('Nimbus ERP connector', (select id from public.customers where company = 'Nimbus Software Labs'), 'in_progress', 'hourly', 2500,
          current_date - 30, current_date + 14, 'Two-way sync between Gnexa and the Nimbus ERP: customers, invoices and payments.', mgr, now() - interval '30 days')
  returning id into p_nimbus;
  insert into public.projects (name, customer_id, status, billing_type, hourly_rate, start_date, deadline, description, created_by, created_at)
  values ('Orchid front-office training', (select id from public.customers where company = 'Orchid Hotels & Resorts'), 'finished', 'hourly', 2000,
          current_date - 60, current_date - 20, 'Hands-on training for front-office and sales teams at 4 properties.', exec, now() - interval '60 days')
  returning id into p_orchid;
  insert into public.projects (name, customer_id, status, billing_type, fixed_price, start_date, deadline, description, created_by, created_at)
  values ('Saffron store rollout', (select id from public.customers where company = 'Saffron Retail Chain'), 'not_started', 'fixed', 450000,
          current_date + 7, current_date + 60, 'Rollout to 40 stores with barcode scanners and store-level dashboards.', mgr, now() - interval '3 days')
  returning id into p_saffron;
  insert into public.projects (name, customer_id, status, billing_type, fixed_price, start_date, deadline, description, created_by, created_at)
  values ('Everest site app', (select id from public.customers where company = 'Everest Builders'), 'on_hold', 'fixed', 120000,
          current_date - 25, current_date + 30, 'Mobile checklist for site supervisors. On hold pending customer sign-off on scope.', exec, now() - interval '25 days')
  returning id into p_everest;

  insert into public.project_members (project_id, staff_id) values
    (p_tata, mgr), (p_tata, exec), (p_tata, sup),
    (p_nimbus, mgr), (p_nimbus, exec),
    (p_orchid, exec), (p_orchid, sup),
    (p_saffron, mgr), (p_saffron, exec),
    (p_everest, exec);

  -- Tata: milestones + tasks
  insert into public.milestones (project_id, name, due_date, position, is_complete) values (p_tata, 'Setup & configuration', current_date - 25, 1, true) returning id into m;
  insert into public.milestones (project_id, name, due_date, position, is_complete) values (p_tata, 'Data migration', current_date - 5, 2, true) returning id into m2;
  insert into public.milestones (project_id, name, due_date, position, is_complete) values (p_tata, 'Training & go-live', current_date + 20, 3, false) returning id into m3;
  insert into public.tasks (name, rel_type, rel_id, milestone_id, status, priority, start_date, due_date, created_by)
  values
    ('Configure pipeline stages & roles', 'project', p_tata, m,  'complete',    'high',   current_date - 44, current_date - 35, mgr),
    ('Set up GST & invoice templates',    'project', p_tata, m,  'complete',    'medium', current_date - 40, current_date - 28, exec),
    ('Import 4,200 customer records',     'project', p_tata, m2, 'complete',    'high',   current_date - 24, current_date - 12, exec),
    ('Reconcile opening balances',        'project', p_tata, m2, 'complete',    'medium', current_date - 15, current_date - 6,  mgr),
    ('Train plant sales teams (3 days)',  'project', p_tata, m3, 'in_progress', 'high',   current_date - 3,  current_date + 6,  sup),
    ('Go-live checklist & hypercare',     'project', p_tata, m3, 'not_started', 'urgent', current_date + 7,  current_date + 20, mgr);

  -- Nimbus: milestones + tasks
  insert into public.milestones (project_id, name, due_date, position, is_complete) values (p_nimbus, 'API mapping', current_date - 15, 1, true) returning id into m;
  insert into public.milestones (project_id, name, due_date, position, is_complete) values (p_nimbus, 'Build & test sync', current_date + 14, 2, false) returning id into m2;
  insert into public.tasks (name, rel_type, rel_id, milestone_id, status, priority, start_date, due_date, created_by)
  values
    ('Map customer & invoice fields',   'project', p_nimbus, m,  'complete',          'high',   current_date - 30, current_date - 18, exec),
    ('Build customer sync job',         'project', p_nimbus, m2, 'testing',           'high',   current_date - 16, current_date + 2,  exec),
    ('Build invoice & payment sync',    'project', p_nimbus, m2, 'in_progress',       'high',   current_date - 8,  current_date + 9,  exec),
    ('UAT with Nimbus finance team',    'project', p_nimbus, m2, 'awaiting_feedback', 'medium', current_date - 2,  current_date + 12, mgr);

  -- Orchid & Saffron & Everest: a few tasks
  insert into public.tasks (name, rel_type, rel_id, status, priority, start_date, due_date, created_by)
  values
    ('Front-office training — Goa',       'project', p_orchid,  'complete',    'medium', current_date - 50, current_date - 45, exec),
    ('Sales team training — Udaipur',     'project', p_orchid,  'complete',    'medium', current_date - 35, current_date - 30, exec),
    ('Kick-off meeting with Saffron',     'project', p_saffron, 'not_started', 'high',   current_date + 7,  current_date + 8,  mgr),
    ('Ship scanners to pilot stores',     'project', p_saffron, 'not_started', 'medium', current_date + 10, current_date + 18, exec),
    ('Scope sign-off from Everest',       'project', p_everest, 'awaiting_feedback', 'high', current_date - 10, current_date - 1, exec);

  -- Assign every project task to someone on the team
  insert into public.task_assignees (task_id, staff_id)
  select tk2.id, coalesce(tk2.created_by, mgr) from public.tasks tk2 where tk2.rel_type = 'project';

  -- Timesheets (Nimbus is hourly: these become invoiceable; Orchid hours were already billed)
  insert into public.timesheets (project_id, task_id, staff_id, date, hours, note, is_billable)
  select p_nimbus, (select id from public.tasks where rel_type = 'project' and rel_id = p_nimbus and name = x.task), x.who, current_date - x.ago, x.hrs, x.note, true
  from (values
    ('Map customer & invoice fields', exec, 28, 6.0, 'Field mapping workshop'),
    ('Map customer & invoice fields', mgr,  26, 2.5, 'Review with Nimbus IT'),
    ('Build customer sync job',       exec, 14, 7.5, 'Sync job + retries'),
    ('Build customer sync job',       exec, 12, 6.0, 'Conflict handling'),
    ('Build customer sync job',       exec,  9, 4.0, 'Test fixtures'),
    ('Build invoice & payment sync',  exec,  6, 8.0, 'Invoice push'),
    ('Build invoice & payment sync',  exec,  3, 5.5, 'Payment webhooks'),
    ('UAT with Nimbus finance team',  mgr,   1, 2.0, 'UAT session 1')
  ) as x(task, who, ago, hrs, note);
  insert into public.timesheets (project_id, task_id, staff_id, date, hours, note, is_billable)
  select p_tata, (select id from public.tasks where rel_type = 'project' and rel_id = p_tata and name = x.task), x.who, current_date - x.ago, x.hrs, x.note, false
  from (values
    ('Import 4,200 customer records', exec, 20, 7.0, 'Cleanup + import'),
    ('Train plant sales teams (3 days)', sup, 2, 8.0, 'Day 1 — Jamshedpur plant')
  ) as x(task, who, ago, hrs, note);
  insert into public.timesheets (project_id, staff_id, date, hours, note, is_billable, invoice_id)
  values
    (p_orchid, exec, current_date - 50, 8.0, 'Training — Goa', true, null),
    (p_orchid, sup,  current_date - 35, 8.0, 'Training — Udaipur', true, null);

  insert into public.project_comments (project_id, body, created_by, created_at) values
    (p_tata,   'Plant 2 wants the training moved to Thursday — updated the task dates.', sup, now() - interval '20 hours'),
    (p_tata,   'Opening balances reconciled with their finance team. Signed off by Rajesh.', mgr, now() - interval '5 days'),
    (p_nimbus, 'Their ERP rate-limits at 60 req/min; batching invoices in groups of 50.', exec, now() - interval '2 days'),
    (p_everest,'Waiting on revised scope from Lata before we restart.', exec, now() - interval '9 days');

  -- ── Contracts ──
  insert into public.contracts (customer_id, type_id, subject, value, start_date, end_date, content, status, signed_by, signed_at, created_by, created_at)
  select (select id from public.customers where company = x.company), (select id from public.contract_types where name = x.ctype),
         x.subject, x.value, current_date + x.start_off, current_date + x.end_off,
         c.content, x.status, x.signer, case when x.status = 'signed' then now() + make_interval(days => x.start_off - 2) end, x.who,
         now() + make_interval(days => x.start_off - 5)
  from (values
    ('Tata Advanced Materials', 'Annual Maintenance (AMC)', 'AMC — FY 2026-27',               85000,  -200, 165, 'signed', 'Rajesh Khanna', mgr),
    ('Zenith Pharma Pvt Ltd',   'Annual Maintenance (AMC)', 'AMC — FY 2026-27',               85000,  -340,  20, 'signed', 'Pooja Shah',    mgr),
    ('Orchid Hotels & Resorts', 'Software Licence',         'Licence agreement — 25 users',  360000, -20,  345, 'signed', 'Sunil Fernandes', exec),
    ('Nimbus Software Labs',    'Statement of Work',        'SOW — ERP connector',           150000, -30,   45, 'signed', 'Kavya Reddy',   mgr),
    ('Coastal Foods Exports',   'Service Agreement',        'Support agreement 2025-26',      60000, -400, -35, 'signed', 'Manoj Pillai',  exec),
    ('Saffron Retail Chain',    'Statement of Work',        'SOW — store rollout (40 stores)', 450000, 7,   120, 'sent',   null,           mgr),
    ('UrbanNest Interiors',     'NDA',                      'Mutual NDA',                    null,     0,   365, 'draft',  null,           exec)
  ) as x(company, ctype, subject, value, start_off, end_off, status, signer, who),
  lateral (select E'1. Scope\nThe provider will deliver the services described in the attached schedule.\n\n2. Term\nThis agreement runs from the start date to the end date unless renewed in writing.\n\n3. Fees\nFees are payable within 15 days of invoice. GST is charged as applicable.\n\n4. Confidentiality\nEach party keeps the other''s confidential information private.\n\n5. Termination\nEither party may terminate with 30 days'' written notice.' as content) c;

  -- ── Support tickets ──
  insert into public.tickets (subject, customer_id, contact_id, department_id, project_id, priority, status, assigned_to, last_reply_at, closed_at, created_by, created_at)
  select x.subject, c.id, (select id from public.contacts where customer_id = c.id and is_primary limit 1),
         (select id from public.ticket_departments where name = x.dept),
         (select id from public.projects where name = x.project),
         x.priority, x.status, x.assignee, now() - make_interval(hours => x.last_h),
         case when x.status = 'closed' then now() - make_interval(hours => x.last_h) end,
         sup, now() - make_interval(hours => x.age_h)
  from (values
    ('Login fails on Android app',                 'Bluewave Logistics',      'Technical support', null,                    'high',   'open',        sup,  3,   5),
    ('Invoice raised twice for September',         'Orchid Hotels & Resorts', 'Billing',           null,                    'medium', 'closed',      sup,  200, 260),
    ('Customer sync skipping records with emojis', 'Nimbus Software Labs',    'Technical support', 'Nimbus ERP connector',  'urgent', 'in_progress', exec, 6,   30),
    ('How do I add a new GST rate?',               'Greenfield Agro',         'Billing',           null,                    'low',    'answered',    sup,  20,  28),
    ('Training slides for plant 3',                'Tata Advanced Materials', 'Onboarding',        'Tata CRM rollout',      'medium', 'open',        sup,  10,  10),
    ('Request: WhatsApp notifications',            'Saffron Retail Chain',    'Feature requests',  null,                    'low',    'on_hold',     mgr,  96,  150),
    ('Payment not reflecting on invoice',          'Zenith Pharma Pvt Ltd',   'Billing',           null,                    'high',   'open',        null, 1,   1),
    ('Export customers to Excel',                  'Sunrise Diagnostics',     'Technical support', null,                    'low',    'closed',      sup,  300, 330)
  ) as x(subject, company, dept, project, priority, status, assignee, last_h, age_h)
  join public.customers c on c.company = x.company;

  insert into public.ticket_replies (ticket_id, body, author_id, author_name, is_internal, created_at)
  select tt.id, x.body, x.author, x.author_name, x.internal, now() - make_interval(hours => x.h)
  from (values
    ('Login fails on Android app', 'Since this morning our drivers can''t log in on Android. iOS works fine. Error says "session expired".', null::uuid, 'Deepa Raman', false, 5),
    ('Login fails on Android app', 'Reproduced on Android 14 with the latest app build. Looks like a clock-skew issue on token refresh.', sup, null, true, 4),
    ('Login fails on Android app', 'Thanks Deepa — we can reproduce it and a fix is in progress. As a workaround, please ask drivers to enable automatic date & time.', sup, null, false, 3),
    ('Invoice raised twice for September', 'We were billed twice for September licences. Please check.', null, 'Sunil Fernandes', false, 260),
    ('Invoice raised twice for September', 'Sorry about that, Sunil. We''ve issued credit note CN-00001 for ₹23,600 and applied it to INV-00003.', sup, null, false, 200),
    ('Customer sync skipping records with emojis', 'Around 40 customers with emojis in their names are not syncing to ERP.', null, 'Kavya Reddy', false, 30),
    ('Customer sync skipping records with emojis', 'ERP API rejects 4-byte UTF-8. Plan: transliterate on our side before push.', exec, null, true, 20),
    ('Customer sync skipping records with emojis', 'Fix deployed to staging — could your team re-run the sync and confirm?', exec, null, false, 6),
    ('How do I add a new GST rate?', 'We need to bill 5% GST for some items. How do we add that?', null, 'Neha Joshi', false, 28),
    ('How do I add a new GST rate?', 'Go to Setup → Finance → Tax rates and add it there. Here''s a guide: "Adding GST rates" in our knowledge base.', sup, null, false, 20),
    ('Training slides for plant 3', 'Can you share the slides used in the plant 1 & 2 sessions?', null, 'Anil Menon', false, 10),
    ('Request: WhatsApp notifications', 'Would love invoice reminders over WhatsApp.', null, 'Vivek Agarwal', false, 150),
    ('Request: WhatsApp notifications', 'Logged as a feature request — on the roadmap for Phase 4. Putting this on hold until then.', mgr, null, false, 96),
    ('Payment not reflecting on invoice', 'We paid INV-00002 by NEFT yesterday (UTR HDFC26101400). It still shows overdue.', null, 'Pooja Shah', false, 1),
    ('Export customers to Excel', 'Is there a way to export our customer list?', null, 'Imran Qureshi', false, 330),
    ('Export customers to Excel', 'Not yet in the app — we sent you a CSV export by email. Excel export is coming with reports.', sup, null, false, 300)
  ) as x(subject, body, author, author_name, internal, h)
  join public.tickets tt on tt.subject = x.subject;

  -- ── Knowledge base ──
  insert into public.kb_articles (group_id, title, slug, body, views, helpful, not_helpful, created_by, created_at, updated_at)
  select (select id from public.kb_groups where name = x.grp), x.title, x.slug, x.body, x.views, x.yes, x.no, sup,
         now() - make_interval(days => x.age), now() - make_interval(days => x.age / 2)
  from (values
    ('Getting started', 'Your first 10 minutes in Gnexa', 'first-10-minutes',
     E'Welcome! Here''s the fastest way to get value from Gnexa:\n\n1. Add your company details under Setup → General. They appear on every invoice.\n2. Import or add your customers.\n3. Create leads for open opportunities and drag them across the board as they progress.\n4. Turn won leads into customers with one click.\n5. Create your first invoice from Sales → Invoices.', 412, 38, 2, 40),
    ('Getting started', 'Understanding roles and permissions', 'roles-and-permissions',
     E'Every team member has a role. Roles decide what they can view, create, edit or delete in each module.\n\n• Administrator — everything, including Setup.\n• Sales Manager — full access to sales, projects and support.\n• Sales Executive — create and edit, but no deletes.\n• Support — tickets and knowledge base; read-only elsewhere.\n\nOpen My profile to see exactly what your role allows.', 188, 21, 1, 35),
    ('Getting started', 'Converting a lead into a customer', 'convert-lead',
     E'Open the lead and click "Convert to customer". Gnexa will:\n\n• create the customer with the lead''s company details,\n• add the lead as the primary contact,\n• move all notes and tasks across, and\n• mark the lead as won.', 260, 30, 0, 33),
    ('Billing & invoices', 'Adding GST rates', 'adding-gst-rates',
     E'Go to Setup → Finance → Tax rates. Enter a name (for example "GST 5%") and the rate, then click Add.\n\nThe new rate is immediately available on line items and expenses. Invoices show GST split into CGST and SGST.', 145, 17, 1, 28),
    ('Billing & invoices', 'Recording a part payment', 'part-payments',
     E'Open the invoice and click "Record payment". Enter the amount received, the payment mode and the UTR or cheque number.\n\nThe invoice switches to "Partially paid" and the balance due updates everywhere — including the PDF.', 201, 24, 3, 25),
    ('Billing & invoices', 'Applying a credit note', 'credit-notes',
     E'Create a credit note for the customer and mark it as sent. Then, on the credit note, choose one of the customer''s open invoices and the amount to apply.\n\nThe invoice balance drops by that amount and the credit note closes once fully used.', 97, 11, 0, 20),
    ('Troubleshooting', 'Android app says "session expired"', 'android-session-expired',
     E'This happens when the phone''s clock is out of sync.\n\nFix: Settings → System → Date & time → turn on "Set time automatically", then sign in again.', 64, 9, 2, 4),
    ('Troubleshooting', 'Some customers don''t sync to ERP', 'erp-sync-skips',
     E'Customers with emojis or unusual symbols in their name can be rejected by some ERPs.\n\nGnexa now replaces these characters before syncing. Re-run the sync from Setup → Integrations once the fix is live.', 22, 3, 0, 2)
  ) as x(grp, title, slug, body, views, yes, no, age);

  insert into public.activity_log (rel_type, rel_id, description, actor_id, created_at)
  values
    ('project', p_tata,   'completed milestone "Data migration" on Tata CRM rollout', mgr, now() - interval '4 days'),
    ('project', p_nimbus, 'logged 5.5 h on Nimbus ERP connector', exec, now() - interval '3 days'),
    (null, null, 'replied to ticket "Login fails on Android app"', sup, now() - interval '3 hours');
end;
$$;

-- Reset restores CRM, finance and Phase 3 demo data
create or replace function public.reset_demo_data() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'Only administrators can reset demo data'; end if;
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
end;
$$;

revoke execute on function private.seed_demo_work() from public, anon, authenticated;
revoke execute on function public.reset_demo_data() from public, anon;
grant execute on function public.reset_demo_data() to authenticated;

do $$ begin
  if not exists (select 1 from public.projects) then perform private.seed_demo_work(); end if;
end $$;
