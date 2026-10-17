-- Gnexa CRM — Contracts parity with Perfex (batch 18)
--
--   • A contract can belong to a project, and can be hidden from the customer's portal
--   • Renew in place (Perfex "Renew contract"): new dates and value, optional fresh signature, with a renewal history
--   • Discussion with the customer (staff and portal comments)
--   • Contract templates (Setup → Contracts) to start the terms from
--   • Attachments (staff only, "contract-files" bucket) and notes on contracts
--   • E-mail a contract, and an automatic expiry reminder N days before a signed contract ends
--     (to the customer, logged in the e-mail log, and a bell notification for whoever created it)

alter table public.contracts add column if not exists project_id bigint references public.projects(id) on delete set null;
create index if not exists contracts_project_idx on public.contracts(project_id);
alter table public.contracts add column if not exists visible_to_client boolean not null default true;
alter table public.contracts add column if not exists expiry_reminded_at timestamptz;

drop policy if exists contracts_portal on public.contracts;
create policy contracts_portal on public.contracts for select to authenticated
  using (customer_id = (select private.portal_customer()) and status <> 'draft' and visible_to_client);

-- ───────────────────────── Renewals ─────────────────────────
create table if not exists public.contract_renewals (
  id           bigint generated always as identity primary key,
  contract_id  bigint not null references public.contracts(id) on delete cascade,
  old_start    date not null,
  old_end      date,
  old_value    numeric(14,2),
  new_start    date not null,
  new_end      date,
  new_value    numeric(14,2),
  renewed_by   uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now()
);
create index if not exists contract_renewals_contract_idx on public.contract_renewals(contract_id, created_at desc);
create index if not exists contract_renewals_renewed_by_idx on public.contract_renewals(renewed_by);
alter table public.contract_renewals enable row level security;
drop policy if exists contract_renewals_read on public.contract_renewals;
create policy contract_renewals_read on public.contract_renewals for select to authenticated using ((select private.has_perm('contracts', 'view')));

create or replace function public.renew_contract(p_contract bigint, p_start date, p_end date, p_value numeric, p_keep_signature boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare c public.contracts;
begin
  if not private.has_perm('contracts', 'edit') then raise exception 'You need edit access to Contracts to renew them'; end if;
  select * into c from public.contracts where id = p_contract for update;
  if c.id is null then raise exception 'Contract not found'; end if;
  if c.status = 'cancelled' then raise exception 'A cancelled contract cannot be renewed'; end if;
  if p_start is null then raise exception 'Choose the new start date'; end if;
  if p_end is not null and p_end < p_start then raise exception 'The end date can''t be before the start date'; end if;
  if p_value is not null and p_value < 0 then raise exception 'The value can''t be negative'; end if;
  -- Lets the signed-contract guard accept new dates and value (only those) for this renewal
  perform set_config('gnexa.renewing', 'on', true);
  insert into public.contract_renewals (contract_id, old_start, old_end, old_value, new_start, new_end, new_value)
  values (c.id, c.start_date, c.end_date, c.value, p_start, p_end, p_value);
  update public.contracts
     set start_date = p_start, end_date = p_end, value = p_value, expiry_reminded_at = null,
         status = case when p_keep_signature or c.status <> 'signed' then c.status else 'sent' end,
         signed_by = case when p_keep_signature then c.signed_by end,
         signed_at = case when p_keep_signature then c.signed_at end
   where id = c.id;
  perform set_config('gnexa.renewing', 'off', true);
  insert into public.activity_log (rel_type, rel_id, description, actor_id)
  values ('customer', c.customer_id, 'renewed contract CT-' || lpad(c.id::text, 5, '0') || ' until ' || coalesce(to_char(p_end, 'DD Mon YYYY'), 'further notice'), auth.uid());
end;
$$;
revoke execute on function public.renew_contract(bigint, date, date, numeric, boolean) from public, anon;
grant execute on function public.renew_contract(bigint, date, date, numeric, boolean) to authenticated;

-- A signed contract's terms stay frozen; a renewal may move its dates and value
create or replace function private.guard_signed_contract() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.status = 'signed' and new.status = 'signed' and not private.seeding() then
    if coalesce(current_setting('gnexa.renewing', true), '') = 'on' then
      if (new.customer_id, new.subject, new.content, new.type_id) is distinct from (old.customer_id, old.subject, old.content, old.type_id) then
        raise exception 'A renewal can only change the dates and value.';
      end if;
    elsif (new.customer_id, new.subject, new.value, new.start_date, new.end_date, new.content, new.type_id)
          is distinct from (old.customer_id, old.subject, old.value, old.start_date, old.end_date, old.content, old.type_id) then
      raise exception 'This contract is signed — reopen it as a draft (which clears the signature) before changing its terms.';
    end if;
  end if;
  return new;
end;
$$;

-- ───────────────────────── Discussion with the customer ─────────────────────────
create table if not exists public.contract_comments (
  id             bigint generated always as identity primary key,
  contract_id    bigint not null references public.contracts(id) on delete cascade,
  body           text not null check (length(trim(body)) between 1 and 4000),
  staff_id       uuid references public.profiles(id) on delete set null,
  author_name    text,
  from_customer  boolean not null default false,
  created_at     timestamptz not null default now()
);
create index if not exists contract_comments_contract_idx on public.contract_comments(contract_id, created_at);
create index if not exists contract_comments_staff_idx on public.contract_comments(staff_id);
alter table public.contract_comments enable row level security;
drop policy if exists contract_comments_staff_read on public.contract_comments;
drop policy if exists contract_comments_staff_insert on public.contract_comments;
drop policy if exists contract_comments_staff_delete on public.contract_comments;
drop policy if exists contract_comments_portal_read on public.contract_comments;
create policy contract_comments_staff_read on public.contract_comments for select to authenticated
  using ((select private.has_perm('contracts', 'view')));
create policy contract_comments_staff_insert on public.contract_comments for insert to authenticated
  with check ((select private.has_perm('contracts', 'edit')) and staff_id = (select auth.uid()) and not from_customer);
create policy contract_comments_staff_delete on public.contract_comments for delete to authenticated
  using ((select private.has_perm('contracts', 'full')) or (staff_id = (select auth.uid()) and (select private.has_perm('contracts', 'edit'))));
create policy contract_comments_portal_read on public.contract_comments for select to authenticated
  using (contract_id in (select id from public.contracts where customer_id = (select private.portal_customer()) and status <> 'draft' and visible_to_client));

create or replace function public.portal_contract_comment(p_contract bigint, p_body text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  pu public.portal_users;
  c public.contracts;
  who text;
begin
  select * into pu from public.portal_users where user_id = auth.uid();
  select * into c from public.contracts where id = p_contract;
  if pu.user_id is null or c.id is null or c.customer_id <> pu.customer_id or c.status = 'draft' or not c.visible_to_client then
    raise exception 'Not found';
  end if;
  if coalesce(trim(p_body), '') = '' then raise exception 'Write a comment first'; end if;
  select coalesce(nullif(trim(first_name || ' ' || coalesce(last_name, '')), ''), 'Customer') into who from public.contacts where id = pu.contact_id;
  insert into public.contract_comments (contract_id, body, author_name, from_customer) values (c.id, left(trim(p_body), 4000), coalesce(who, 'Customer'), true);
  if c.created_by is not null and exists (select 1 from public.profiles where id = c.created_by and is_active) then
    insert into public.notifications (user_id, title, link, body)
    values (c.created_by, coalesce(who, 'Customer') || ' commented on contract CT-' || lpad(c.id::text, 5, '0'), '/contracts/' || c.id, left(trim(p_body), 140));
  end if;
end;
$$;
revoke execute on function public.portal_contract_comment(bigint, text) from public, anon;
grant execute on function public.portal_contract_comment(bigint, text) to authenticated;

-- ───────────────────────── Templates ─────────────────────────
create table if not exists public.contract_templates (
  id          bigint generated always as identity primary key,
  name        text not null unique check (length(trim(name)) between 1 and 120),
  content     text not null default '',
  created_at  timestamptz not null default now()
);
alter table public.contract_templates enable row level security;
drop policy if exists contract_templates_read on public.contract_templates;
drop policy if exists contract_templates_write on public.contract_templates;
create policy contract_templates_read on public.contract_templates for select to authenticated using ((select private.is_staff()));
create policy contract_templates_write on public.contract_templates for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

insert into public.contract_templates (name, content) values
  ('Annual maintenance (AMC)', E'1. Scope\nThe Provider will maintain and support the software described in Schedule A, including bug fixes, minor updates and help-desk support on working days (10:00–18:00 IST).\n\n2. Service levels\nCritical issues: response within 4 working hours. Other issues: within 2 working days.\n\n3. Term\nThis agreement runs from the start date to the end date and may be renewed by mutual agreement.\n\n4. Fees\nThe annual fee is payable in advance within 15 days of invoice. GST is charged as applicable.\n\n5. Exclusions\nNew features, data migration and on-site visits are quoted separately.\n\n6. Termination\nEither party may terminate with 30 days'' written notice. Fees already paid are not refundable.'),
  ('Non-disclosure agreement (NDA)', E'1. Confidential information\nAny business, technical or financial information shared by either party, in any form, that is marked or reasonably understood to be confidential.\n\n2. Obligations\nEach party will use the other''s confidential information only for the purpose of evaluating or carrying out their business relationship, and will not disclose it to anyone except employees and advisers who need to know.\n\n3. Exclusions\nInformation that is public, already known, independently developed or required to be disclosed by law.\n\n4. Term\nThese obligations last for 3 years from the date of disclosure.\n\n5. Governing law\nThis agreement is governed by the laws of India.'),
  ('Statement of work (SOW)', E'1. Project\nThe Provider will deliver the project described below.\n\n2. Deliverables\n• \n• \n• \n\n3. Timeline\nKick-off: \nCompletion: \n\n4. Acceptance\nThe Customer will review each deliverable within 5 working days and either accept it or list required changes.\n\n5. Fees and payment\n40% on signing, 40% on delivery, 20% on acceptance. GST is charged as applicable.\n\n6. Change requests\nChanges to scope are agreed in writing and may change the fees and timeline.')
on conflict (name) do nothing;

-- ───────────────────────── Attachments (staff only) ─────────────────────────
create table if not exists public.contract_files (
  id           bigint generated always as identity primary key,
  contract_id  bigint not null references public.contracts(id) on delete cascade,
  name         text not null,
  path         text not null unique,
  size         bigint not null default 0,
  mime         text,
  uploaded_by  uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now()
);
create index if not exists contract_files_contract_idx on public.contract_files(contract_id);
create index if not exists contract_files_uploaded_by_idx on public.contract_files(uploaded_by);
alter table public.contract_files enable row level security;
drop policy if exists contract_files_staff_read on public.contract_files;
drop policy if exists contract_files_staff_insert on public.contract_files;
drop policy if exists contract_files_staff_delete on public.contract_files;
create policy contract_files_staff_read on public.contract_files for select to authenticated
  using ((select private.has_perm('contracts', 'view')));
create policy contract_files_staff_insert on public.contract_files for insert to authenticated
  with check ((select private.has_perm('contracts', 'edit')) and uploaded_by = (select auth.uid()));
create policy contract_files_staff_delete on public.contract_files for delete to authenticated
  using ((select private.has_perm('contracts', 'full')) or (uploaded_by = (select auth.uid()) and (select private.has_perm('contracts', 'edit'))));

insert into storage.buckets (id, name, public, file_size_limit)
values ('contract-files', 'contract-files', false, 10485760)
on conflict (id) do nothing;

drop policy if exists contract_files_obj_read on storage.objects;
drop policy if exists contract_files_obj_write on storage.objects;
drop policy if exists contract_files_obj_remove on storage.objects;
create policy contract_files_obj_read on storage.objects for select to authenticated
  using (bucket_id = 'contract-files' and (select private.has_perm('contracts', 'view')));
create policy contract_files_obj_write on storage.objects for insert to authenticated
  with check (bucket_id = 'contract-files' and (select private.has_perm('contracts', 'edit')));
create policy contract_files_obj_remove on storage.objects for delete to authenticated
  using (bucket_id = 'contract-files' and ((select private.has_perm('contracts', 'full')) or (owner_id = (select auth.uid())::text and (select private.has_perm('contracts', 'edit')))));

-- Notes on contracts
alter table public.notes drop constraint if exists notes_rel_type_check;
alter table public.notes add constraint notes_rel_type_check check (rel_type in ('customer', 'lead', 'project', 'contract'));

-- ───────────────────────── E-mail and expiry reminders ─────────────────────────
alter table public.email_log drop constraint if exists email_log_kind_check;
alter table public.email_log add constraint email_log_kind_check
  check (kind in ('document','overdue_reminder','expiry_reminder','contract_expiry','statement','receipt','subscription','manual'));

insert into public.email_templates (key, name, description, subject, body) values
  ('contract_send', 'Contract', 'Sending a contract to the customer', 'Contract {contract_number}: {subject}',
   E'Hi {contact_name},\n\nPlease find our contract {contract_number} “{subject}” attached. You can read and sign it online from your client portal.\n\nTerm: {start_date} to {end_date}\nValue: {value}\n\nRegards,\n{company_name}'),
  ('contract_expiry', 'Contract expiry reminder', 'A few days before a signed contract ends (automatic, or from the contract)', 'Your contract {contract_number} ends on {end_date}',
   E'Hi {contact_name},\n\nJust a reminder that contract {contract_number} “{subject}” ends on {end_date}. Reply to this e-mail if you would like to renew it.\n\nRegards,\n{company_name}')
on conflict (key) do nothing;

-- Days before the end date to remind; null turns it off
alter table public.company_settings add column if not exists contract_expiry_days int default 7
  check (contract_expiry_days is null or contract_expiry_days between 1 and 90);

create or replace function private.run_contract_expiry_reminders() returns int
language plpgsql security definer set search_path = '' as $$
declare
  cs public.company_settings;
  t public.email_templates;
  d record;
  c public.contacts;
  vars jsonb;
  subj text;
  body text;
  k text;
  n int := 0;
begin
  select * into cs from public.company_settings limit 1;
  if cs.contract_expiry_days is null then return 0; end if;
  select * into t from public.email_templates where key = 'contract_expiry';
  for d in
    select x.*, cu.company as customer_name from public.contracts x join public.customers cu on cu.id = x.customer_id
    where x.status = 'signed' and x.expiry_reminded_at is null
      and x.end_date between current_date and current_date + cs.contract_expiry_days
    for update of x
  loop
    select * into c from public.contacts where customer_id = d.customer_id order by is_primary desc, id limit 1;
    vars := jsonb_build_object(
      'contract_number', 'CT-' || lpad(d.id::text, 5, '0'), 'subject', d.subject, 'end_date', to_char(d.end_date, 'DD Mon YYYY'),
      'start_date', to_char(d.start_date, 'DD Mon YYYY'), 'value', coalesce(private.money(d.value, cs.currency), '—'),
      'customer', d.customer_name, 'company_name', coalesce(cs.company_name, ''), 'contact_name', coalesce(nullif(c.first_name, ''), 'there'));
    subj := coalesce(t.subject, 'Your contract {contract_number} ends on {end_date}');
    body := coalesce(t.body, 'Contract {contract_number} ends on {end_date}.');
    for k in select jsonb_object_keys(vars) loop
      subj := replace(subj, '{' || k || '}', vars ->> k);
      body := replace(body, '{' || k || '}', vars ->> k);
    end loop;
    if d.visible_to_client then
      perform private.log_email(d.customer_id, subj, body, 'contract_expiry', 'contract', d.id, true);
    end if;
    if d.created_by is not null and exists (select 1 from public.profiles where id = d.created_by and is_active) then
      insert into public.notifications (user_id, title, link, body)
      values (d.created_by, 'Contract CT-' || lpad(d.id::text, 5, '0') || ' ends on ' || to_char(d.end_date, 'DD Mon YYYY'), '/contracts/' || d.id, d.subject);
    end if;
    update public.contracts set expiry_reminded_at = now() where id = d.id;
    n := n + 1;
  end loop;
  return n;
end;
$$;
alter function private.run_contract_expiry_reminders() set timezone = 'Asia/Kolkata';
revoke execute on function private.run_contract_expiry_reminders() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    -- 09:10 India time every day
    perform cron.schedule('gnexa-contract-expiry', '40 3 * * *', 'select private.run_contract_expiry_reminders()');
  else
    raise notice 'pg_cron is not available here — contract expiry reminders will not be sent automatically.';
  end if;
end $$;

-- A contract hidden from the customer can't be signed from the portal either
create or replace function public.portal_sign_contract(p_contract bigint, p_name text) returns void
language plpgsql security definer set search_path = '' as $$
declare c public.contracts;
begin
  select * into c from public.contracts where id = p_contract for update;
  if c.id is null or c.customer_id is distinct from private.portal_customer() or not c.visible_to_client then raise exception 'Not found'; end if;
  if c.status <> 'sent' then raise exception 'This contract is not awaiting signature'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'Type your full name to sign'; end if;
  update public.contracts set status = 'signed', signed_by = trim(p_name), signed_at = now() where id = p_contract;
  insert into public.activity_log (rel_type, rel_id, description, actor_id)
  values ('customer', c.customer_id, trim(p_name) || ' signed contract “' || c.subject || '” in the portal', null);
end;
$$;
