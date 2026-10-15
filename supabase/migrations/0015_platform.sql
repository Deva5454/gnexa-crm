-- Gnexa CRM — Phase 7: custom fields, e-mail templates, currencies, media library, web-to-lead &
-- estimate-request forms, newsfeed, surveys and GDPR tools

-- ───────────────────────── Custom fields ─────────────────────────
create table public.custom_fields (
  id              bigint generated always as identity primary key,
  entity          text not null check (entity in ('customer','lead','project','ticket','sales_doc','contract')),
  label           text not null check (length(trim(label)) between 1 and 60),
  type            text not null default 'text' check (type in ('text','textarea','number','date','select','checkbox')),
  options         text[] not null default '{}',
  required        boolean not null default false,
  show_on_pdf     boolean not null default false,
  position        int not null default 0,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);
create index custom_fields_entity_idx on public.custom_fields(entity, position);

create table public.custom_field_values (
  field_id  bigint not null references public.custom_fields(id) on delete cascade,
  rel_id    bigint not null,
  value     text,
  primary key (field_id, rel_id)
);
create index custom_field_values_rel_idx on public.custom_field_values(rel_id);

-- Record deleted → drop its tags, reminders and custom-field values
create or replace function private.cleanup_links() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.taggables where rel_type = tg_argv[0] and rel_id = old.id;
  delete from public.reminders where rel_type = tg_argv[0] and rel_id = old.id;
  delete from public.custom_field_values v using public.custom_fields f
   where v.field_id = f.id and f.entity = tg_argv[0] and v.rel_id = old.id;
  return old;
end;
$$;

-- ───────────────────────── E-mail templates ─────────────────────────
create table public.email_templates (
  key         text primary key,
  name        text not null,
  description text,
  subject     text not null,
  body        text not null,
  updated_at  timestamptz not null default now()
);

-- Replace {placeholders} with values
create or replace function private.render(t text, vars jsonb) returns text
language plpgsql immutable set search_path = '' as $$
declare k text; v text;
begin
  for k, v in select key, value from jsonb_each_text(vars) loop
    t := replace(t, '{' || k || '}', coalesce(v, ''));
  end loop;
  return t;
end;
$$;

-- Log an e-mail to a customer's primary contact using a template
create or replace function private.log_template(
  p_customer bigint, p_key text, p_vars jsonb, p_kind text, p_rel_type text, p_rel_id bigint, p_auto boolean
) returns void
language plpgsql security definer set search_path = '' as $$
declare c public.contacts; t public.email_templates; v jsonb;
begin
  select * into c from public.contacts where customer_id = p_customer order by is_primary desc, id limit 1;
  select * into t from public.email_templates where key = p_key;
  if t.key is null then return; end if;
  v := p_vars || jsonb_build_object('contact_name', coalesce(c.first_name, 'there'),
                                    'company_name', (select company_name from public.company_settings limit 1),
                                    'customer', (select company from public.customers where id = p_customer));
  insert into public.email_log (customer_id, to_email, to_name, subject, body, kind, rel_type, rel_id, automatic, sent_by)
  values (p_customer, c.email, nullif(trim(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, '')), ''),
          private.render(t.subject, v), private.render(t.body, v), p_kind, p_rel_type, p_rel_id, p_auto,
          case when p_auto then null else auth.uid() end);
end;
$$;

insert into public.email_templates (key, name, description, subject, body) values
  ('invoice_send', 'Invoice', 'Sending an invoice (also used for recurring copies)', 'Invoice {doc_number} from {company_name}',
   E'Hi {contact_name},\n\nPlease find attached invoice {doc_number} for {total}, due {due_date}.\n\nYou can view and pay it online from your client portal.\n\nRegards,\n{company_name}'),
  ('estimate_send', 'Estimate', 'Sending an estimate', 'Estimate {doc_number} from {company_name}',
   E'Hi {contact_name},\n\nPlease find attached estimate {doc_number} for {total}. You can review and accept it online from your client portal.\n\nLet us know if you have any questions.\n\nRegards,\n{company_name}'),
  ('proposal_send', 'Proposal', 'Sending a proposal', 'Proposal {doc_number}: {subject}',
   E'Hi {contact_name},\n\nThank you for your time. Please find our proposal {doc_number} attached — you can review and accept it online.\n\nRegards,\n{company_name}'),
  ('credit_note_send', 'Credit note', 'Sending a credit note', 'Credit note {doc_number} from {company_name}',
   E'Hi {contact_name},\n\nPlease find attached credit note {doc_number} for {total}.\n\nRegards,\n{company_name}'),
  ('overdue_reminder', 'Overdue reminder', 'Automatic and manual reminders for unpaid invoices', 'Reminder: invoice {doc_number} is overdue',
   E'Hi {contact_name},\n\nThis is a friendly reminder that invoice {doc_number} was due on {due_date} and {balance} is still outstanding.\n\nIf you have already paid, please ignore this message.\n\nRegards,\n{company_name}'),
  ('payment_receipt', 'Payment receipt', 'Sent when a client pays online', 'Payment received — {doc_number}',
   E'Hi {contact_name},\n\nThank you! We received {amount} for invoice {doc_number}. Your reference is {reference}.\n\nRegards,\n{company_name}'),
  ('subscription_invoice', 'Subscription invoice', 'Each billing period of a subscription', 'Invoice {doc_number} — {plan}',
   E'Hi {contact_name},\n\nYour invoice {doc_number} for {plan} ({total}) is ready. You can pay it from your client portal.\n\nRegards,\n{company_name}'),
  ('subscription_charged', 'Subscription charged', 'Auto-charged subscription periods', 'Payment receipt — {doc_number}',
   E'Hi {contact_name},\n\nWe charged {total} to your card on file for {plan} (invoice {doc_number}). Thank you!\n\nRegards,\n{company_name}'),
  ('statement', 'Account statement', 'Sending a customer statement', 'Account statement {from} – {to}',
   E'Hi {contact_name},\n\nPlease find attached your account statement for {from} to {to}. The balance due is {balance}.\n\nRegards,\n{company_name}');

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
  perform private.log_template(d.customer_id, 'payment_receipt', jsonb_build_object('doc_number', private.inv_label(d.number),
    'amount', private.money(p_amount, d.currency), 'reference', txn), 'receipt', 'sales_doc', d.id, true);
  for r in select d.created_by where d.created_by is not null
           union select id from public.profiles where is_admin and is_active and d.created_by is null loop
    perform private.notify(r, who || ' paid ' || private.inv_label(d.number) || ' online', '/sales/invoices/' || d.id, private.money(p_amount, d.currency));
  end loop;
  return txn;
end;
$$;

-- ───────────────────────── Currencies ─────────────────────────
create table public.currencies (
  id       bigint generated always as identity primary key,
  code     text not null unique check (code ~ '^[A-Z]{3}$'),
  name     text not null,
  symbol   text not null,
  rate     numeric(14,6) not null default 1 check (rate > 0),   -- value of 1 unit in the base currency
  is_base  boolean not null default false
);
create unique index currencies_one_base on public.currencies(is_base) where is_base;
insert into public.currencies (code, name, symbol, rate, is_base) values
  ('INR', 'Indian rupee', '₹', 1, true), ('USD', 'US dollar', '$', 83.2, false), ('EUR', 'Euro', '€', 90.5, false),
  ('GBP', 'Pound sterling', '£', 105.8, false), ('AED', 'UAE dirham', 'AED', 22.65, false), ('SGD', 'Singapore dollar', 'S$', 61.9, false);

-- ───────────────────────── Media library ─────────────────────────
create table public.media_files (
  id           bigint generated always as identity primary key,
  folder       text not null default 'General',
  name         text not null,
  path         text not null unique,
  size         bigint not null default 0,
  mime         text,
  uploaded_by  uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now()
);
create index media_files_folder_idx on public.media_files(folder, created_at desc);
create index media_files_uploaded_by_idx on public.media_files(uploaded_by);

insert into storage.buckets (id, name, public, file_size_limit)
values ('media', 'media', false, 20971520)
on conflict (id) do nothing;
create policy media_read on storage.objects for select to authenticated using (bucket_id = 'media' and (select private.is_staff()));
create policy media_write on storage.objects for insert to authenticated with check (bucket_id = 'media' and (select private.is_staff()));
create policy media_remove on storage.objects for delete to authenticated using (bucket_id = 'media' and (select private.is_staff()));

-- ───────────────────────── Web forms: web-to-lead and estimate requests ─────────────────────────
create table public.web_forms (
  id               bigint generated always as identity primary key,
  key              uuid not null unique default gen_random_uuid(),
  name             text not null,
  kind             text not null default 'lead' check (kind in ('lead','estimate_request')),
  intro            text,
  fields           text[] not null default '{name,email,phone,company,message}',
  required         text[] not null default '{name,email}',
  source_id        bigint references public.lead_sources(id) on delete set null,
  status_id        bigint references public.lead_statuses(id) on delete set null,
  assigned_to      uuid references public.profiles(id) on delete set null,
  success_message  text not null default 'Thank you! We will be in touch shortly.',
  is_active        boolean not null default true,
  submissions      int not null default 0,
  created_by       uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at       timestamptz not null default now()
);
create index web_forms_source_idx on public.web_forms(source_id);
create index web_forms_status_idx on public.web_forms(status_id);
create index web_forms_assigned_idx on public.web_forms(assigned_to);
create index web_forms_created_by_idx on public.web_forms(created_by);

create table public.estimate_requests (
  id           bigint generated always as identity primary key,
  form_id      bigint references public.web_forms(id) on delete set null,
  name         text not null,
  email        text,
  phone        text,
  company      text,
  message      text,
  budget       text,
  status       text not null default 'new' check (status in ('new','in_review','quoted','declined')),
  assigned_to  uuid references public.profiles(id) on delete set null,
  lead_id      bigint references public.leads(id) on delete set null,
  estimate_id  bigint references public.sales_docs(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index estimate_requests_status_idx on public.estimate_requests(status, created_at desc);
create index estimate_requests_form_idx on public.estimate_requests(form_id);
create index estimate_requests_assigned_idx on public.estimate_requests(assigned_to);
create index estimate_requests_lead_idx on public.estimate_requests(lead_id);
create index estimate_requests_estimate_idx on public.estimate_requests(estimate_id);

-- Notification that doesn't depend on a signed-in user (public form submissions)
create or replace function private.notify_direct(p_user uuid, p_title text, p_link text, p_body text default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_user is null or current_setting('gnexa.seeding', true) = 'on' then return; end if;
  if not exists (select 1 from public.profiles where id = p_user and is_active) then return; end if;
  insert into public.notifications (user_id, title, link, body) values (p_user, p_title, p_link, p_body);
end;
$$;

-- What the public form page needs to render (only for active forms)
create or replace function public.web_form_info(p_key uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('name', f.name, 'kind', f.kind, 'intro', f.intro, 'fields', to_jsonb(f.fields), 'required', to_jsonb(f.required),
                            'company', (select company_name from public.company_settings limit 1))
  from public.web_forms f where f.key = p_key and f.is_active;
$$;

-- Submit a public form. Creates a lead or an estimate request and alerts the team.
create or replace function public.submit_web_form(p_key uuid, p_data jsonb) returns text
language plpgsql security definer set search_path = '' as $$
declare
  f public.web_forms; v_name text; v_email text; req text; new_id bigint; r uuid;
begin
  select * into f from public.web_forms where key = p_key and is_active;
  if f.id is null then raise exception 'This form is no longer available'; end if;
  -- Honeypot: bots fill the hidden "website" field
  if coalesce(p_data->>'website', '') <> '' then return f.success_message; end if;
  foreach req in array f.required loop
    if coalesce(trim(p_data->>req), '') = '' then raise exception 'Please fill in %', replace(req, '_', ' '); end if;
  end loop;
  v_name := left(trim(coalesce(p_data->>'name', '')), 120);
  v_email := lower(left(trim(coalesce(p_data->>'email', '')), 160));
  if v_name = '' then raise exception 'Please fill in name'; end if;
  if v_email <> '' and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Please enter a valid e-mail address'; end if;
  if length(coalesce(p_data->>'message', '')) > 4000 then raise exception 'Message is too long'; end if;
  -- Throttle repeat submissions from the same address
  if v_email <> '' and (
       (select count(*) from public.leads where lower(email) = v_email and created_at > now() - interval '1 hour') +
       (select count(*) from public.estimate_requests where lower(email) = v_email and created_at > now() - interval '1 hour')) >= 3 then
    raise exception 'We already have your details — we''ll be in touch soon';
  end if;

  if f.kind = 'lead' then
    insert into public.leads (name, company, email, phone, description, source_id, status_id, assigned_to, position, created_by)
    values (v_name, nullif(left(trim(coalesce(p_data->>'company', '')), 160), ''), nullif(v_email, ''),
            nullif(left(trim(coalesce(p_data->>'phone', '')), 40), ''), nullif(left(trim(coalesce(p_data->>'message', '')), 4000), ''),
            f.source_id, coalesce(f.status_id, (select id from public.lead_statuses order by sort_order limit 1)), f.assigned_to,
            extract(epoch from now()), null)
    returning id into new_id;
    insert into public.activity_log (rel_type, rel_id, description, actor_id)
    values ('lead', new_id, 'lead captured from web form “' || f.name || '”', null);
    for r in select f.assigned_to where f.assigned_to is not null
             union select id from public.profiles where is_admin and is_active and f.assigned_to is null loop
      perform private.notify_direct(r, 'New lead from “' || f.name || '”', '/leads/' || new_id, v_name);
    end loop;
  else
    insert into public.estimate_requests (form_id, name, email, phone, company, message, budget, assigned_to)
    values (f.id, v_name, nullif(v_email, ''), nullif(left(trim(coalesce(p_data->>'phone', '')), 40), ''),
            nullif(left(trim(coalesce(p_data->>'company', '')), 160), ''), nullif(left(trim(coalesce(p_data->>'message', '')), 4000), ''),
            nullif(left(trim(coalesce(p_data->>'budget', '')), 60), ''), f.assigned_to)
    returning id into new_id;
    for r in select f.assigned_to where f.assigned_to is not null
             union select id from public.profiles where is_admin and is_active and f.assigned_to is null loop
      perform private.notify_direct(r, 'New estimate request from ' || v_name, '/estimate-requests/' || new_id, f.name);
    end loop;
  end if;
  update public.web_forms set submissions = submissions + 1 where id = f.id;
  return f.success_message;
end;
$$;

-- ───────────────────────── Newsfeed ─────────────────────────
create table public.posts (
  id          bigint generated always as identity primary key,
  body        text not null check (length(body) between 1 and 4000),
  pinned      boolean not null default false,
  created_by  uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now()
);
create index posts_created_idx on public.posts(pinned desc, created_at desc);
create index posts_created_by_idx on public.posts(created_by);
create table public.post_likes (
  post_id   bigint not null references public.posts(id) on delete cascade,
  staff_id  uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  primary key (post_id, staff_id)
);
create index post_likes_staff_idx on public.post_likes(staff_id);
create table public.post_comments (
  id          bigint generated always as identity primary key,
  post_id     bigint not null references public.posts(id) on delete cascade,
  body        text not null check (length(body) between 1 and 2000),
  created_by  uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now()
);
create index post_comments_post_idx on public.post_comments(post_id, created_at);
create index post_comments_created_by_idx on public.post_comments(created_by);

create or replace function private.on_post_comment() returns trigger
language plpgsql security definer set search_path = '' as $$
declare p public.posts;
begin
  select * into p from public.posts where id = new.post_id;
  perform private.notify(p.created_by, private.actor_name() || ' commented on your post', '/newsfeed#post-' || p.id, left(new.body, 140));
  return new;
end;
$$;
create trigger post_comment_notify after insert on public.post_comments for each row execute function private.on_post_comment();

-- ───────────────────────── Surveys ─────────────────────────
create table public.surveys (
  id           bigint generated always as identity primary key,
  key          uuid not null unique default gen_random_uuid(),
  title        text not null,
  description  text,
  thank_you    text not null default 'Thanks for your feedback!',
  is_active    boolean not null default true,
  created_by   uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now()
);
create index surveys_created_by_idx on public.surveys(created_by);
create table public.survey_questions (
  id         bigint generated always as identity primary key,
  survey_id  bigint not null references public.surveys(id) on delete cascade,
  label      text not null,
  type       text not null default 'short' check (type in ('short','long','single','multiple','rating')),
  options    text[] not null default '{}',
  required   boolean not null default false,
  position   int not null default 0
);
create index survey_questions_survey_idx on public.survey_questions(survey_id, position);
create table public.survey_responses (
  id          bigint generated always as identity primary key,
  survey_id   bigint not null references public.surveys(id) on delete cascade,
  name        text,
  email       text,
  created_at  timestamptz not null default now()
);
create index survey_responses_survey_idx on public.survey_responses(survey_id, created_at desc);
create table public.survey_answers (
  response_id  bigint not null references public.survey_responses(id) on delete cascade,
  question_id  bigint not null references public.survey_questions(id) on delete cascade,
  value        text not null,
  primary key (response_id, question_id, value)
);
create index survey_answers_question_idx on public.survey_answers(question_id);

create or replace function public.survey_info(p_key uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('title', s.title, 'description', s.description, 'company', (select company_name from public.company_settings limit 1),
    'questions', coalesce((select jsonb_agg(jsonb_build_object('id', q.id, 'label', q.label, 'type', q.type, 'options', to_jsonb(q.options), 'required', q.required) order by q.position, q.id)
                           from public.survey_questions q where q.survey_id = s.id), '[]'::jsonb))
  from public.surveys s where s.key = p_key and s.is_active;
$$;

-- p_answers: {"<question id>": "text" | ["option", ...] | "4"}
create or replace function public.submit_survey(p_key uuid, p_name text, p_email text, p_answers jsonb) returns text
language plpgsql security definer set search_path = '' as $$
declare s public.surveys; q public.survey_questions; rid bigint; a jsonb; v text;
begin
  select * into s from public.surveys where key = p_key and is_active;
  if s.id is null then raise exception 'This survey is closed'; end if;
  for q in select * from public.survey_questions where survey_id = s.id loop
    a := p_answers -> q.id::text;
    if q.required and (a is null or a = '""'::jsonb or a = '[]'::jsonb or a = 'null'::jsonb) then raise exception 'Please answer “%”', q.label; end if;
  end loop;
  insert into public.survey_responses (survey_id, name, email)
  values (s.id, nullif(left(trim(coalesce(p_name, '')), 120), ''), nullif(lower(left(trim(coalesce(p_email, '')), 160)), ''))
  returning id into rid;
  for q in select * from public.survey_questions where survey_id = s.id loop
    a := p_answers -> q.id::text;
    continue when a is null or a = 'null'::jsonb;
    if jsonb_typeof(a) = 'array' then
      for v in select jsonb_array_elements_text(a) loop
        if q.type in ('single','multiple') and not (v = any(q.options)) then continue; end if;
        insert into public.survey_answers values (rid, q.id, left(v, 500)) on conflict do nothing;
      end loop;
    else
      v := left(trim(a #>> '{}'), 4000);
      if v = '' then continue; end if;
      if q.type = 'rating' and v !~ '^[1-5]$' then raise exception 'Ratings are 1 to 5'; end if;
      if q.type in ('single','multiple') and not (v = any(q.options)) then continue; end if;
      insert into public.survey_answers values (rid, q.id, v) on conflict do nothing;
    end if;
  end loop;
  return s.thank_you;
end;
$$;

-- ───────────────────────── GDPR ─────────────────────────
alter table public.contacts
  add column marketing_consent  boolean not null default false,
  add column consent_updated_at timestamptz;

create table public.gdpr_requests (
  id           bigint generated always as identity primary key,
  customer_id  bigint references public.customers(id) on delete cascade,
  contact_id   bigint references public.contacts(id) on delete set null,
  kind         text not null check (kind in ('export','erasure')),
  note         text,
  status       text not null default 'open' check (status in ('open','completed','rejected')),
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz,
  resolved_by  uuid references public.profiles(id) on delete set null
);
create index gdpr_requests_customer_idx on public.gdpr_requests(customer_id);
create index gdpr_requests_contact_idx on public.gdpr_requests(contact_id);
create index gdpr_requests_resolved_by_idx on public.gdpr_requests(resolved_by);

create or replace function public.portal_set_consent(p_consent boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare pu public.portal_users;
begin
  select * into pu from public.portal_users where user_id = auth.uid();
  if pu.contact_id is null then raise exception 'Not a portal user'; end if;
  update public.contacts set marketing_consent = p_consent, consent_updated_at = now() where id = pu.contact_id;
  insert into public.activity_log (rel_type, rel_id, description, actor_id)
  values ('customer', pu.customer_id, private.actor_name() || case when p_consent then ' opted in to' else ' opted out of' end || ' marketing e-mails', null);
end;
$$;

create or replace function public.portal_gdpr_request(p_kind text, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
declare pu public.portal_users; r uuid;
begin
  select * into pu from public.portal_users where user_id = auth.uid();
  if pu.user_id is null then raise exception 'Not a portal user'; end if;
  if p_kind not in ('export','erasure') then raise exception 'Unknown request'; end if;
  if exists (select 1 from public.gdpr_requests where contact_id = pu.contact_id and kind = p_kind and status = 'open') then
    raise exception 'You already have an open request of this kind';
  end if;
  insert into public.gdpr_requests (customer_id, contact_id, kind, note) values (pu.customer_id, pu.contact_id, p_kind, left(p_note, 1000));
  for r in select id from public.profiles where is_admin and is_active loop
    perform private.notify(r, private.actor_name() || ' asked for data ' || case p_kind when 'export' then 'export' else 'erasure' end, '/settings/gdpr', p_note);
  end loop;
end;
$$;

-- ───────────────────────── Grants & RLS ─────────────────────────
revoke execute on function public.web_form_info(uuid) from public;
revoke execute on function public.submit_web_form(uuid, jsonb) from public;
revoke execute on function public.survey_info(uuid) from public;
revoke execute on function public.submit_survey(uuid, text, text, jsonb) from public;
grant execute on function public.web_form_info(uuid) to anon, authenticated;
grant execute on function public.submit_web_form(uuid, jsonb) to anon, authenticated;
grant execute on function public.survey_info(uuid) to anon, authenticated;
grant execute on function public.submit_survey(uuid, text, text, jsonb) to anon, authenticated;
revoke execute on function public.portal_set_consent(boolean) from public, anon;
revoke execute on function public.portal_gdpr_request(text, text) from public, anon;
grant execute on function public.portal_set_consent(boolean) to authenticated;
grant execute on function public.portal_gdpr_request(text, text) to authenticated;

alter table public.custom_fields        enable row level security;
alter table public.custom_field_values  enable row level security;
alter table public.email_templates      enable row level security;
alter table public.currencies           enable row level security;
alter table public.media_files          enable row level security;
alter table public.web_forms            enable row level security;
alter table public.estimate_requests    enable row level security;
alter table public.posts                enable row level security;
alter table public.post_likes           enable row level security;
alter table public.post_comments        enable row level security;
alter table public.surveys              enable row level security;
alter table public.survey_questions     enable row level security;
alter table public.survey_responses     enable row level security;
alter table public.survey_answers       enable row level security;
alter table public.gdpr_requests        enable row level security;

do $$
declare t text;
begin
  -- Settings-like tables: staff read, admins write
  foreach t in array array['custom_fields','email_templates','currencies','web_forms'] loop
    execute format('create policy %1$s_read on public.%1$I for select to authenticated using ((select private.is_staff()))', t);
    execute format('create policy %1$s_insert on public.%1$I for insert to authenticated with check ((select private.is_admin()))', t);
    execute format('create policy %1$s_update on public.%1$I for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()))', t);
    execute format('create policy %1$s_delete on public.%1$I for delete to authenticated using ((select private.is_admin()))', t);
  end loop;
  -- Working data: any active staff member
  foreach t in array array['custom_field_values','media_files','estimate_requests','posts','post_likes','post_comments','surveys','survey_questions','survey_responses','survey_answers','gdpr_requests'] loop
    execute format('create policy %1$s_staff on public.%1$I for all to authenticated using ((select private.is_staff())) with check ((select private.is_staff()))', t);
  end loop;
end $$;

-- Clients see PDF-visible custom fields on their own documents, their own GDPR requests and currencies
create policy custom_fields_portal on public.custom_fields for select to authenticated
  using (show_on_pdf and entity = 'sales_doc' and (select private.portal_customer()) is not null);
create policy custom_field_values_portal on public.custom_field_values for select to authenticated
  using (field_id in (select id from public.custom_fields where show_on_pdf and entity = 'sales_doc')
         and rel_id in (select id from public.sales_docs where customer_id = (select private.portal_customer()) and status <> 'draft'));
create policy gdpr_requests_portal on public.gdpr_requests for select to authenticated
  using (customer_id = (select private.portal_customer()));
create policy currencies_portal on public.currencies for select to authenticated
  using ((select private.portal_customer()) is not null);

-- Admins remove a portal login when a contact is anonymised
create policy portal_users_admin_delete on public.portal_users for delete to authenticated using ((select private.is_admin()));
