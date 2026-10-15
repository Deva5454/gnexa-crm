-- Gnexa CRM — Phase 7 demo data. Forms and surveys are set up once (their public links stay stable);
-- the data hanging off them is re-created by "Reset demo".

create or replace function private.seed_demo_platform_config() returns void
language plpgsql security definer set search_path = '' as $$
declare
  mgr uuid := 'a0000000-0000-4000-8000-000000000002';
  sup uuid := 'a0000000-0000-4000-8000-000000000004';
  sv bigint;
begin
  insert into public.custom_fields (entity, label, type, options, required, show_on_pdf, position) values
    ('customer',  'Industry',               'select',   '{Manufacturing,Hospitality,Retail,Technology,Healthcare,Agriculture,Real estate,Logistics}', false, false, 1),
    ('customer',  'Account tier',           'select',   '{Gold,Silver,Bronze}', false, false, 2),
    ('customer',  'Renewal month',          'text',     '{}', false, false, 3),
    ('lead',      'Expected decision date', 'date',     '{}', false, false, 1),
    ('lead',      'Number of users',        'number',   '{}', false, false, 2),
    ('project',   'Client PO number',       'text',     '{}', false, false, 1),
    ('ticket',    'Affected module',        'select',   '{Login,Invoices,Reports,Mobile app,Integrations,Other}', false, false, 1),
    ('sales_doc', 'Customer PO reference',  'text',     '{}', false, true, 1),
    ('contract',  'Signed hard copy received', 'checkbox', '{}', false, false, 1);

  insert into public.web_forms (key, name, kind, intro, fields, required, source_id, status_id, assigned_to, success_message, created_by)
  values
    ('6f1d2c3b-0000-4000-8000-0000000000a1', 'Website contact form', 'lead', 'Tell us a little about your business and we''ll call you back within one working day.',
     '{name,email,phone,company,message}', '{name,email}', (select id from public.lead_sources where name = 'Website'),
     (select id from public.lead_statuses order by sort_order limit 1), mgr,
     'Thanks — your message is with our sales team. Expect a call within one working day.', mgr),
    ('6f1d2c3b-0000-4000-8000-0000000000a2', 'Request a quote', 'estimate_request', 'Share what you need and we''ll send a detailed estimate.',
     '{name,email,phone,company,budget,message}', '{name,email,message}', (select id from public.lead_sources where name = 'Website'),
     null, mgr, 'Thank you! We''ll prepare an estimate and get back to you within 2 working days.', mgr);

  insert into public.surveys (key, title, description, thank_you, created_by)
  values ('6f1d2c3b-0000-4000-8000-0000000000b1', 'Customer satisfaction — Q3',
          'Two minutes of your time helps us serve you better.', 'Thank you for your feedback — it goes straight to our leadership team.', sup)
  returning id into sv;
  insert into public.survey_questions (survey_id, label, type, options, required, position) values
    (sv, 'How satisfied are you with Gnexa overall?', 'rating', '{}', true, 1),
    (sv, 'How likely are you to recommend us to a colleague?', 'single', '{Very likely,Likely,Not sure,Unlikely}', true, 2),
    (sv, 'Which modules does your team use most?', 'multiple', '{Leads,Invoices,Projects,Support,Reports}', false, 3),
    (sv, 'How quickly does our support team resolve your issues?', 'rating', '{}', false, 4),
    (sv, 'Anything we could do better?', 'long', '{}', false, 5);

  insert into public.surveys (key, title, description, created_by, is_active)
  values ('6f1d2c3b-0000-4000-8000-0000000000b2', 'Onsite training feedback', 'For attendees of our onsite training sessions.', sup, true)
  returning id into sv;
  insert into public.survey_questions (survey_id, label, type, options, required, position) values
    (sv, 'Your plant / location', 'short', '{}', false, 1),
    (sv, 'How useful was the session?', 'rating', '{}', true, 2),
    (sv, 'Was the pace right?', 'single', '{Too slow,Just right,Too fast}', true, 3);
end;
$$;

create or replace function private.seed_demo_platform() returns void
language plpgsql security definer set search_path = '' as $$
declare
  admin uuid := 'a0000000-0000-4000-8000-000000000001';
  mgr   uuid := 'a0000000-0000-4000-8000-000000000002';
  exec  uuid := 'a0000000-0000-4000-8000-000000000003';
  sup   uuid := 'a0000000-0000-4000-8000-000000000004';
  f_ind bigint := (select id from public.custom_fields where label = 'Industry');
  f_tier bigint := (select id from public.custom_fields where label = 'Account tier');
  f_ren bigint := (select id from public.custom_fields where label = 'Renewal month');
  sv bigint := (select id from public.surveys where title = 'Customer satisfaction — Q3');
  p bigint; rid bigint; i int;
  names text[] := '{Rajesh Khanna,Sunil Fernandes,Kavya Reddy,Deepa Raman,Arjun Bhatia,Meera Kapoor,Vivek Agarwal,Neha Joshi,Imran Qureshi,Lata Deshmukh}';
begin
  -- Custom field values
  insert into public.custom_field_values (field_id, rel_id, value)
  select f_ind, c.id, x.ind from (values
    ('Tata Advanced Materials', 'Manufacturing'), ('Orchid Hotels & Resorts', 'Hospitality'), ('Saffron Retail Chain', 'Retail'),
    ('Nimbus Software Labs', 'Technology'), ('Zenith Pharma Pvt Ltd', 'Healthcare'), ('Greenfield Agro', 'Agriculture'),
    ('Bluewave Logistics', 'Logistics'), ('Coastal Foods Exports', 'Manufacturing'), ('UrbanNest Interiors', 'Real estate')
  ) as x(company, ind) join public.customers c on c.company = x.company where f_ind is not null;
  insert into public.custom_field_values (field_id, rel_id, value)
  select f_tier, c.id, x.tier from (values ('Tata Advanced Materials', 'Gold'), ('Orchid Hotels & Resorts', 'Gold'), ('Nimbus Software Labs', 'Silver'),
    ('Saffron Retail Chain', 'Silver'), ('Greenfield Agro', 'Bronze')) as x(company, tier)
  join public.customers c on c.company = x.company where f_tier is not null;
  insert into public.custom_field_values (field_id, rel_id, value)
  select f_ren, c.id, 'March' from public.customers c where c.company in ('Tata Advanced Materials', 'Coastal Foods Exports') and f_ren is not null;
  insert into public.custom_field_values (field_id, rel_id, value)
  select (select id from public.custom_fields where label = 'Customer PO reference'), d.id, 'PO/TAM/2026/' || lpad(d.number::text, 4, '0')
  from public.sales_docs d join public.customers c on c.id = d.customer_id
  where c.company = 'Tata Advanced Materials' and d.kind = 'invoice';
  insert into public.custom_field_values (field_id, rel_id, value)
  select (select id from public.custom_fields where label = 'Client PO number'), id, 'TAM-PO-88231' from public.projects where name = 'Tata CRM rollout';
  insert into public.custom_field_values (field_id, rel_id, value)
  select (select id from public.custom_fields where label = 'Affected module'), t.id, x.m
  from (values ('Login fails on Android app', 'Mobile app'), ('Invoice raised twice for September', 'Invoices'), ('Customer sync skipping records with emojis', 'Integrations')) as x(subject, m)
  join public.tickets t on t.subject = x.subject;
  insert into public.custom_field_values (field_id, rel_id, value)
  select (select id from public.custom_fields where label = 'Number of users'), l.id, x.n
  from (values ('Chopra Hospitality', '60'), ('Skyline Realty', '25'), ('Shah Fintech', '140')) as x(company, n)
  join public.leads l on l.company = x.company;

  -- Estimate requests from the website
  insert into public.estimate_requests (form_id, name, email, phone, company, message, budget, status, assigned_to, created_at)
  values
    ((select id from public.web_forms where name = 'Request a quote'), 'Anil Menon', 'anil@menonlogistics.example.in', '+91 98450 22113', 'Menon Logistics',
     'We run 3 warehouses and need a CRM for our B2B sales team (12 people) with GST invoicing. Please quote for implementation + annual licences.', '₹3–5 lakh', 'new', mgr, now() - interval '5 hours'),
    ((select id from public.web_forms where name = 'Request a quote'), 'Farah Siddiqui', 'farah@brightsmiles.example.in', '+91 99020 77810', 'BrightSmiles Dental',
     'Clinic chain with 8 branches. Looking for appointment follow-ups and patient invoicing.', '₹1–2 lakh', 'in_review', exec, now() - interval '2 days'),
    ((select id from public.web_forms where name = 'Request a quote'), 'Karan Malhotra', 'karan@fitzone.example.in', null, 'FitZone Gyms',
     'Membership renewals and corporate tie-ups. 20 users.', null, 'quoted', mgr, now() - interval '9 days');
  update public.web_forms set submissions = 3 where name = 'Request a quote';
  update public.web_forms set submissions = 6 where name = 'Website contact form';

  -- Newsfeed
  insert into public.posts (body, pinned, created_by, created_at) values
    (E'🎉 Tata plant 1 training went live today — 22 people trained, great feedback. Thanks Sneha & Priya!', true, admin, now() - interval '1 day')
  returning id into p;
  insert into public.post_likes (post_id, staff_id) values (p, mgr), (p, exec), (p, sup);
  insert into public.post_comments (post_id, body, created_by, created_at) values
    (p, 'Plant 2 moves to Thursday — will share photos after.', sup, now() - interval '20 hours'),
    (p, 'Brilliant work team 👏', exec, now() - interval '18 hours');
  insert into public.posts (body, created_by, created_at) values
    (E'Reminder: please log your time against tasks by Friday 5 pm — invoices for Nimbus go out on Monday.', mgr, now() - interval '3 hours')
  returning id into p;
  insert into public.post_likes (post_id, staff_id) values (p, admin);
  insert into public.posts (body, created_by, created_at) values
    (E'Closed Saffron Retail for the 40-store rollout 🚀 Kick-off is next week.', exec, now() - interval '3 days')
  returning id into p;
  insert into public.post_likes (post_id, staff_id) values (p, admin), (p, mgr);
  insert into public.post_comments (post_id, body, created_by, created_at) values (p, 'Huge — well done Rohan!', mgr, now() - interval '3 days' + interval '1 hour');
  insert into public.posts (body, created_by, created_at) values
    (E'New KB article: "Fixing Android login after a phone clock change". Please share it with customers who hit the session-expired error.', sup, now() - interval '6 hours');

  -- Survey responses (customer satisfaction)
  for i in 1..10 loop
    insert into public.survey_responses (survey_id, name, email, created_at)
    values (sv, names[i], lower(replace(names[i], ' ', '.')) || '@example.in', now() - make_interval(days => i * 2))
    returning id into rid;
    insert into public.survey_answers (response_id, question_id, value)
    select rid, q.id, case q.position
        when 1 then (array['5','4','5','3','4','5','4','2','5','4'])[i]
        when 2 then (array['Very likely','Likely','Very likely','Not sure','Likely','Very likely','Likely','Unlikely','Very likely','Likely'])[i]
        when 4 then (array['4','4','5','3','4','5','3','2','5','4'])[i]
        when 5 then (array['Faster mobile app please','','Love the client portal','Reports could export to Excel','','','WhatsApp reminders would help','Onboarding took longer than planned','',''])[i]
      end
    from public.survey_questions q where q.survey_id = sv and q.position in (1, 2, 4, 5)
      and not (q.position = 5 and (array['Faster mobile app please','','Love the client portal','Reports could export to Excel','','','WhatsApp reminders would help','Onboarding took longer than planned','',''])[i] = '');
    insert into public.survey_answers (response_id, question_id, value)
    select rid, q.id, m from public.survey_questions q,
      unnest(case i % 3 when 0 then '{Leads,Invoices}'::text[] when 1 then '{Invoices,Support,Reports}'::text[] else '{Projects,Support}'::text[] end) m
    where q.survey_id = sv and q.position = 3;
  end loop;

  -- GDPR: some consents, one open erasure request
  update public.contacts set marketing_consent = true, consent_updated_at = now() - interval '30 days'
  where customer_id in (select id from public.customers where company in ('Tata Advanced Materials', 'Nimbus Software Labs', 'Saffron Retail Chain')) and is_primary;
  insert into public.gdpr_requests (customer_id, contact_id, kind, note, created_at)
  select c.customer_id, c.id, 'erasure', 'I have left the company — please remove my personal details.', now() - interval '2 days'
  from public.contacts c join public.customers cu on cu.id = c.customer_id
  where cu.company = 'Zenith Pharma Pvt Ltd' order by c.is_primary, c.id limit 1;
end;
$$;

-- Reset now also clears and re-seeds the Phase 7 data (forms, surveys and custom field definitions stay)
create or replace function public.reset_demo_data() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'Only administrators can reset demo data'; end if;
  perform set_config('gnexa.seeding', 'on', true);  -- no notifications while re-seeding
  delete from public.gdpr_requests where true;
  delete from public.survey_responses where true;
  delete from public.posts where true;
  delete from public.estimate_requests where true;
  delete from public.custom_field_values where true;
  delete from public.email_log where true;
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
  delete from public.credit_applications where true;
  delete from public.payments where true;
  delete from public.expenses where true;
  delete from public.sales_doc_items where true;
  delete from public.sales_docs where true;
  delete from public.subscriptions where true;
  delete from public.projects where true;
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
  perform private.seed_demo_billing();
  perform private.seed_demo_platform();
  perform set_config('gnexa.seeding', 'off', true);
end;
$$;

revoke execute on function private.seed_demo_platform_config() from public, anon, authenticated;
revoke execute on function private.seed_demo_platform() from public, anon, authenticated;
revoke execute on function public.reset_demo_data() from public, anon;
grant execute on function public.reset_demo_data() to authenticated;

do $$ begin
  if not exists (select 1 from public.custom_fields) then perform private.seed_demo_platform_config(); end if;
  if not exists (select 1 from public.posts) then perform private.seed_demo_platform(); end if;
end $$;
