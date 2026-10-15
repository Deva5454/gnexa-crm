-- Gnexa CRM — Phase 6: recurring invoices & expenses, subscriptions, simulated e-mail (document sends,
-- overdue reminders, receipts), online payment from the client portal, expense receipts

-- ───────────────────────── Recurring invoices & expenses ─────────────────────────
-- A recurring record is a template: on each due date a copy is created and next_recurring_date moves on.
alter table public.sales_docs
  add column recurring_every      int check (recurring_every is null or recurring_every between 1 and 36),
  add column recurring_unit       text not null default 'month' check (recurring_unit in ('day','week','month','year')),
  add column recurring_cycles     int check (recurring_cycles is null or recurring_cycles > 0),
  add column recurring_done       int not null default 0,
  add column next_recurring_date  date,
  add column recurring_from       bigint references public.sales_docs(id) on delete set null,
  add column last_reminder_at     timestamptz;
create index sales_docs_recurring_idx on public.sales_docs(next_recurring_date) where recurring_every is not null;
create index sales_docs_recurring_from_idx on public.sales_docs(recurring_from);

alter table public.expenses
  add column recurring_every      int check (recurring_every is null or recurring_every between 1 and 36),
  add column recurring_unit       text not null default 'month' check (recurring_unit in ('day','week','month','year')),
  add column recurring_cycles     int check (recurring_cycles is null or recurring_cycles > 0),
  add column recurring_done       int not null default 0,
  add column next_recurring_date  date,
  add column recurring_from       bigint references public.expenses(id) on delete set null,
  add column receipt_path         text,
  add column receipt_name         text;
create index expenses_recurring_idx on public.expenses(next_recurring_date) where recurring_every is not null;
create index expenses_recurring_from_idx on public.expenses(recurring_from);

-- Next date after d for "every n units"
create or replace function private.add_interval(d date, n int, unit text) returns date
language sql immutable set search_path = '' as $$
  select (d + case unit when 'day' then make_interval(days => n) when 'week' then make_interval(weeks => n)
                        when 'year' then make_interval(years => n) else make_interval(months => n) end)::date;
$$;

-- ───────────────────────── Subscriptions ─────────────────────────
create table public.subscriptions (
  id                 bigint generated always as identity primary key,
  customer_id        bigint not null references public.customers(id) on delete cascade,
  name               text not null,
  description        text,
  item_id            bigint references public.items(id) on delete set null,
  quantity           numeric(12,2) not null default 1 check (quantity > 0),
  unit_price         numeric(14,2) not null check (unit_price >= 0),
  tax_rate           numeric(5,2) not null default 18,
  currency           text not null default 'INR',
  interval_count     int not null default 1 check (interval_count between 1 and 36),
  interval_unit      text not null default 'month' check (interval_unit in ('week','month','year')),
  start_date         date not null default current_date,
  next_billing_date  date,
  ends_after_cycles  int check (ends_after_cycles is null or ends_after_cycles > 0),
  cycles_billed      int not null default 0,
  auto_charge        boolean not null default false,
  status             text not null default 'active' check (status in ('active','paused','cancelled','completed')),
  cancelled_at       timestamptz,
  created_by         uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at         timestamptz not null default now()
);
create index subscriptions_customer_idx on public.subscriptions(customer_id);
create index subscriptions_due_idx on public.subscriptions(next_billing_date) where status = 'active';
create index subscriptions_item_idx on public.subscriptions(item_id);
create index subscriptions_created_by_idx on public.subscriptions(created_by);

alter table public.sales_docs add column subscription_id bigint references public.subscriptions(id) on delete set null;
create index sales_docs_subscription_idx on public.sales_docs(subscription_id);

-- ───────────────────────── E-mail log (the demo never sends real mail) ─────────────────────────
create table public.email_log (
  id           bigint generated always as identity primary key,
  customer_id  bigint references public.customers(id) on delete set null,
  to_email     text,
  to_name      text,
  subject      text not null,
  body         text not null,
  kind         text not null default 'manual' check (kind in ('document','overdue_reminder','statement','receipt','subscription','manual')),
  rel_type     text,
  rel_id       bigint,
  automatic    boolean not null default false,
  sent_by      uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now()
);
create index email_log_customer_idx on public.email_log(customer_id, created_at desc);
create index email_log_rel_idx on public.email_log(rel_type, rel_id);
create index email_log_sent_by_idx on public.email_log(sent_by);
create index email_log_created_idx on public.email_log(created_at desc);

alter table public.company_settings
  add column auto_overdue_reminders  boolean not null default true,
  add column overdue_reminder_days   int not null default 7 check (overdue_reminder_days between 1 and 60);

-- Log an e-mail to a customer's primary contact
create or replace function private.log_email(
  p_customer bigint, p_subject text, p_body text, p_kind text, p_rel_type text, p_rel_id bigint, p_auto boolean
) returns void
language plpgsql security definer set search_path = '' as $$
declare c public.contacts;
begin
  select * into c from public.contacts where customer_id = p_customer order by is_primary desc, id limit 1;
  insert into public.email_log (customer_id, to_email, to_name, subject, body, kind, rel_type, rel_id, automatic, sent_by)
  values (p_customer, c.email, nullif(trim(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, '')), ''),
          p_subject, p_body, p_kind, p_rel_type, p_rel_id, p_auto, case when p_auto then null else auth.uid() end);
end;
$$;

create or replace function private.inv_label(n int) returns text
language sql immutable set search_path = '' as $$ select 'INV-' || lpad(n::text, 5, '0') $$;

create or replace function private.money(v numeric, cur text) returns text
language sql immutable set search_path = '' as $$
  select case when cur = 'INR' then '₹' else cur || ' ' end || to_char(round(v), 'FM99,99,99,99,990');
$$;

-- Copy an invoice (header + lines) onto a new date. Returns the new invoice id.
create or replace function private.copy_invoice(p_src bigint, p_date date) returns bigint
language plpgsql security definer set search_path = '' as $$
declare s public.sales_docs; nid bigint;
begin
  select * into s from public.sales_docs where id = p_src;
  insert into public.sales_docs (kind, customer_id, subject, content, date, due_date, status, currency, discount_percent, adjustment,
                                 notes, terms, project_id, recurring_from, sent_at, created_by)
  values ('invoice', s.customer_id, s.subject, s.content, p_date,
          case when s.due_date is not null then p_date + (s.due_date - s.date) end,
          'sent', s.currency, s.discount_percent, s.adjustment, s.notes, s.terms, s.project_id, s.id, now(), s.created_by)
  returning id into nid;
  insert into public.sales_doc_items (doc_id, position, item_id, description, long_description, qty, unit, rate, tax_rate)
  select nid, position, item_id, description, long_description, qty, unit, rate, tax_rate from public.sales_doc_items where doc_id = p_src;
  perform private.recalc_doc(nid);
  return nid;
end;
$$;

-- The automation run: due recurring invoices/expenses, subscription billing and overdue reminders.
-- There's no scheduler in the demo, so the app calls this when people open finance pages; it catches up
-- on everything that has fallen due since the last run and is safe to call any number of times.
create or replace function private.run_recurring_core() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  t record; n public.sales_docs; e record; sub record;
  nid bigint; d date; guard int;
  made_inv int := 0; made_exp int := 0; made_sub int := 0; reminders int := 0;
  cs public.company_settings;
begin
  perform pg_advisory_xact_lock(hashtext('gnexa:run_recurring'));
  select * into cs from public.company_settings limit 1;

  -- Recurring invoices
  for t in select * from public.sales_docs
           where kind = 'invoice' and recurring_every is not null and next_recurring_date <= current_date and status <> 'cancelled'
           for update loop
    d := t.next_recurring_date; guard := 0;
    while d is not null and d <= current_date and (t.recurring_cycles is null or t.recurring_done < t.recurring_cycles) and guard < 36 loop
      nid := private.copy_invoice(t.id, d);
      select * into n from public.sales_docs where id = nid;
      t.recurring_done := t.recurring_done + 1;
      insert into public.activity_log (rel_type, rel_id, description, actor_id)
      values ('customer', n.customer_id, 'recurring invoice ' || private.inv_label(n.number) || ' created from ' || private.inv_label(t.number), null);
      perform private.log_email(n.customer_id, 'Invoice ' || private.inv_label(n.number) || ' from ' || coalesce(cs.company_name, 'us'),
        'Please find attached invoice ' || private.inv_label(n.number) || ' for ' || private.money(n.total, n.currency) ||
        coalesce(', due on ' || to_char(n.due_date, 'DD Mon YYYY'), '') || E'.\n\nYou can view and pay it from your client portal.',
        'document', 'sales_doc', nid, true);
      made_inv := made_inv + 1;
      d := private.add_interval(d, t.recurring_every, t.recurring_unit);
      guard := guard + 1;
    end loop;
    update public.sales_docs set recurring_done = t.recurring_done,
      next_recurring_date = case when t.recurring_cycles is not null and t.recurring_done >= t.recurring_cycles then null else d end
    where id = t.id;
  end loop;

  -- Recurring expenses
  for e in select * from public.expenses where recurring_every is not null and next_recurring_date <= current_date for update loop
    d := e.next_recurring_date; guard := 0;
    while d is not null and d <= current_date and (e.recurring_cycles is null or e.recurring_done < e.recurring_cycles) and guard < 36 loop
      insert into public.expenses (name, category_id, amount, tax_rate, date, customer_id, payment_mode_id, reference, note, is_billable, recurring_from, created_by)
      values (e.name, e.category_id, e.amount, e.tax_rate, d, e.customer_id, e.payment_mode_id, null, e.note, e.is_billable, e.id, e.created_by);
      e.recurring_done := e.recurring_done + 1;
      made_exp := made_exp + 1;
      d := private.add_interval(d, e.recurring_every, e.recurring_unit);
      guard := guard + 1;
    end loop;
    update public.expenses set recurring_done = e.recurring_done,
      next_recurring_date = case when e.recurring_cycles is not null and e.recurring_done >= e.recurring_cycles then null else d end
    where id = e.id;
  end loop;

  -- Subscriptions
  for sub in select * from public.subscriptions where status = 'active' and next_billing_date <= current_date for update loop
    d := sub.next_billing_date; guard := 0;
    while d <= current_date and (sub.ends_after_cycles is null or sub.cycles_billed < sub.ends_after_cycles) and guard < 36 loop
      insert into public.sales_docs (kind, customer_id, subject, date, due_date, status, currency, notes, terms, subscription_id, sent_at, created_by)
      values ('invoice', sub.customer_id, sub.name || ' — ' || to_char(d, 'Mon YYYY'), d, d + 7, 'sent', sub.currency,
              'Subscription: ' || sub.name, cs.default_terms, sub.id, now(), sub.created_by)
      returning id into nid;
      insert into public.sales_doc_items (doc_id, position, item_id, description, long_description, qty, unit, rate, tax_rate)
      values (nid, 0, sub.item_id, sub.name, 'Billing period from ' || to_char(d, 'DD Mon YYYY') || ' to ' ||
              to_char(private.add_interval(d, sub.interval_count, sub.interval_unit) - 1, 'DD Mon YYYY'),
              sub.quantity, case when sub.interval_unit = 'year' then 'year' when sub.interval_unit = 'week' then 'week' else 'month' end,
              sub.unit_price, sub.tax_rate);
      perform private.recalc_doc(nid);
      select * into n from public.sales_docs where id = nid;
      if sub.auto_charge then
        insert into public.payments (invoice_id, amount, date, mode_id, transaction_id, note, created_by)
        values (nid, n.total, d, (select id from public.payment_modes where name = 'Card' limit 1),
                'ch_demo_' || substr(md5(nid::text || clock_timestamp()::text), 1, 12),
                'Charged automatically to the card on file (demo — no money moved)', null);
        perform private.log_email(sub.customer_id, 'Payment receipt for ' || private.inv_label(n.number),
          'We charged ' || private.money(n.total, n.currency) || ' to your card on file for ' || sub.name || '. Thank you!', 'receipt', 'sales_doc', nid, true);
      else
        perform private.log_email(sub.customer_id, 'Invoice ' || private.inv_label(n.number) || ' — ' || sub.name,
          'Your subscription invoice for ' || private.money(n.total, n.currency) || ' is ready. You can pay it from your client portal.',
          'subscription', 'sales_doc', nid, true);
      end if;
      insert into public.activity_log (rel_type, rel_id, description, actor_id)
      values ('customer', sub.customer_id, 'subscription “' || sub.name || '” billed on ' || private.inv_label(n.number), null);
      sub.cycles_billed := sub.cycles_billed + 1;
      made_sub := made_sub + 1;
      d := private.add_interval(d, sub.interval_count, sub.interval_unit);
      guard := guard + 1;
    end loop;
    update public.subscriptions set cycles_billed = sub.cycles_billed, next_billing_date = d,
      status = case when sub.ends_after_cycles is not null and sub.cycles_billed >= sub.ends_after_cycles then 'completed' else status end
    where id = sub.id;
  end loop;

  -- Overdue reminders (one per invoice every N days)
  if coalesce(cs.auto_overdue_reminders, true) then
    for n in select d2.* from public.sales_docs d2 join public.doc_balances b on b.id = d2.id
             where d2.kind = 'invoice' and d2.status = 'sent' and d2.due_date < current_date and b.balance > 0
               and (d2.last_reminder_at is null or d2.last_reminder_at < now() - make_interval(days => coalesce(cs.overdue_reminder_days, 7)))
             for update of d2 loop
      perform private.log_email(n.customer_id, 'Reminder: invoice ' || private.inv_label(n.number) || ' is overdue',
        'This is a friendly reminder that invoice ' || private.inv_label(n.number) || ' was due on ' || to_char(n.due_date, 'DD Mon YYYY') ||
        ' and has an outstanding balance of ' || private.money((select balance from public.doc_balances where id = n.id), n.currency) ||
        E'.\n\nIf you have already paid, please ignore this message.', 'overdue_reminder', 'sales_doc', n.id, true);
      update public.sales_docs set last_reminder_at = now() where id = n.id;
      reminders := reminders + 1;
    end loop;
  end if;

  return jsonb_build_object('invoices', made_inv, 'expenses', made_exp, 'subscriptions', made_sub, 'reminders', reminders);
end;
$$;
revoke execute on function private.run_recurring_core() from public, anon, authenticated;

create or replace function public.run_recurring() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_staff() then return '{}'::jsonb; end if;
  return private.run_recurring_core();
end;
$$;
revoke execute on function public.run_recurring() from public, anon;
grant execute on function public.run_recurring() to authenticated;

-- ───────────────────────── Online payment from the client portal (simulated) ─────────────────────────
create or replace function public.portal_pay(p_invoice bigint, p_amount numeric, p_method text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  d public.sales_docs; bal numeric; txn text; mode bigint; who text; r uuid;
begin
  select * into d from public.sales_docs where id = p_invoice for update;
  if d.id is null or d.customer_id is distinct from private.portal_customer() or d.kind <> 'invoice' then raise exception 'Not found'; end if;
  if d.status in ('draft','cancelled') then raise exception 'This invoice cannot be paid online'; end if;
  select balance into bal from public.doc_balances where id = d.id;
  if coalesce(p_amount, 0) <= 0 then raise exception 'Enter an amount to pay'; end if;
  if p_amount > bal then raise exception 'You can pay at most %', private.money(bal, d.currency); end if;
  select id into mode from public.payment_modes
   where name = case p_method when 'upi' then 'UPI' when 'card' then 'Card' else 'Bank transfer (NEFT/RTGS)' end limit 1;
  txn := 'pay_demo_' || substr(md5(d.id::text || clock_timestamp()::text), 1, 12);
  insert into public.payments (invoice_id, amount, date, mode_id, transaction_id, note, created_by)
  values (d.id, round(p_amount, 2), current_date, mode, txn, 'Paid online in the client portal (demo — no money moved)', null);
  who := private.actor_name();
  insert into public.activity_log (rel_type, rel_id, description, actor_id)
  values ('customer', d.customer_id, who || ' paid ' || private.money(p_amount, d.currency) || ' on ' || private.inv_label(d.number) || ' online', null);
  perform private.log_email(d.customer_id, 'Payment received — ' || private.inv_label(d.number),
    'Thank you! We received ' || private.money(p_amount, d.currency) || ' for invoice ' || private.inv_label(d.number) || '. Reference: ' || txn || '.',
    'receipt', 'sales_doc', d.id, true);
  for r in select d.created_by where d.created_by is not null
           union select id from public.profiles where is_admin and is_active and d.created_by is null loop
    perform private.notify(r, who || ' paid ' || private.inv_label(d.number) || ' online', '/sales/invoices/' || d.id, private.money(p_amount, d.currency));
  end loop;
  return txn;
end;
$$;
revoke execute on function public.portal_pay(bigint, numeric, text) from public, anon;
grant execute on function public.portal_pay(bigint, numeric, text) to authenticated;

-- ───────────────────────── RLS ─────────────────────────
alter table public.subscriptions enable row level security;
alter table public.email_log     enable row level security;

create policy subscriptions_staff on public.subscriptions for all to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));
create policy subscriptions_portal on public.subscriptions for select to authenticated
  using (customer_id = (select private.portal_customer()));
create policy email_log_read on public.email_log for select to authenticated using ((select private.is_staff()));
create policy email_log_insert on public.email_log for insert to authenticated with check ((select private.is_staff()));
create policy email_log_delete on public.email_log for delete to authenticated using ((select private.is_admin()));

-- Expense receipts
insert into storage.buckets (id, name, public, file_size_limit)
values ('expense-receipts', 'expense-receipts', false, 10485760)
on conflict (id) do nothing;
create policy expense_receipts_read on storage.objects for select to authenticated
  using (bucket_id = 'expense-receipts' and (select private.is_staff()));
create policy expense_receipts_write on storage.objects for insert to authenticated
  with check (bucket_id = 'expense-receipts' and (select private.is_staff()));
create policy expense_receipts_remove on storage.objects for delete to authenticated
  using (bucket_id = 'expense-receipts' and (select private.is_staff()));

-- The subscription auto-charge and portal payments record against these modes
insert into public.payment_modes (name) select 'Card' where not exists (select 1 from public.payment_modes where name = 'Card');
