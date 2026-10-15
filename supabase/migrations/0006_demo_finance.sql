-- Gnexa CRM — demo finance data (catalogue, invoices in every state, estimates, proposals, credit notes, payments, expenses)

-- Recalculate stored totals from line items (discount % before tax, tax per line)
create or replace function private.recalc_doc(p_id bigint) returns void
language sql security definer set search_path = '' as $$
  update public.sales_docs d set
    subtotal       = round(x.sub, 2),
    discount_total = round(x.sub * d.discount_percent / 100, 2),
    tax_total      = round(x.tax, 2),
    total          = round(x.sub, 2) - round(x.sub * d.discount_percent / 100, 2) + round(x.tax, 2) + d.adjustment
  from (
    select coalesce(sum(i.qty * i.rate), 0) as sub,
           coalesce(sum(i.qty * i.rate * (1 - dd.discount_percent / 100) * i.tax_rate / 100), 0) as tax
    from public.sales_docs dd left join public.sales_doc_items i on i.doc_id = dd.id
    where dd.id = p_id
  ) x
  where d.id = p_id;
$$;

-- Create one demo document. p_party is a customer company, or (proposals) a lead's company.
-- p_lines: [{"d": description, "q": qty, "r": rate, "t": tax %, "u": unit, "ld": long description}]
create or replace function private.demo_doc(
  p_kind public.doc_kind, p_party text, p_days_ago int, p_due_in int, p_status text,
  p_subject text, p_lines jsonb, p_discount numeric default 0, p_content text default null
) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v_id bigint;
  v_customer bigint := (select id from public.customers where company = p_party);
  v_lead bigint;
  v_date date := current_date - p_days_ago;
begin
  if v_customer is null then
    select id into v_lead from public.leads where company = p_party and converted_customer_id is null limit 1;
  end if;
  insert into public.sales_docs (kind, customer_id, lead_id, subject, content, date, due_date, status, discount_percent,
                                 notes, terms, sent_at, created_by, created_at)
  values (p_kind, v_customer, v_lead, p_subject, p_content, v_date,
          case when p_kind <> 'credit_note' then v_date + p_due_in end,
          p_status, p_discount,
          case p_kind when 'invoice' then 'Thank you for your business.' end,
          case p_kind
            when 'invoice'  then (select default_terms from public.company_settings)
            when 'estimate' then 'Prices valid until the expiry date. Taxes as applicable.'
          end,
          case when p_status <> 'draft' then v_date::timestamptz + interval '10 hours' end,
          (array['a0000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000003']::uuid[])[1 + (p_days_ago % 2)],
          v_date::timestamptz + interval '9 hours')
  returning id into v_id;

  insert into public.sales_doc_items (doc_id, position, item_id, description, long_description, qty, unit, rate, tax_rate)
  select v_id, l.ord - 1, (select id from public.items where name = l.v->>'d'),
         l.v->>'d', l.v->>'ld', (l.v->>'q')::numeric, l.v->>'u', (l.v->>'r')::numeric, coalesce((l.v->>'t')::numeric, 18)
  from jsonb_array_elements(p_lines) with ordinality as l(v, ord);

  perform private.recalc_doc(v_id);
  return v_id;
end;
$$;

create or replace function private.seed_demo_finance() returns void
language plpgsql security definer set search_path = '' as $$
declare
  t18 bigint := (select id from public.taxes where rate = 18 limit 1);
  t12 bigint := (select id from public.taxes where rate = 12 limit 1);
  neft bigint := (select id from public.payment_modes where name like 'Bank transfer%' limit 1);
  upi  bigint := (select id from public.payment_modes where name = 'UPI' limit 1);
  chq  bigint := (select id from public.payment_modes where name = 'Cheque' limit 1);
  mgr  uuid := 'a0000000-0000-4000-8000-000000000002';
  exec uuid := 'a0000000-0000-4000-8000-000000000003';
  inv_tata bigint; inv_zenith bigint; inv_orchid bigint; inv_coastal bigint; inv_everest bigint; inv_blue bigint;
  cn_orchid bigint; est_orchid bigint; prop_nimbus bigint;
begin
  -- Catalogue
  insert into public.items (name, description, rate, unit, tax_id) values
    ('CRM Implementation',          'Setup, configuration and go-live support',        150000, 'project',   t18),
    ('Annual Maintenance Contract', 'Updates, bug fixes and business-hours support',     85000, 'year',      t18),
    ('User licence — Professional', 'Per user, per month',                                1200, 'user/month', t18),
    ('Onsite Training',             'Full-day hands-on training at your office',         25000, 'day',       t18),
    ('Custom Integration',          'Connector to ERP / accounting / e-commerce',        60000, 'project',   t18),
    ('Data Migration',              'Import from spreadsheets or legacy CRM',            40000, 'project',   t18),
    ('Priority Support Add-on',     '4-hour response, dedicated account manager',        15000, 'year',      t18),
    ('Barcode Scanner',             'Wireless 2D scanner with stand',                     8500, 'nos',       t18),
    ('Printed User Manual',         'Spiral-bound quick reference guide',                  450, 'nos',       t12);

  -- Invoices
  inv_tata := private.demo_doc('invoice', 'Tata Advanced Materials', 40, 15, 'sent', 'CRM rollout — phase 1',
    '[{"d":"CRM Implementation","q":1,"r":150000,"u":"project"},{"d":"Onsite Training","q":2,"r":25000,"u":"day"}]');
  inv_zenith := private.demo_doc('invoice', 'Zenith Pharma Pvt Ltd', 25, 15, 'sent', 'AMC FY 2026-27',
    '[{"d":"Annual Maintenance Contract","q":1,"r":85000,"u":"year"}]');
  inv_orchid := private.demo_doc('invoice', 'Orchid Hotels & Resorts', 20, 30, 'sent', 'Annual licences — 25 users',
    '[{"d":"User licence — Professional","q":300,"r":1200,"u":"user/month","ld":"25 users × 12 months"}]');
  perform private.demo_doc('invoice', 'Nimbus Software Labs', 12, 15, 'sent', 'ERP connector & data import',
    '[{"d":"Custom Integration","q":1,"r":60000,"u":"project"},{"d":"Data Migration","q":1,"r":40000,"u":"project"}]');
  inv_coastal := private.demo_doc('invoice', 'Coastal Foods Exports', 60, 15, 'sent', 'Support renewal',
    '[{"d":"Annual Maintenance Contract","q":1,"r":85000,"u":"year"},{"d":"Priority Support Add-on","q":1,"r":15000,"u":"year"}]');
  inv_everest := private.demo_doc('invoice', 'Everest Builders', 35, 15, 'sent', 'Site-team training',
    '[{"d":"Onsite Training","q":3,"r":25000,"u":"day"}]');
  perform private.demo_doc('invoice', 'Sunrise Diagnostics', 5, 15, 'draft', 'Licences — 10 users',
    '[{"d":"User licence — Professional","q":120,"r":1200,"u":"user/month","ld":"10 users × 12 months"}]');
  inv_blue := private.demo_doc('invoice', 'Bluewave Logistics', 50, 15, 'sent', 'CRM implementation',
    '[{"d":"CRM Implementation","q":1,"r":150000,"u":"project"}]', 10);
  perform private.demo_doc('invoice', 'Saffron Retail Chain', 8, 15, 'sent', 'Seasonal licences — 50 users',
    '[{"d":"User licence — Professional","q":150,"r":1200,"u":"user/month","ld":"50 users × 3 months"}]');
  perform private.demo_doc('invoice', 'Greenfield Agro', 3, 15, 'sent', 'Warehouse kit',
    '[{"d":"Barcode Scanner","q":4,"r":8500,"u":"nos"},{"d":"Printed User Manual","q":20,"r":450,"u":"nos","t":12}]');
  perform private.demo_doc('invoice', 'Kaveri Textiles', 90, 15, 'cancelled', 'Pilot (cancelled)',
    '[{"d":"Data Migration","q":1,"r":40000,"u":"project"}]');
  perform private.demo_doc('invoice', 'UrbanNest Interiors', 15, 7, 'sent', 'Training day',
    '[{"d":"Onsite Training","q":1,"r":25000,"u":"day"}]');

  -- Payments: Tata & Bluewave paid in full, Coastal in two parts, Orchid & Everest partially
  insert into public.payments (invoice_id, amount, date, mode_id, transaction_id, created_by) values
    (inv_tata,    236000, current_date - 30, neft, 'UTR HDFC260915001', mgr),
    (inv_blue,    159300, current_date - 41, neft, 'UTR ICIC260904117', exec),
    (inv_coastal,  60000, current_date - 52, chq,  'CHQ 004512',        exec),
    (inv_coastal,  58000, current_date - 44, upi,  'UPI 6612093381',    exec),
    (inv_orchid,  200000, current_date - 12, neft, 'UTR SBIN261003221', mgr),
    (inv_everest,  40000, current_date - 15, upi,  'UPI 7720018843',    exec);

  -- Credit notes: one applied to Orchid's invoice, one still open for Zenith
  cn_orchid := private.demo_doc('credit_note', 'Orchid Hotels & Resorts', 10, 0, 'sent', 'Duplicate September billing',
    '[{"d":"Credit — duplicate licence charge","q":1,"r":20000,"u":"","ld":"September licences were billed twice"}]');
  insert into public.credit_applications (credit_note_id, invoice_id, amount, date, created_by)
  values (cn_orchid, inv_orchid, 23600, current_date - 9, mgr);
  perform private.demo_doc('credit_note', 'Zenith Pharma Pvt Ltd', 5, 0, 'sent', 'Service downtime credit',
    '[{"d":"Service credit — 2 days downtime","q":1,"r":10000,"u":""}]');

  -- Estimates
  perform private.demo_doc('estimate', 'Tata Advanced Materials', 10, 30, 'sent', 'AMC renewal + priority support',
    '[{"d":"Annual Maintenance Contract","q":1,"r":85000,"u":"year"},{"d":"Priority Support Add-on","q":1,"r":15000,"u":"year"}]');
  est_orchid := private.demo_doc('estimate', 'Orchid Hotels & Resorts', 30, 30, 'accepted', 'Front-office expansion',
    '[{"d":"User licence — Professional","q":120,"r":1200,"u":"user/month"},{"d":"Onsite Training","q":1,"r":25000,"u":"day"}]');
  perform private.demo_doc('estimate', 'UrbanNest Interiors', 22, 30, 'declined', 'Full CRM rollout',
    '[{"d":"CRM Implementation","q":1,"r":150000,"u":"project"},{"d":"Data Migration","q":1,"r":40000,"u":"project"}]');
  perform private.demo_doc('estimate', 'Saffron Retail Chain', 2, 30, 'draft', 'Store-level rollout — 40 stores',
    '[{"d":"Barcode Scanner","q":40,"r":8500,"u":"nos"},{"d":"Onsite Training","q":4,"r":25000,"u":"day"}]', 5);
  perform private.demo_doc('estimate', 'Coastal Foods Exports', 45, 30, 'sent', 'Export docs integration',
    '[{"d":"Custom Integration","q":1,"r":60000,"u":"project"}]');

  -- Proposals (three to open leads, one to a customer)
  perform private.demo_doc('proposal', 'Iyer & Sons', 12, 21, 'sent', 'Sales automation for Iyer & Sons',
    '[{"d":"CRM Implementation","q":1,"r":150000,"u":"project"},{"d":"User licence — Professional","q":480,"r":1200,"u":"user/month","ld":"40 users × 12 months"},{"d":"Onsite Training","q":3,"r":25000,"u":"day"}]',
    4,
    E'Iyer & Sons runs sales across four branches on spreadsheets. We propose a single CRM with a shared pipeline, automatic follow-up tasks and invoice tracking.\n\nTimeline: 6 weeks from kick-off — setup (2 weeks), data migration (1 week), training and go-live (3 weeks).');
  perform private.demo_doc('proposal', 'Skyline Realty', 14, 21, 'sent', 'Reporting & lead tracking',
    '[{"d":"CRM Implementation","q":1,"r":150000,"u":"project"},{"d":"Custom Integration","q":1,"r":60000,"u":"project","ld":"Property portal lead capture"}]',
    0, E'Capture every portal enquiry automatically and give the marketing team live conversion reports by project and channel.');
  perform private.demo_doc('proposal', 'Chopra Hospitality', 2, 30, 'draft', 'Guest-relations CRM for 6 properties',
    '[{"d":"CRM Implementation","q":1,"r":150000,"u":"project"},{"d":"User licence — Professional","q":720,"r":1200,"u":"user/month"}]',
    8, E'Draft for CFO review.');
  prop_nimbus := private.demo_doc('proposal', 'Nimbus Software Labs', 70, 21, 'accepted', 'CRM for Nimbus Software Labs',
    '[{"d":"CRM Implementation","q":1,"r":150000,"u":"project"},{"d":"Data Migration","q":1,"r":40000,"u":"project"}]',
    0, E'Accepted — kicked off in August.');

  -- Expenses (amounts before GST)
  insert into public.expenses (name, category_id, amount, tax_rate, date, customer_id, payment_mode_id, reference, is_billable, created_by)
  select x.name, (select id from public.expense_categories where name = x.cat), x.amount, x.tax, current_date - x.ago,
         (select id from public.customers where company = x.cust), x.mode, x.ref, x.billable, x.who
  from (values
    ('Flight BLR–BOM for Tata go-live', 'Travel',                 9800, 5,    38, 'Tata Advanced Materials', upi,  'PNR K7QX2M', true,  mgr),
    ('Hotel — Mumbai, 2 nights',        'Travel',                 8400, 12,   37, 'Tata Advanced Materials', upi,  'INV H-55821', true, mgr),
    ('Cab to Pune site',                'Travel',                 2650, 5,     6, 'Everest Builders',        upi,  null,          true, exec),
    ('Google Workspace — October',      'Software & subscriptions', 4200, 18,  14, null,                     neft, 'GW-OCT-26',   false, mgr),
    ('Zoom Pro annual',                 'Software & subscriptions', 13200, 18, 46, null,                     neft, null,          false, mgr),
    ('LinkedIn sponsored posts',        'Marketing',              25000, 18,  20, null,                      neft, 'LI-CMP-0910', false, mgr),
    ('Trade show booth — Bengaluru',    'Marketing',              60000, 18,  33, null,                      chq,  'BTS-2026-118', false, mgr),
    ('Office stationery',               'Office supplies',         3150, 12,   9, null,                      upi,  null,          false, exec),
    ('Client lunch — Orchid team',      'Meals & entertainment',   4600, 5,   18, 'Orchid Hotels & Resorts', upi,  null,          false, exec),
    ('Internet — October',              'Utilities',               2999, 18,   4, null,                      neft, 'ACT-OCT',     false, mgr),
    ('Freelance designer — proposal deck', 'Contractors',         18000, 0,   11, null,                      neft, null,          false, mgr),
    ('Barcode scanner samples',         'Office supplies',        17000, 18,   2, 'Greenfield Agro',         neft, 'PO-2219',     true,  exec)
  ) as x(name, cat, amount, tax, ago, cust, mode, ref, billable, who);

  -- Pipeline links between documents
  update public.sales_docs set source_id = prop_nimbus where kind = 'invoice' and subject = 'ERP connector & data import';
  update public.sales_docs set source_id = est_orchid where id = inv_orchid;

  insert into public.activity_log (rel_type, rel_id, description, actor_id, created_at)
  select 'customer', (select id from public.customers where company = x.company), x.descr, x.who, now() - make_interval(hours => x.hrs)
  from (values
    ('Orchid Hotels & Resorts', 'recorded a payment of ₹2,00,000 on an invoice', mgr,  7),
    ('Greenfield Agro',         'created an invoice for the warehouse kit',     exec, 3),
    ('Zenith Pharma Pvt Ltd',   'issued a service-downtime credit note',        mgr, 12)
  ) as x(company, descr, who, hrs);
end;
$$;

-- Reset now restores finance data too
create or replace function public.reset_demo_data() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'Only administrators can reset demo data'; end if;
  delete from public.credit_applications where true;
  delete from public.payments where true;
  delete from public.expenses where true;
  delete from public.sales_doc_items where true;
  delete from public.sales_docs where true;
  delete from public.items where true;
  delete from public.task_assignees where true;
  delete from public.tasks where true;
  delete from public.notes where true;
  delete from public.activity_log where true;
  delete from public.contacts where true;
  delete from public.leads where true;
  delete from public.customers where true;
  perform private.seed_demo_data();
  perform private.seed_demo_finance();
end;
$$;

revoke execute on function private.recalc_doc(bigint) from public, anon, authenticated;
revoke execute on function private.demo_doc(public.doc_kind, text, int, int, text, text, jsonb, numeric, text) from public, anon, authenticated;
revoke execute on function private.seed_demo_finance() from public, anon, authenticated;
revoke execute on function public.reset_demo_data() from public, anon;
grant execute on function public.reset_demo_data() to authenticated;

-- Seed once, only into an empty finance module
do $$ begin
  if not exists (select 1 from public.sales_docs) then perform private.seed_demo_finance(); end if;
end $$;
