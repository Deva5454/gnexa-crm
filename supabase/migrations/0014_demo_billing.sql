-- Gnexa CRM — Phase 6 demo data: a recurring retainer, recurring expenses, subscriptions and e-mail history

create or replace function private.seed_demo_billing() returns void
language plpgsql security definer set search_path = '' as $$
declare
  mgr   uuid := 'a0000000-0000-4000-8000-000000000002';
  exec  uuid := 'a0000000-0000-4000-8000-000000000003';
  neft  bigint := (select id from public.payment_modes where name like 'Bank transfer%' limit 1);
  upi   bigint := (select id from public.payment_modes where name = 'UPI' limit 1);
  lic   bigint := (select id from public.items where name = 'User licence — Professional' limit 1);
  tmpl  bigint;
  sub_orchid bigint;
  r record;
begin
  -- A monthly support retainer for Nimbus, started three months ago
  tmpl := private.demo_doc('invoice', 'Nimbus Software Labs', 95, 15, 'sent', 'Monthly support retainer',
    '[{"d":"Support retainer","ld":"Up to 12 hours of priority support per month","q":1,"r":25000,"t":18,"u":"month"}]');
  update public.sales_docs set recurring_every = 1, recurring_unit = 'month', recurring_cycles = 12,
    next_recurring_date = (date + interval '1 month')::date where id = tmpl;

  -- Recurring expenses
  insert into public.expenses (name, category_id, amount, tax_rate, date, payment_mode_id, note, recurring_every, recurring_unit, next_recurring_date, created_by)
  values
    ('Office rent — Pune', (select id from public.expense_categories where name = 'Utilities'), 45000, 0, current_date - 100, neft,
     'Monthly lease, Baner office', 1, 'month', (current_date - 100 + interval '1 month')::date, mgr),
    ('AWS hosting', (select id from public.expense_categories where name = 'Software & subscriptions'), 18000, 18, current_date - 70, neft,
     'Production + staging', 1, 'month', (current_date - 70 + interval '1 month')::date, mgr);

  -- Subscriptions
  insert into public.subscriptions (customer_id, name, description, item_id, quantity, unit_price, tax_rate, interval_count, interval_unit,
                                    start_date, next_billing_date, auto_charge, created_by, created_at)
  select c.id, x.name, x.descr, x.item, x.qty, x.price, 18, 1, x.unit, current_date - x.started, current_date - x.started, x.auto, mgr, now() - make_interval(days => x.started)
  from (values
    ('Tata Advanced Materials', 'Gnexa Professional — 40 users', 'Monthly licences for the sales and service teams', lic, 40, 1200, 'month', 80, true),
    ('Orchid Hotels & Resorts', 'Priority support plan',          '4-hour response, named account manager',         null, 1, 15000, 'month', 50, false),
    ('Nimbus Software Labs',    'Managed hosting (annual)',       'Dedicated instance, daily backups, 99.9% SLA',  null, 1, 60000, 'year',  40, false)
  ) as x(company, name, descr, item, qty, price, unit, started, auto)
  join public.customers c on c.company = x.company;

  insert into public.subscriptions (customer_id, name, description, quantity, unit_price, tax_rate, interval_unit, start_date, next_billing_date, status, created_by)
  values ((select id from public.customers where company = 'Greenfield Agro'), 'SMS pack — 10,000 credits', 'Paused by customer for the off-season',
          1, 2500, 18, 'month', current_date - 60, current_date + 12, 'paused', exec);
  insert into public.subscriptions (customer_id, name, quantity, unit_price, tax_rate, interval_unit, start_date, next_billing_date, status, cancelled_at, created_by)
  values ((select id from public.customers where company = 'Coastal Foods Exports'), 'WhatsApp notifications add-on',
          1, 3000, 18, 'month', current_date - 120, null, 'cancelled', now() - interval '30 days', exec);

  -- Catch up: creates the retainer copies, bills subscriptions and sends overdue reminders
  perform private.run_recurring_core();

  -- The customer paid the retainer up to last month, and some subscription invoices
  for r in select d.id, d.date, b.balance from public.sales_docs d join public.doc_balances b on b.id = d.id
           where (d.id = tmpl or d.recurring_from = tmpl) and d.date < current_date - 20 loop
    insert into public.payments (invoice_id, amount, date, mode_id, transaction_id, created_by)
    values (r.id, r.balance, r.date + 10, neft, 'UTR' || lpad((r.id * 7919 % 1000000)::text, 6, '0'), mgr);
  end loop;
  select id into sub_orchid from public.subscriptions where name = 'Priority support plan';
  insert into public.payments (invoice_id, amount, date, mode_id, transaction_id, created_by)
  select d.id, b.balance, d.date + 3, upi, 'UPI' || lpad((d.id * 104729 % 100000000)::text, 8, '0'), mgr
  from public.sales_docs d join public.doc_balances b on b.id = d.id
  where d.subscription_id = sub_orchid order by d.date limit 1;
  insert into public.payments (invoice_id, amount, date, mode_id, transaction_id, created_by)
  select d.id, b.balance, d.date + 5, neft, 'UTR' || lpad((d.id * 7919 % 1000000)::text, 6, '0'), mgr
  from public.sales_docs d join public.doc_balances b on b.id = d.id
  where d.subscription_id = (select id from public.subscriptions where name = 'Managed hosting (annual)');

  -- A few e-mails staff sent by hand
  insert into public.email_log (customer_id, to_email, to_name, subject, body, kind, rel_type, rel_id, sent_by, created_at)
  select d.customer_id, c.email, trim(c.first_name || ' ' || coalesce(c.last_name, '')),
         case d.kind when 'estimate' then 'Estimate ' when 'proposal' then 'Proposal ' else 'Invoice ' end
           || case d.kind when 'estimate' then 'EST-' when 'proposal' then 'PRO-' else 'INV-' end || lpad(d.number::text, 5, '0'),
         'Hi ' || c.first_name || E',\n\nPlease find the document attached. Let me know if you have any questions.\n\nRegards,\nPriya Nair',
         'document', 'sales_doc', d.id, mgr, coalesce(d.sent_at, d.created_at)
  from public.sales_docs d
  join lateral (select * from public.contacts where customer_id = d.customer_id order by is_primary desc, id limit 1) c on true
  where d.status in ('sent','accepted') and d.kind in ('estimate','invoice') and d.recurring_from is null and d.subscription_id is null
    and d.id <> tmpl
  order by d.date desc limit 6;
end;
$$;

-- Reset now also clears and re-seeds the billing data
create or replace function public.reset_demo_data() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'Only administrators can reset demo data'; end if;
  perform set_config('gnexa.seeding', 'on', true);  -- no notifications while re-seeding
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
  perform set_config('gnexa.seeding', 'off', true);
end;
$$;

revoke execute on function private.seed_demo_billing() from public, anon, authenticated;
revoke execute on function public.reset_demo_data() from public, anon;
grant execute on function public.reset_demo_data() to authenticated;

do $$ begin
  if not exists (select 1 from public.subscriptions) then perform private.seed_demo_billing(); end if;
end $$;
