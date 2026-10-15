-- Gnexa CRM — demo mode: one account per role (used by the in-app role switcher) and a reseedable demo dataset

-- Let the access-flag guard skip checks when there is no signed-in user (SQL editor / migrations / service role).
-- Anonymous API callers have no UPDATE policy on profiles, so this opens nothing to the public.
create or replace function private.guard_profile_update() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and not private.is_admin() then
    if new.is_admin is distinct from old.is_admin
       or new.is_active is distinct from old.is_active
       or new.role_id is distinct from old.role_id
       or new.email is distinct from old.email then
      raise exception 'Only administrators can change roles or access';
    end if;
  end if;
  return new;
end;
$$;

-- ───────────────────────── Demo accounts ─────────────────────────
-- Fixed ids so the seed data and the app's role switcher can reference them.
-- Password is shared by all demo accounts and lives in src/lib/demo.ts.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  phone_change, phone_change_token, email_change_token_current, reauthentication_token
)
select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
       extensions.crypt('GnexaDemo#2026', extensions.gen_salt('bf')), now(),
       '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('full_name', u.full_name),
       now() - interval '60 days', now(),
       '', '', '', '', '', '', '', ''
from (values
  ('a0000000-0000-4000-8000-000000000001'::uuid, 'admin@demo.gnexa.app',     'Aarav Mehta'),
  ('a0000000-0000-4000-8000-000000000002'::uuid, 'manager@demo.gnexa.app',   'Priya Nair'),
  ('a0000000-0000-4000-8000-000000000003'::uuid, 'executive@demo.gnexa.app', 'Rohan Kulkarni'),
  ('a0000000-0000-4000-8000-000000000004'::uuid, 'support@demo.gnexa.app',   'Sneha Iyer')
) as u(id, email, full_name)
on conflict (id) do nothing;

insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select u.id::text, u.id, jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       'email', now(), now(), now()
from auth.users u
where u.email like '%@demo.gnexa.app'
  and not exists (select 1 from auth.identities i where i.user_id = u.id and i.provider = 'email');

update public.profiles p set
  is_active = true,
  is_admin  = (p.email = 'admin@demo.gnexa.app'),
  role_id   = case p.email
                when 'manager@demo.gnexa.app'   then (select id from public.roles where name = 'Sales Manager')
                when 'executive@demo.gnexa.app' then (select id from public.roles where name = 'Sales Executive')
                when 'support@demo.gnexa.app'   then (select id from public.roles where name = 'Support')
              end,
  job_title = case p.email
                when 'admin@demo.gnexa.app'     then 'Administrator'
                when 'manager@demo.gnexa.app'   then 'Sales Manager'
                when 'executive@demo.gnexa.app' then 'Sales Executive'
                when 'support@demo.gnexa.app'   then 'Customer Support'
              end
where p.email like '%@demo.gnexa.app';

update public.company_settings set company_name = 'Gnexa Demo Co.', currency = 'INR';

-- ───────────────────────── Demo dataset ─────────────────────────
create or replace function private.seed_demo_data() returns void
language plpgsql security definer set search_path = '' as $$
declare
  admin uuid := 'a0000000-0000-4000-8000-000000000001';
  mgr   uuid := 'a0000000-0000-4000-8000-000000000002';
  exec  uuid := 'a0000000-0000-4000-8000-000000000003';
  sup   uuid := 'a0000000-0000-4000-8000-000000000004';
  rec record;
  cid bigint; lid bigint; tid bigint;
  i int := 0;
begin
  -- Customers + primary contacts
  for rec in select * from (values
    ('Tata Advanced Materials', 'VIP',       'Mumbai',    'Maharashtra', '+91 22 6665 8282', 'tataadvanced.example.in', 'Rajesh', 'Khanna',   'Head of Procurement', 120),
    ('Zenith Pharma Pvt Ltd',   'Wholesale', 'Ahmedabad', 'Gujarat',     '+91 79 4000 1122', 'zenithpharma.example.in', 'Pooja',  'Shah',     'Purchase Manager',     95),
    ('Orchid Hotels & Resorts', 'VIP',       'Goa',       'Goa',         '+91 832 245 9900', 'orchidhotels.example.in', 'Sunil',  'Fernandes','Operations Director',  80),
    ('Nimbus Software Labs',    'Retail',    'Bengaluru', 'Karnataka',   '+91 80 4123 7788', 'nimbuslabs.example.in',   'Kavya',  'Reddy',    'CTO',                  64),
    ('Coastal Foods Exports',   'Wholesale', 'Kochi',     'Kerala',      '+91 484 239 1100', 'coastalfoods.example.in', 'Manoj',  'Pillai',   'Managing Partner',     51),
    ('Everest Builders',        'Retail',    'Pune',      'Maharashtra', '+91 20 2567 4433', 'everestbuild.example.in', 'Lata',   'Deshmukh', 'Finance Head',         44),
    ('Sunrise Diagnostics',     'Retail',    'Hyderabad', 'Telangana',   '+91 40 6677 1200', 'sunrisediag.example.in',  'Imran',  'Qureshi',  'Admin Manager',        37),
    ('Bluewave Logistics',      'Wholesale', 'Chennai',   'Tamil Nadu',  '+91 44 2815 6600', 'bluewave.example.in',     'Deepa',  'Raman',    'COO',                  29),
    ('Saffron Retail Chain',    'VIP',       'Jaipur',    'Rajasthan',   '+91 141 401 8800', 'saffronretail.example.in','Vivek',  'Agarwal',  'Category Head',        22),
    ('Kaveri Textiles',         'Wholesale', 'Coimbatore','Tamil Nadu',  '+91 422 431 2200', 'kaveritex.example.in',    'Meena',  'Sundaram', 'Owner',                15),
    ('UrbanNest Interiors',     'Retail',    'Delhi',     'Delhi',       '+91 11 4155 9090', 'urbannest.example.in',    'Arjun',  'Bhatia',   'Founder',               9),
    ('Greenfield Agro',         'Retail',    'Indore',    'Madhya Pradesh','+91 731 499 3300','greenfieldagro.example.in','Neha',  'Joshi',    'Procurement Lead',      4)
  ) as t(company, grp, city, state, phone, website, cfirst, clast, ctitle, age)
  loop
    insert into public.customers (company, phone, website, city, state, country, vat, group_id, is_active, created_by, created_at)
    values (rec.company, rec.phone, rec.website, rec.city, rec.state, 'India',
            '27AAB' || upper(substr(md5(rec.company), 1, 5)) || '1Z5',
            (select id from public.customer_groups where name = rec.grp),
            rec.company <> 'Kaveri Textiles', (array[admin, mgr, exec])[1 + (rec.age % 3)],
            now() - make_interval(days => rec.age))
    returning id into cid;
    insert into public.contacts (customer_id, first_name, last_name, title, email, phone, is_primary, created_at)
    values (cid, rec.cfirst, rec.clast, rec.ctitle,
            lower(rec.cfirst) || '@' || rec.website, '+91 98' || lpad((abs(hashtext(rec.company)) % 100000000)::text, 8, '0'),
            true, now() - make_interval(days => rec.age));
    insert into public.activity_log (rel_type, rel_id, description, actor_id, created_at)
    values ('customer', cid, 'created customer "' || rec.company || '"', (array[admin, mgr, exec])[1 + (rec.age % 3)], now() - make_interval(days => rec.age));
  end loop;

  -- A few secondary contacts
  insert into public.contacts (customer_id, first_name, last_name, title, email, phone, is_primary)
  select c.id, x.f, x.l, x.t, lower(x.f) || '@' || c.website, x.p, false
  from (values
    ('Tata Advanced Materials', 'Anil',  'Menon',   'Plant Manager',     '+91 98200 11223'),
    ('Tata Advanced Materials', 'Ritu',  'Sinha',   'Accounts Payable',  '+91 98200 44556'),
    ('Orchid Hotels & Resorts', 'Clara', 'D''Souza','Front Office Lead', '+91 98220 77889'),
    ('Nimbus Software Labs',    'Harsh', 'Vardhan', 'Engineering Lead',  '+91 99000 12121')
  ) as x(company, f, l, t, p)
  join public.customers c on c.company = x.company;

  -- Leads across the pipeline
  for rec in select * from (values
    ('Meera Kapoor',     'Kapoor Textiles',       'Director',        'New',           'Website',    exec,  180000,  1),
    ('Karan Malhotra',   'Malhotra Motors',       'Owner',           'New',           'Google Ads', exec,   95000,  2),
    ('Ishita Jain',      'Jain Jewellers',        'Partner',         'New',           'Facebook',   mgr,    52000,  0),
    ('Siddharth Rao',    'Rao Agritech',          'CEO',             'New',           'LinkedIn',   null,  320000,  3),
    ('Arjun Rao',        'Rao Logistics',         'GM Operations',   'Contacted',     'Referral',   mgr,   450000,  4),
    ('Divya Menon',      'GreenLeaf Organics',    'Founder',         'Contacted',     'Referral',   exec,  640000,  6),
    ('Tanvi Kulkarni',   'Kulkarni Clinics',      'Admin Head',      'Contacted',     'Website',    exec,  140000,  5),
    ('Sana Sheikh',      'Bloom Florists',        'Owner',           'Qualified',     'Google Ads', exec,   80000,  8),
    ('Rohit Bansal',     'Bansal Steel',          'VP Purchase',     'Qualified',     'Trade Show', mgr,   210000,  9),
    ('Aditya Verma',     'Verma Constructions',   'Project Head',    'Qualified',     'Cold Call',  mgr,   975000, 11),
    ('Vikram Iyer',      'Iyer & Sons',           'Managing Director','Proposal Sent','LinkedIn',   mgr,  1250000, 12),
    ('Ananya Das',       'Skyline Realty',        'Marketing Head',  'Proposal Sent', 'LinkedIn',   exec,  875000, 14),
    ('Farhan Ali',       'Ali Electronics',       'Owner',           'Proposal Sent', 'Website',    exec,  150000, 13),
    ('Nikhil Chopra',    'Chopra Hospitality',    'Director',        'Negotiation',   'Referral',   mgr,  1800000, 18),
    ('Shreya Ghosh',     'Ghosh Educational Trust','Trustee',        'Negotiation',   'Trade Show', admin, 560000, 16),
    ('Rahul Saxena',     'Saxena Auto Parts',     'Purchase Head',   'Contacted',     'Cold Call',  exec,  230000, 20),
    ('Pallavi Desai',    'Desai Dairy',           'Owner',           'Qualified',     'Facebook',   exec,  110000, 22),
    ('Gaurav Arora',     'Arora Packaging',       'CEO',             'Contacted',     'Google Ads', mgr,   390000, 25),
    ('Lakshmi Narayan',  'Narayan Spices',        'Partner',         'Contacted',     'Trade Show', exec,   75000, 27),
    ('Kunal Shah',       'Shah Fintech',          'Founder',         'Negotiation',   'LinkedIn',   mgr,   720000, 10)
  ) as t(name, company, title, status, source, owner, value, age)
  loop
    i := i + 1;
    insert into public.leads (name, company, title, email, phone, city, country, value, status_id, source_id,
                              assigned_to, position, created_by, created_at, last_contact_at, description)
    values (rec.name, rec.company, rec.title,
            lower(split_part(rec.name, ' ', 1)) || '@' || lower(replace(split_part(rec.company, ' ', 1), '&', '')) || '.example.in',
            '+91 9' || lpad((abs(hashtext(rec.name)) % 1000000000)::text, 9, '0'),
            (array['Mumbai','Pune','Delhi','Bengaluru','Chennai','Hyderabad','Kolkata','Ahmedabad'])[1 + i % 8], 'India',
            rec.value,
            (select id from public.lead_statuses where name = rec.status),
            (select id from public.lead_sources where name = rec.source),
            rec.owner, i, coalesce(rec.owner, admin),
            now() - make_interval(days => rec.age, hours => i),
            case when rec.age > 2 then now() - make_interval(days => rec.age / 3) end,
            'Enquired about an annual service contract. Decision expected this quarter.')
    returning id into lid;
    insert into public.activity_log (rel_type, rel_id, description, actor_id, created_at)
    values ('lead', lid, 'created lead "' || rec.name || '"', coalesce(rec.owner, admin), now() - make_interval(days => rec.age, hours => i));
  end loop;

  -- Lost and junk leads
  insert into public.leads (name, company, value, status_id, source_id, assigned_to, is_lost, position, created_by, created_at)
  values
    ('Mohit Sethi', 'Sethi Traders', 85000, (select id from public.lead_statuses where name = 'Proposal Sent'),
     (select id from public.lead_sources where name = 'Website'), exec, true, 100, exec, now() - interval '40 days'),
    ('Rekha Pillai', 'Pillai Boutique', 40000, (select id from public.lead_statuses where name = 'Contacted'),
     (select id from public.lead_sources where name = 'Facebook'), exec, true, 101, exec, now() - interval '35 days');
  insert into public.leads (name, company, status_id, source_id, is_junk, position, created_by, created_at)
  values ('Test Enquiry', 'asdf', (select id from public.lead_statuses where name = 'New'),
          (select id from public.lead_sources where name = 'Website'), true, 102, admin, now() - interval '7 days');

  -- Leads already won: linked to existing customers
  insert into public.leads (name, company, value, status_id, source_id, assigned_to, converted_customer_id, converted_at, position, created_by, created_at)
  select x.name, c.company, x.value, (select id from public.lead_statuses where is_won order by sort_order limit 1),
         (select id from public.lead_sources where name = x.source), x.owner, c.id, c.created_at, 200 + x.n, x.owner, c.created_at - interval '12 days'
  from (values
    (1, 'Nimbus Software Labs', 'Kavya Reddy',  'LinkedIn', mgr,  480000),
    (2, 'Everest Builders',     'Lata Deshmukh','Referral', exec, 260000),
    (3, 'Sunrise Diagnostics',  'Imran Qureshi','Website',  exec, 190000),
    (4, 'Greenfield Agro',      'Neha Joshi',   'Google Ads', mgr, 150000)
  ) as x(n, company, name, source, owner, value)
  join public.customers c on c.company = x.company;

  -- Tasks
  for rec in select * from (values
    ('Send revised quotation to Vikram',         'lead',     'Iyer & Sons',             'in_progress',      'high',   -1, array[mgr]),
    ('Follow-up call with Meera',                'lead',     'Kapoor Textiles',         'not_started',      'medium',  0, array[exec]),
    ('Prepare onboarding deck for Nimbus',       'customer', 'Nimbus Software Labs',    'awaiting_feedback','urgent',  1, array[mgr, sup]),
    ('Review AMC contract draft',                'customer', 'Tata Advanced Materials', 'testing',          'high',    2, array[admin, mgr]),
    ('Collect KYC documents',                    'customer', 'Zenith Pharma Pvt Ltd',   'complete',         'medium', -3, array[sup]),
    ('Product demo for Skyline Realty',          'lead',     'Skyline Realty',          'not_started',      'high',    3, array[exec]),
    ('Update pricing sheet for Q4',              null,       null,                      'in_progress',      'low',     5, array[mgr]),
    ('Resolve billing query',                    'customer', 'Orchid Hotels & Resorts', 'in_progress',      'urgent',  0, array[sup]),
    ('Site visit — Chopra Hospitality',          'lead',     'Chopra Hospitality',      'not_started',      'high',    4, array[mgr, exec]),
    ('Negotiate payment terms',                  'lead',     'Shah Fintech',            'awaiting_feedback','medium',  2, array[mgr]),
    ('Share case studies with Divya',            'lead',     'GreenLeaf Organics',      'complete',         'low',    -2, array[exec]),
    ('Quarterly business review',                'customer', 'Saffron Retail Chain',    'not_started',      'medium',  9, array[mgr, admin]),
    ('Fix login issue on customer portal',       'customer', 'Bluewave Logistics',      'testing',          'high',    1, array[sup]),
    ('Call back Rohit about steel grades',       'lead',     'Bansal Steel',            'not_started',      'medium', -2, array[mgr]),
    ('Renewal reminder — Coastal Foods',         'customer', 'Coastal Foods Exports',   'not_started',      'low',    12, array[exec]),
    ('Train new support hire on CRM',            null,       null,                      'in_progress',      'medium',  6, array[sup, admin]),
    ('Send welcome kit to Greenfield',           'customer', 'Greenfield Agro',         'complete',         'low',    -1, array[sup]),
    ('Clean up junk leads',                      null,       null,                      'not_started',      'low',     7, array[admin])
  ) as t(name, rel_type, rel_name, status, priority, due, assignees)
  loop
    insert into public.tasks (name, rel_type, rel_id, status, priority, start_date, due_date, created_by, created_at)
    values (rec.name, rec.rel_type,
            case rec.rel_type
              when 'customer' then (select id from public.customers where company = rec.rel_name)
              when 'lead'     then (select id from public.leads where company = rec.rel_name and converted_customer_id is null limit 1)
            end,
            rec.status::public.task_status, rec.priority::public.task_priority,
            current_date - 5, current_date + rec.due, rec.assignees[1], now() - interval '5 days')
    returning id into tid;
    insert into public.task_assignees (task_id, staff_id) select tid, unnest(rec.assignees);
  end loop;

  -- Notes
  insert into public.notes (rel_type, rel_id, body, created_by, created_at)
  select x.rel_type,
         case x.rel_type when 'customer' then (select id from public.customers where company = x.target)
                         else (select id from public.leads where company = x.target and converted_customer_id is null limit 1) end,
         x.body, x.author, now() - make_interval(hours => x.hrs)
  from (values
    ('lead', 'Kapoor Textiles', 'Spoke with Meera — needs pricing for 3 warehouses. Wants a call next Tuesday.', exec, 20),
    ('lead', 'Iyer & Sons', 'Vikram asked for a 5% volume discount on the 3-year plan. Checking with finance.', mgr, 30),
    ('lead', 'Iyer & Sons', 'Finance approved up to 4%. Revised quote in progress.', admin, 6),
    ('lead', 'Chopra Hospitality', 'Decision maker is Nikhil; CFO joins the next meeting. Budget confirmed for Q4.', mgr, 50),
    ('lead', 'Skyline Realty', 'Interested mainly in the reporting module. Book a demo with their marketing team.', exec, 70),
    ('customer', 'Tata Advanced Materials', 'AMC renewal due next month. Legal reviewing the new indemnity clause.', admin, 26),
    ('customer', 'Orchid Hotels & Resorts', 'Billing query: invoice raised twice for September. Credit note to be issued.', sup, 4),
    ('customer', 'Nimbus Software Labs', 'Kick-off went well. They want SSO in phase two.', mgr, 90),
    ('customer', 'Bluewave Logistics', 'Customer reports intermittent login failures on mobile. Reproduced on Android 14.', sup, 10)
  ) as x(rel_type, target, body, author, hrs);

  -- Recent pipeline activity for the dashboard feed
  insert into public.activity_log (rel_type, rel_id, description, actor_id, created_at)
  select 'lead', l.id, x.d, x.a, now() - make_interval(hours => x.hrs)
  from (values
    ('Iyer & Sons',        'moved lead "Vikram Iyer" to Proposal Sent', mgr,  5),
    ('Chopra Hospitality', 'moved lead "Nikhil Chopra" to Negotiation', mgr,  9),
    ('Skyline Realty',     'moved lead "Ananya Das" to Proposal Sent',  exec, 14),
    ('Bansal Steel',       'moved lead "Rohit Bansal" to Qualified',    mgr,  28),
    ('GreenLeaf Organics', 'completed task "Share case studies with Divya"', exec, 33)
  ) as x(company, d, a, hrs)
  join public.leads l on l.company = x.company and l.converted_customer_id is null;
end;
$$;

-- Admin-only: wipe CRM records and restore the demo dataset (configuration and staff are kept)
create or replace function public.reset_demo_data() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'Only administrators can reset demo data'; end if;
  delete from public.task_assignees;
  delete from public.tasks;
  delete from public.notes;
  delete from public.activity_log;
  delete from public.contacts;
  delete from public.leads;
  delete from public.customers;
  perform private.seed_demo_data();
end;
$$;

revoke execute on function private.seed_demo_data() from public, anon, authenticated;
revoke execute on function public.reset_demo_data() from public, anon;
grant execute on function public.reset_demo_data() to authenticated;

-- Seed only into an empty CRM, so re-running this script never duplicates data
do $$ begin
  if not exists (select 1 from public.customers) then perform private.seed_demo_data(); end if;
end $$;

-- Quick check: 4 demo staff, 12 customers, 27 leads, 18 tasks
select (select count(*) from public.profiles where email like '%@demo.gnexa.app') as demo_staff,
       (select count(*) from public.customers) as customers,
       (select count(*) from public.leads) as leads,
       (select count(*) from public.tasks) as tasks;
