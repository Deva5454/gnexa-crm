-- Gnexa CRM — Indian time and GST split (batch 6)
--
-- 1. "Today" is Indian time everywhere: the database's default time zone is Asia/Kolkata, and the
--    functions that date things (recurring billing, portal payments, saving documents, project invoicing)
--    pin it too, so between midnight and 5:30 am nothing is dated yesterday any more.
-- 2. Recurring dates no longer drift at month-end: every next date is counted from the start date
--    (31 Jan → 28 Feb → 31 Mar), not from the previous, clamped one (… → 28 Mar → 28 Apr).
--    Recurring copies no longer repeat one-off expense lines.
-- 3. GST: each document records its place of supply and whether the supply is intra-state
--    (CGST + SGST), inter-state (IGST) or an export — worked out from the company's GSTIN and the
--    customer's GSTIN / state / country when the customer is set. Documents keep what they were raised with.
-- 4. HSN / SAC codes on catalogue items and document lines.

-- ───────────────────────── Indian time ─────────────────────────
do $$ begin
  execute format('alter database %I set timezone to %L', current_database(), 'Asia/Kolkata');
end $$;
set timezone to 'Asia/Kolkata';

-- Next date counted from the anchor (start) date, so month-ends don't drift
create or replace function private.next_on_anchor(p_anchor date, p_cur date, p_n int, p_unit text) returns date
language plpgsql immutable set search_path = '' as $$
declare m int;
begin
  if p_unit in ('month', 'year') and p_anchor is not null then
    m := (extract(year from p_cur)::int - extract(year from p_anchor)::int) * 12 + extract(month from p_cur)::int - extract(month from p_anchor)::int;
    return (p_anchor + make_interval(months => m + case when p_unit = 'year' then p_n * 12 else p_n end))::date;
  end if;
  return private.add_interval(p_cur, p_n, p_unit);
end;
$$;
revoke execute on function private.next_on_anchor(date, date, int, text) from public, anon, authenticated;

-- ───────────────────────── HSN / SAC ─────────────────────────
alter table public.items add column if not exists hsn_sac text check (hsn_sac is null or hsn_sac ~ '^[0-9]{4,8}$');
alter table public.sales_doc_items add column if not exists hsn_sac text check (hsn_sac is null or hsn_sac ~ '^[0-9]{4,8}$');

-- ───────────────────────── GST supply type ─────────────────────────
create table if not exists private.gst_states (code text primary key, name text not null);
insert into private.gst_states (code, name) values
  ('01','Jammu and Kashmir'),('02','Himachal Pradesh'),('03','Punjab'),('04','Chandigarh'),('05','Uttarakhand'),
  ('06','Haryana'),('07','Delhi'),('08','Rajasthan'),('09','Uttar Pradesh'),('10','Bihar'),('11','Sikkim'),
  ('12','Arunachal Pradesh'),('13','Nagaland'),('14','Manipur'),('15','Mizoram'),('16','Tripura'),('17','Meghalaya'),
  ('18','Assam'),('19','West Bengal'),('20','Jharkhand'),('21','Odisha'),('22','Chhattisgarh'),('23','Madhya Pradesh'),
  ('24','Gujarat'),('26','Dadra and Nagar Haveli and Daman and Diu'),('27','Maharashtra'),('29','Karnataka'),('30','Goa'),
  ('31','Lakshadweep'),('32','Kerala'),('33','Tamil Nadu'),('34','Puducherry'),('35','Andaman and Nicobar Islands'),
  ('36','Telangana'),('37','Andhra Pradesh'),('38','Ladakh'),('97','Other Territory')
on conflict (code) do nothing;

alter table public.sales_docs
  add column if not exists supply_type text not null default 'intra' check (supply_type in ('intra', 'inter', 'export')),
  add column if not exists place_of_supply text;

-- State code from a GSTIN (first two digits) or a state name
create or replace function private.gst_state_code(p_gstin text, p_state text) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce(
    case when upper(regexp_replace(coalesce(p_gstin, ''), '\s', '', 'g')) ~ '^[0-9]{2}[A-Z]' then left(regexp_replace(p_gstin, '\s', '', 'g'), 2) end,
    (select code from private.gst_states
     where lower(name) = lower(trim(case lower(trim(coalesce(p_state, '')))
                                     when 'orissa' then 'Odisha' when 'pondicherry' then 'Puducherry' when 'new delhi' then 'Delhi'
                                     when 'nct of delhi' then 'Delhi' else p_state end)))
  );
$$;

-- Intra-state (CGST + SGST), inter-state (IGST) or export, from the company's and the customer's location
create or replace function private.set_supply() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  c record;
  home text;
  pos text;
begin
  if tg_op = 'UPDATE' and new.customer_id is not distinct from old.customer_id then return new; end if;
  select vat, state, country into c from public.customers where id = new.customer_id;
  if not found then new.supply_type := 'intra'; new.place_of_supply := null; return new; end if;
  home := private.gst_state_code((select gstin from public.company_settings limit 1), null);
  if c.country is not null and lower(trim(c.country)) not in ('', 'india', 'in', 'ind', 'bharat') then
    new.supply_type := 'export'; new.place_of_supply := '96';
    return new;
  end if;
  pos := private.gst_state_code(c.vat, c.state);
  new.place_of_supply := pos;
  new.supply_type := case when pos is null or home is null or pos = home then 'intra' else 'inter' end;
  return new;
end;
$$;
revoke execute on function private.set_supply() from public, anon, authenticated;
drop trigger if exists sales_docs_supply on public.sales_docs;
create trigger sales_docs_supply before insert or update of customer_id on public.sales_docs
  for each row execute function private.set_supply();

-- Existing documents: work it out once (the guards see no money or status change)
do $$
declare home text := private.gst_state_code((select gstin from public.company_settings limit 1), null);
begin
  perform set_config('gnexa.seeding', 'on', true);
  update public.sales_docs d set
    place_of_supply = case when x.export then '96' else x.pos end,
    supply_type = case when x.export then 'export' when x.pos is null or home is null or x.pos = home then 'intra' else 'inter' end
  from (select c.id,
               c.country is not null and lower(trim(c.country)) not in ('', 'india', 'in', 'ind', 'bharat') as export,
               private.gst_state_code(c.vat, c.state) as pos
        from public.customers c) x
  where x.id = d.customer_id;
end $$;

-- ───────────────────────── Functions: copies, the scheduled run, saving ─────────────────────────
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
  -- expense lines are one-offs: they aren't repeated on the copies
  insert into public.sales_doc_items (doc_id, position, item_id, hsn_sac, description, long_description, qty, unit, rate, tax_rate)
  select nid, position, item_id, hsn_sac, description, long_description, qty, unit, rate, tax_rate from public.sales_doc_items
  where doc_id = p_src and expense_id is null;
  perform private.recalc_doc(nid);
  return nid;
end;
$$;

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
      perform private.log_template(n.customer_id, 'invoice_send', jsonb_build_object('doc_number', private.inv_label(n.number),
        'total', private.money(n.total, n.currency), 'due_date', coalesce(to_char(n.due_date, 'DD Mon YYYY'), 'on receipt')),
        'document', 'sales_doc', nid, true);
      made_inv := made_inv + 1;
      d := private.next_on_anchor(t.date, d, t.recurring_every, t.recurring_unit);
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
      d := private.next_on_anchor(e.date, d, e.recurring_every, e.recurring_unit);
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
      insert into public.sales_doc_items (doc_id, position, item_id, hsn_sac, description, long_description, qty, unit, rate, tax_rate)
      values (nid, 0, sub.item_id, (select i.hsn_sac from public.items i where i.id = sub.item_id), sub.name, 'Billing period from ' || to_char(d, 'DD Mon YYYY') || ' to ' ||
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
        perform private.log_template(sub.customer_id, 'subscription_charged', jsonb_build_object('doc_number', private.inv_label(n.number),
          'total', private.money(n.total, n.currency), 'plan', sub.name), 'receipt', 'sales_doc', nid, true);
      else
        perform private.log_template(sub.customer_id, 'subscription_invoice', jsonb_build_object('doc_number', private.inv_label(n.number),
          'total', private.money(n.total, n.currency), 'plan', sub.name), 'subscription', 'sales_doc', nid, true);
      end if;
      insert into public.activity_log (rel_type, rel_id, description, actor_id)
      values ('customer', sub.customer_id, 'subscription “' || sub.name || '” billed on ' || private.inv_label(n.number), null);
      sub.cycles_billed := sub.cycles_billed + 1;
      made_sub := made_sub + 1;
      d := private.next_on_anchor(sub.start_date, d, sub.interval_count, sub.interval_unit);
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
      perform private.log_template(n.customer_id, 'overdue_reminder', jsonb_build_object('doc_number', private.inv_label(n.number),
        'due_date', to_char(n.due_date, 'DD Mon YYYY'), 'balance', private.money((select balance from public.doc_balances where id = n.id), n.currency)),
        'overdue_reminder', 'sales_doc', n.id, true);
      update public.sales_docs set last_reminder_at = now() where id = n.id;
      reminders := reminders + 1;
    end loop;
  end if;

  return jsonb_build_object('invoices', made_inv, 'expenses', made_exp, 'subscriptions', made_sub, 'reminders', reminders);
end;
$$;

create or replace function public.save_sales_doc(p_kind public.doc_kind, p_id bigint, p_doc jsonb, p_lines jsonb)
returns jsonb
language plpgsql set search_path = '' as $$
declare
  v_id bigint;
  v_number int;
  d jsonb := p_doc;
begin
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then raise exception 'Add at least one line item.'; end if;
  if jsonb_array_length(p_lines) > 200 then raise exception 'A document can have at most 200 lines.'; end if;

  if p_id is not null then
    perform 1 from public.sales_docs where id = p_id and kind = p_kind for update;
    if not found then raise exception 'Document not found.'; end if;
    update public.sales_docs set
      customer_id      = (d ->> 'customer_id')::bigint,
      lead_id          = (d ->> 'lead_id')::bigint,
      subject          = d ->> 'subject',
      content          = d ->> 'content',
      date             = (d ->> 'date')::date,
      due_date         = (d ->> 'due_date')::date,
      currency         = coalesce(d ->> 'currency', currency),
      discount_percent = coalesce((d ->> 'discount_percent')::numeric, 0),
      adjustment       = coalesce((d ->> 'adjustment')::numeric, 0),
      subtotal         = (d ->> 'subtotal')::numeric,
      discount_total   = (d ->> 'discount_total')::numeric,
      tax_total        = (d ->> 'tax_total')::numeric,
      total            = (d ->> 'total')::numeric,
      notes            = d ->> 'notes',
      terms            = d ->> 'terms',
      recurring_every     = case when d ? 'recurring_every' then (d ->> 'recurring_every')::int else recurring_every end,
      recurring_unit      = case when d ? 'recurring_unit' then coalesce(d ->> 'recurring_unit', 'month') else recurring_unit end,
      recurring_cycles    = case when d ? 'recurring_cycles' then (d ->> 'recurring_cycles')::int else recurring_cycles end,
      next_recurring_date = case when d ? 'next_recurring_date' then (d ->> 'next_recurring_date')::date else next_recurring_date end
    where id = p_id
    returning id, number into v_id, v_number;
    delete from public.sales_doc_items where doc_id = v_id;
  else
    insert into public.sales_docs (kind, customer_id, lead_id, subject, content, date, due_date, currency, discount_percent, adjustment,
                                   subtotal, discount_total, tax_total, total, notes, terms, status, sent_at, project_id, source_id,
                                   recurring_every, recurring_unit, recurring_cycles, next_recurring_date)
    values (p_kind, (d ->> 'customer_id')::bigint, (d ->> 'lead_id')::bigint, d ->> 'subject', d ->> 'content',
            coalesce((d ->> 'date')::date, current_date), (d ->> 'due_date')::date, coalesce(d ->> 'currency', 'INR'),
            coalesce((d ->> 'discount_percent')::numeric, 0), coalesce((d ->> 'adjustment')::numeric, 0),
            (d ->> 'subtotal')::numeric, (d ->> 'discount_total')::numeric, (d ->> 'tax_total')::numeric, (d ->> 'total')::numeric,
            d ->> 'notes', d ->> 'terms',
            case when d ->> 'status' = 'sent' then 'sent' else 'draft' end,
            case when d ->> 'status' = 'sent' then now() end,
            (d ->> 'project_id')::bigint, (d ->> 'source_id')::bigint,
            (d ->> 'recurring_every')::int, coalesce(d ->> 'recurring_unit', 'month'), (d ->> 'recurring_cycles')::int, (d ->> 'next_recurring_date')::date)
    returning id, number into v_id, v_number;
  end if;

  insert into public.sales_doc_items (doc_id, position, item_id, hsn_sac, description, long_description, qty, unit, rate, tax_rate, expense_id)
  select v_id, (l.ord - 1)::int, (l.x ->> 'item_id')::bigint, nullif(left(trim(l.x ->> 'hsn_sac'), 12), ''), l.x ->> 'description', l.x ->> 'long_description',
         (l.x ->> 'qty')::numeric, l.x ->> 'unit', (l.x ->> 'rate')::numeric, coalesce((l.x ->> 'tax_rate')::numeric, 0),
         (l.x ->> 'expense_id')::bigint
  from jsonb_array_elements(p_lines) with ordinality as l(x, ord);

  return jsonb_build_object('id', v_id, 'number', v_number);
end;
$$;

-- Pin Indian time on everything that decides "today", whatever the connection's own setting
alter function private.run_recurring_core() set timezone = 'Asia/Kolkata';
alter function private.copy_invoice(bigint, date) set timezone = 'Asia/Kolkata';
alter function public.save_sales_doc(public.doc_kind, bigint, jsonb, jsonb) set timezone = 'Asia/Kolkata';
alter function public.invoice_project(bigint) set timezone = 'Asia/Kolkata';
alter function public.portal_pay(bigint, numeric, text) set timezone = 'Asia/Kolkata';
