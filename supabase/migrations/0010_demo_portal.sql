-- Gnexa CRM — demo client-portal accounts and Phase 4 demo data

-- Two client logins (used by the role switcher's "Client portal" personas)
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  phone_change, phone_change_token, email_change_token_current, reauthentication_token
)
select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
       extensions.crypt('GnexaDemo#2026', extensions.gen_salt('bf')), now(),
       '{"provider":"email","providers":["email"]}'::jsonb,
       jsonb_build_object('full_name', u.full_name, 'portal', 'true'),
       now() - interval '30 days', now(), '', '', '', '', '', '', '', ''
from (values
  ('b0000000-0000-4000-8000-000000000001'::uuid, 'client.tata@demo.gnexa.app',   'Rajesh Khanna'),
  ('b0000000-0000-4000-8000-000000000002'::uuid, 'client.orchid@demo.gnexa.app', 'Sunil Fernandes')
) as u(id, email, full_name)
on conflict (id) do nothing;

insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select u.id::text, u.id, jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true), 'email', now(), now(), now()
from auth.users u
where u.email in ('client.tata@demo.gnexa.app', 'client.orchid@demo.gnexa.app')
  and not exists (select 1 from auth.identities i where i.user_id = u.id and i.provider = 'email');

-- (Re)link the demo client logins to their customer + primary contact. Called after every reset,
-- because re-seeding creates new customer ids.
create or replace function private.link_demo_portal() returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.portal_users where user_id in ('b0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002');
  insert into public.portal_users (user_id, customer_id, contact_id)
  select x.uid, c.id, (select id from public.contacts where customer_id = c.id and is_primary limit 1)
  from (values
    ('b0000000-0000-4000-8000-000000000001'::uuid, 'Tata Advanced Materials'),
    ('b0000000-0000-4000-8000-000000000002'::uuid, 'Orchid Hotels & Resorts')
  ) as x(uid, company)
  join public.customers c on c.company = x.company
  where exists (select 1 from auth.users u where u.id = x.uid);
end;
$$;

create or replace function private.seed_demo_extras() returns void
language plpgsql security definer set search_path = '' as $$
declare
  admin uuid := 'a0000000-0000-4000-8000-000000000001';
  mgr   uuid := 'a0000000-0000-4000-8000-000000000002';
  exec  uuid := 'a0000000-0000-4000-8000-000000000003';
  sup   uuid := 'a0000000-0000-4000-8000-000000000004';
  ms date := date_trunc('month', current_date)::date;
  me date := (date_trunc('month', current_date) + interval '1 month - 1 day')::date;
begin
  insert into public.calendar_events (title, description, starts_at, ends_at, all_day, color, created_by) values
    ('Weekly sales review',            'Pipeline walk-through with the sales team', current_date + time '10:00', current_date + time '11:00', false, '#6d55f2', mgr),
    ('Demo — Chopra Hospitality',      'Guest-relations CRM demo for Nikhil and CFO', current_date + 2 + time '15:00', current_date + 2 + time '16:00', false, '#0d9488', mgr),
    ('Tata plant 3 training',          'On-site, Jamshedpur', current_date + 5 + time '09:30', current_date + 5 + time '17:30', false, '#f59e0b', sup),
    ('Quarter-end close',              'Finance close for Q3', (me)::timestamptz, null, true, '#e11d48', admin),
    ('Team offsite — Coorg',           null, current_date + 12 + time '09:00', current_date + 13 + time '18:00', false, '#0ea5e9', admin),
    ('Call: Saffron store rollout',    'Kick-off logistics with Vivek', current_date - 2 + time '12:00', current_date - 2 + time '12:30', false, '#6d55f2', exec);

  insert into public.announcements (title, body, show_to_staff, show_to_clients, created_by, created_at) values
    ('Welcome to Gnexa 🎉', E'We have moved our customer work into Gnexa. Leads, invoices, projects and support now live in one place.\n\nQuestions? Ask in #gnexa-help.', true, false, admin, now() - interval '20 days'),
    ('New: client portal', E'Customers can now see invoices, sign contracts and raise tickets themselves. Use "View as client" on a customer to see what they see.', true, false, admin, now() - interval '2 days'),
    ('Diwali holiday support hours', E'Our office is closed on the Diwali holidays. Urgent tickets are still monitored — please mark them Urgent and we will respond within 4 hours.', true, true, admin, now() - interval '1 day');

  insert into public.goals (title, metric, target, start_date, end_date, staff_id, created_by) values
    ('Invoice ₹25 lakh this quarter', 'invoiced', 2500000, date_trunc('quarter', current_date)::date, (date_trunc('quarter', current_date) + interval '3 months - 1 day')::date, null, admin),
    ('Collect ₹10 lakh this month',   'collected', 1000000, ms, me, null, admin),
    ('Convert 4 leads this quarter',  'leads_converted', 4, date_trunc('quarter', current_date)::date, (date_trunc('quarter', current_date) + interval '3 months - 1 day')::date, mgr, admin),
    ('Close 10 tickets this month',   'tickets_closed', 10, ms, me, sup, admin),
    ('Win 3 new customers',           'new_customers', 3, ms - 60, me, null, admin);
end;
$$;

-- Reset now also restores the calendar, announcements, goals and re-links the client logins
create or replace function public.reset_demo_data() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'Only administrators can reset demo data'; end if;
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
end;
$$;

revoke execute on function private.link_demo_portal() from public, anon, authenticated;
revoke execute on function private.seed_demo_extras() from public, anon, authenticated;
revoke execute on function public.reset_demo_data() from public, anon;
grant execute on function public.reset_demo_data() to authenticated;

do $$ begin
  if not exists (select 1 from public.goals) then perform private.seed_demo_extras(); end if;
end $$;
select private.link_demo_portal();
