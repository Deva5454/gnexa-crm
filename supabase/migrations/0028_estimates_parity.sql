-- Gnexa CRM — Estimates parity with Perfex (batch 13)
--
--   • Signed acceptance: a customer accepting an estimate or proposal in the portal types their name; the
--     document records who accepted (or declined) and when
--   • Expiry reminders: a daily job e-mails the customer a few days before a sent estimate or proposal
--     expires (once per document; Setup → Finance turns it off or changes the number of days)

-- ───────────────────────── Acceptance ─────────────────────────
alter table public.sales_docs add column if not exists responded_by text;
alter table public.sales_docs add column if not exists responded_at timestamptz;

drop function if exists public.portal_respond(bigint, boolean);
create or replace function public.portal_respond(p_doc bigint, p_accept boolean, p_name text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  d public.sales_docs;
  who text := nullif(left(trim(coalesce(p_name, '')), 120), '');
begin
  select * into d from public.sales_docs where id = p_doc for update;
  if d.id is null or d.customer_id is distinct from private.portal_customer() then raise exception 'Not found'; end if;
  if d.kind not in ('estimate','proposal') then raise exception 'Only estimates and proposals can be accepted or declined'; end if;
  if d.status <> 'sent' then raise exception 'This document is no longer awaiting a response'; end if;
  if p_accept and who is null then raise exception 'Type your full name to accept'; end if;
  if p_accept and d.due_date is not null and d.due_date < current_date then
    raise exception 'This % has expired — please ask us for an updated one', d.kind::text;
  end if;
  update public.sales_docs
     set status = case when p_accept then 'accepted' else 'declined' end, responded_by = who, responded_at = now()
   where id = p_doc;
  insert into public.activity_log (rel_type, rel_id, description, actor_id)
  values ('customer', d.customer_id,
          coalesce(who, 'client') || case when p_accept then ' accepted ' else ' declined ' end || d.kind::text || ' #' || d.number || ' in the portal', null);
end;
$$;
alter function public.portal_respond(bigint, boolean, text) set timezone = 'Asia/Kolkata';
revoke execute on function public.portal_respond(bigint, boolean, text) from public, anon;
grant execute on function public.portal_respond(bigint, boolean, text) to authenticated;

-- ───────────────────────── Expiry reminders ─────────────────────────
alter table public.company_settings add column if not exists auto_expiry_reminders boolean not null default true;
alter table public.company_settings add column if not exists expiry_reminder_days int not null default 3;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'company_settings_expiry_reminder_days_check') then
    alter table public.company_settings add constraint company_settings_expiry_reminder_days_check check (expiry_reminder_days between 1 and 30);
  end if;
end $$;

alter table public.email_log drop constraint if exists email_log_kind_check;
alter table public.email_log add constraint email_log_kind_check
  check (kind in ('document','overdue_reminder','expiry_reminder','statement','receipt','subscription','manual'));

insert into public.email_templates (key, name, description, subject, body) values
  ('expiry_reminder', 'Estimate / proposal expiry reminder', 'A few days before a sent estimate or proposal expires (automatic, or from the document)',
   'Reminder: {doc_number} expires on {due_date}',
   E'Hi {contact_name},\n\nJust a reminder that {doc_number} for {total} is valid until {due_date}. You can review and accept it online from your client portal.\n\nIf you have any questions, simply reply to this e-mail.\n\nRegards,\n{company_name}')
on conflict (key) do nothing;

create or replace function private.run_expiry_reminders() returns int
language plpgsql security definer set search_path = '' as $$
declare
  cs public.company_settings;
  t public.email_templates;
  d record;
  c public.contacts;
  label text;
  vars jsonb;
  subj text;
  body text;
  k text;
  n int := 0;
begin
  select * into cs from public.company_settings limit 1;
  if not coalesce(cs.auto_expiry_reminders, true) then return 0; end if;
  select * into t from public.email_templates where key = 'expiry_reminder';
  for d in
    select s.*, cu.company as customer_name from public.sales_docs s join public.customers cu on cu.id = s.customer_id
    where s.kind in ('estimate', 'proposal') and s.status = 'sent' and s.last_reminder_at is null
      and s.due_date between current_date and current_date + coalesce(cs.expiry_reminder_days, 3)
    for update of s
  loop
    select * into c from public.contacts where customer_id = d.customer_id order by is_primary desc, id limit 1;
    label := case d.kind when 'estimate' then 'EST-' else 'PRO-' end || lpad(d.number::text, 5, '0');
    vars := jsonb_build_object(
      'doc_number', label, 'due_date', to_char(d.due_date, 'DD Mon YYYY'), 'total', private.money(d.total, d.currency),
      'subject', coalesce(d.subject, ''), 'customer', d.customer_name, 'company_name', coalesce(cs.company_name, ''),
      'contact_name', coalesce(nullif(c.first_name, ''), 'there'));
    subj := coalesce(t.subject, 'Reminder: {doc_number} expires on {due_date}');
    body := coalesce(t.body, 'Just a reminder that {doc_number} is valid until {due_date}.');
    for k in select jsonb_object_keys(vars) loop
      subj := replace(subj, '{' || k || '}', vars ->> k);
      body := replace(body, '{' || k || '}', vars ->> k);
    end loop;
    perform private.log_email(d.customer_id, subj, body, 'expiry_reminder', 'sales_doc', d.id, true);
    update public.sales_docs set last_reminder_at = now() where id = d.id;
    n := n + 1;
  end loop;
  return n;
end;
$$;
alter function private.run_expiry_reminders() set timezone = 'Asia/Kolkata';
revoke execute on function private.run_expiry_reminders() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    -- 09:00 India time every day; the same name again replaces the job, so re-running this file is safe
    perform cron.schedule('gnexa-expiry-reminders', '30 3 * * *', 'select private.run_expiry_reminders()');
  else
    raise notice 'pg_cron is not available here — expiry reminders will not be sent automatically.';
  end if;
end $$;
