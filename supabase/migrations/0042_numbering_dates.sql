-- Gnexa CRM — Document numbering and date format (batch 28)
--
--   • Document number prefixes per type (INV, EST, PRO, CN by default) and how many digits the number is
--     padded to — used on screen, in PDFs, e-mails and notifications (private.doc_label)
--   • Date format (company_settings.date_format) gets a fixed list of choices, used across the app

alter table public.company_settings add column if not exists invoice_prefix text not null default 'INV';
alter table public.company_settings add column if not exists estimate_prefix text not null default 'EST';
alter table public.company_settings add column if not exists proposal_prefix text not null default 'PRO';
alter table public.company_settings add column if not exists credit_note_prefix text not null default 'CN';
alter table public.company_settings add column if not exists number_padding int not null default 5;
alter table public.company_settings drop constraint if exists company_settings_prefixes_check;
alter table public.company_settings add constraint company_settings_prefixes_check check (
  invoice_prefix ~ '^[A-Za-z0-9/]{1,10}$' and estimate_prefix ~ '^[A-Za-z0-9/]{1,10}$'
  and proposal_prefix ~ '^[A-Za-z0-9/]{1,10}$' and credit_note_prefix ~ '^[A-Za-z0-9/]{1,10}$');
alter table public.company_settings drop constraint if exists company_settings_number_padding_check;
alter table public.company_settings add constraint company_settings_number_padding_check check (number_padding between 1 and 10);
update public.company_settings set date_format = 'dd MMM yyyy'
 where date_format not in ('dd MMM yyyy', 'dd/MM/yyyy', 'MM/dd/yyyy', 'yyyy-MM-dd', 'dd-MM-yyyy', 'dd.MM.yyyy');
alter table public.company_settings drop constraint if exists company_settings_date_format_check;
alter table public.company_settings add constraint company_settings_date_format_check
  check (date_format in ('dd MMM yyyy', 'dd/MM/yyyy', 'MM/dd/yyyy', 'yyyy-MM-dd', 'dd-MM-yyyy', 'dd.MM.yyyy'));

-- "INV-00012": the prefix for the document type, then the number padded to the set width (never cut short)
create or replace function private.doc_label(p_kind text, p_number int) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce(case p_kind when 'invoice' then s.invoice_prefix when 'estimate' then s.estimate_prefix
                              when 'proposal' then s.proposal_prefix when 'credit_note' then s.credit_note_prefix end,
                  case p_kind when 'invoice' then 'INV' when 'estimate' then 'EST' when 'proposal' then 'PRO' else 'CN' end)
         || '-' || lpad(p_number::text, greatest(coalesce(s.number_padding, 5), length(p_number::text)), '0')
  from (select 1) one left join public.company_settings s on true
  limit 1;
$$;
revoke execute on function private.doc_label(text, int) from public, anon;
grant execute on function private.doc_label(text, int) to authenticated;

create or replace function private.inv_label(n int) returns text
language sql stable set search_path = '' as $$ select private.doc_label('invoice', n) $$;

-- The functions that wrote "EST-…" / "PRO-…" themselves now use doc_label (otherwise unchanged)
create or replace function private.on_doc_response() returns trigger
language plpgsql security definer set search_path = '' as $$
declare label text; slug text; r uuid;
begin
  if private.portal_customer() is null or new.status = old.status or new.status not in ('accepted','declined') then return new; end if;
  label := private.doc_label(new.kind::text, new.number);
  slug := case new.kind when 'proposal' then 'proposals' else 'estimates' end;
  for r in select new.created_by where new.created_by is not null
           union select id from public.profiles where is_admin and is_active and new.created_by is null loop
    perform private.notify(r, private.actor_name() || ' ' || new.status || ' ' || label, '/sales/' || slug || '/' || new.id, new.subject);
  end loop;
  return new;
end;
$$;

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
    label := private.doc_label(d.kind::text, d.number);
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

create or replace function public.public_doc_comment(p_token uuid, p_name text, p_body text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  d public.sales_docs;
  who text := nullif(left(trim(coalesce(p_name, '')), 120), '');
  msg text := trim(coalesce(p_body, ''));
  owner uuid;
begin
  select * into d from public.sales_docs where public_token = p_token and kind in ('proposal', 'estimate');
  if d.id is null or d.status in ('draft', 'cancelled') then raise exception 'Not found'; end if;
  if not d.allow_comments then raise exception 'Comments are turned off for this document'; end if;
  if who is null then raise exception 'Add your name'; end if;
  if length(msg) = 0 then raise exception 'Write a comment first'; end if;
  if length(msg) > 2000 then raise exception 'Comments can be at most 2000 characters'; end if;
  -- a public link is open to anyone who has it: keep a lid on volume
  if (select count(*) from public.sales_doc_comments where doc_id = d.id and from_customer and created_at > now() - interval '10 minutes') >= 5 then
    raise exception 'Too many comments in a short time — please try again in a few minutes';
  end if;
  if (select count(*) from public.sales_doc_comments where doc_id = d.id and from_customer) >= 200 then
    raise exception 'This discussion is full — please reply by e-mail';
  end if;
  insert into public.sales_doc_comments (doc_id, body, staff_id, author_name, from_customer) values (d.id, msg, null, who, true);
  owner := coalesce(d.sale_agent, d.created_by);
  if owner is not null then
    insert into public.notifications (user_id, title, body, link)
    values (owner, who || ' commented on ' || private.doc_label(d.kind::text, d.number), left(msg, 200),
            '/sales/' || case d.kind when 'estimate' then 'estimates' else 'proposals' end || '/' || d.id);
  end if;
end;
$$;

alter function private.run_expiry_reminders() set timezone = 'Asia/Kolkata';

-- What the app needs to print numbers and dates the same way everywhere (public pages included: no secrets here)
create or replace function public.format_settings() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'prefixes', jsonb_build_object('invoice', s.invoice_prefix, 'estimate', s.estimate_prefix, 'proposal', s.proposal_prefix, 'credit_note', s.credit_note_prefix),
    'padding', s.number_padding,
    'date_format', s.date_format)
  from public.company_settings s limit 1;
$$;
revoke execute on function public.format_settings() from public;
grant execute on function public.format_settings() to anon, authenticated;
