-- Gnexa CRM — Proposals parity with Perfex (batch 14)
--
--   • Public link: a proposal or estimate can be shared with a secret link (/p/<token>). Anyone holding the
--     link — a lead without a portal login, or a customer's colleague — can read it, accept it with a typed
--     name, decline it, and comment. Only these functions read through the link; the tables stay private.
--   • View tracking: first and last time the document was opened through the link.
--   • Comments: a discussion thread on the document between staff and the client.
--   • Proposal templates: saved proposal content to insert when writing a new one (Setup → Proposal templates).

alter table public.sales_docs add column if not exists public_token uuid unique;
alter table public.sales_docs add column if not exists allow_comments boolean not null default true;
alter table public.sales_docs add column if not exists first_viewed_at timestamptz;
alter table public.sales_docs add column if not exists last_viewed_at timestamptz;

-- ───────────────────────── Comments ─────────────────────────
create table if not exists public.sales_doc_comments (
  id             bigint generated always as identity primary key,
  doc_id         bigint not null references public.sales_docs(id) on delete cascade,
  body           text not null check (length(trim(body)) between 1 and 2000),
  staff_id       uuid references public.profiles(id) on delete set null default auth.uid(),
  author_name    text check (length(author_name) <= 120),
  from_customer  boolean not null default false,
  created_at     timestamptz not null default now()
);
create index if not exists sales_doc_comments_doc_idx on public.sales_doc_comments(doc_id, created_at);
create index if not exists sales_doc_comments_staff_idx on public.sales_doc_comments(staff_id);
alter table public.sales_doc_comments enable row level security;

drop policy if exists sales_doc_comments_read on public.sales_doc_comments;
drop policy if exists sales_doc_comments_insert on public.sales_doc_comments;
drop policy if exists sales_doc_comments_delete on public.sales_doc_comments;
create policy sales_doc_comments_read on public.sales_doc_comments for select to authenticated
  using ((select private.has_perm('sales', 'view')));
-- staff write as themselves; client comments only arrive through public_doc_comment()
create policy sales_doc_comments_insert on public.sales_doc_comments for insert to authenticated
  with check ((select private.has_perm('sales', 'edit')) and staff_id = (select auth.uid()) and not from_customer);
create policy sales_doc_comments_delete on public.sales_doc_comments for delete to authenticated
  using ((select private.has_perm('sales', 'full')) or (staff_id = (select auth.uid()) and (select private.has_perm('sales', 'edit'))));

-- ───────────────────────── Proposal templates ─────────────────────────
create table if not exists public.proposal_templates (
  id          bigint generated always as identity primary key,
  name        text not null unique check (length(trim(name)) between 1 and 120),
  content     text not null check (length(content) <= 20000),
  created_at  timestamptz not null default now()
);
alter table public.proposal_templates enable row level security;
drop policy if exists proposal_templates_read on public.proposal_templates;
drop policy if exists proposal_templates_write on public.proposal_templates;
create policy proposal_templates_read on public.proposal_templates for select to authenticated using ((select private.is_staff()));
create policy proposal_templates_write on public.proposal_templates for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

insert into public.proposal_templates (name, content) values
  ('Website project', E'## About {customer_name}\n\nThank you for the opportunity to work with **{customer_name}**. This proposal sets out how we will deliver your new website.\n\n## What we will do\n\n- Discovery workshop and sitemap\n- Design of the home page and key templates\n- Build, content entry and testing\n- Launch and two weeks of support\n\n## Timeline\n\n1. Week 1 — discovery\n2. Weeks 2–3 — design\n3. Weeks 4–6 — build and launch\n\nThis proposal is valid until {open_till}.'),
  ('Annual maintenance (AMC)', E'## Annual maintenance for {customer_name}\n\nOur annual maintenance contract keeps your systems healthy all year.\n\n- Quarterly preventive visits\n- Priority support within 4 business hours\n- Spare parts at 10% off list price\n\nTotal for the year: **{total}**. Valid until {open_till}.')
on conflict (name) do nothing;

-- ───────────────────────── Public link functions ─────────────────────────
-- The document, its lines, who it's for, the sender's letterhead and the visible comments — nothing else
create or replace function public.public_doc(p_token uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  d public.sales_docs;
  party jsonb;
  c public.customers;
  p public.contacts;
  l public.leads;
begin
  select * into d from public.sales_docs where public_token = p_token and kind in ('proposal', 'estimate') for update;
  if d.id is null or d.status in ('draft', 'cancelled') then return null; end if;

  if d.first_viewed_at is null then
    insert into public.activity_log (rel_type, rel_id, description, actor_id)
    select case when d.customer_id is not null then 'customer' else 'lead' end, coalesce(d.customer_id, d.lead_id),
           'client opened ' || d.kind::text || ' #' || d.number || ' (public link)', null
    where coalesce(d.customer_id, d.lead_id) is not null;
  end if;
  update public.sales_docs set first_viewed_at = coalesce(first_viewed_at, now()), last_viewed_at = now() where id = d.id;

  if d.customer_id is not null then
    select * into c from public.customers where id = d.customer_id;
    select * into p from public.contacts where customer_id = d.customer_id order by is_primary desc, id limit 1;
    party := jsonb_build_object('name', c.company, 'contact', nullif(trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), ''),
      'lines', to_jsonb(array_remove(array[c.address, nullif(concat_ws(', ', c.city, c.state, c.zip), ''), c.country], null)), 'gstin', c.vat);
  else
    select * into l from public.leads where id = d.lead_id;
    party := jsonb_build_object('name', coalesce(nullif(l.company, ''), l.name), 'contact', case when coalesce(l.company, '') <> '' then l.name end,
      'lines', to_jsonb(array_remove(array[nullif(concat_ws(', ', l.city, l.country), '')], null)), 'gstin', null);
  end if;

  return jsonb_build_object(
    'doc', jsonb_build_object(
      'kind', d.kind, 'number', d.number, 'subject', d.subject, 'content', d.content, 'date', d.date, 'due_date', d.due_date,
      'status', d.status, 'currency', d.currency, 'supply_type', d.supply_type, 'place_of_supply', d.place_of_supply,
      'discount_percent', d.discount_percent, 'adjustment', d.adjustment, 'subtotal', d.subtotal, 'discount_total', d.discount_total,
      'tax_total', d.tax_total, 'total', d.total, 'notes', d.notes, 'terms', d.terms, 'allow_comments', d.allow_comments,
      'responded_by', d.responded_by, 'responded_at', d.responded_at, 'expired', d.due_date is not null and d.due_date < current_date),
    'lines', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'description', i.description, 'long_description', i.long_description,
                        'qty', i.qty, 'unit', i.unit, 'rate', i.rate, 'tax_rate', i.tax_rate, 'hsn_sac', i.hsn_sac) order by i.position)
                      from public.sales_doc_items i where i.doc_id = d.id), '[]'::jsonb),
    'party', party,
    'company', (select jsonb_build_object('company_name', s.company_name, 'address', s.address, 'gstin', s.gstin, 'email', s.email, 'phone', s.phone)
                from public.company_settings s limit 1),
    'comments', coalesce((select jsonb_agg(jsonb_build_object('body', m.body, 'from_customer', m.from_customer, 'created_at', m.created_at,
                            'author', case when m.from_customer then m.author_name else coalesce((select full_name from public.profiles where id = m.staff_id), 'Team') end)
                          order by m.created_at)
                         from public.sales_doc_comments m where m.doc_id = d.id), '[]'::jsonb)
  );
end;
$$;

create or replace function public.public_doc_respond(p_token uuid, p_accept boolean, p_name text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  d public.sales_docs;
  who text := nullif(left(trim(coalesce(p_name, '')), 120), '');
begin
  select * into d from public.sales_docs where public_token = p_token and kind in ('proposal', 'estimate') for update;
  if d.id is null then raise exception 'Not found'; end if;
  if d.status <> 'sent' then raise exception 'This document is no longer awaiting a response'; end if;
  if p_accept and who is null then raise exception 'Type your full name to accept'; end if;
  if p_accept and d.due_date is not null and d.due_date < current_date then
    raise exception 'This % has expired — please ask us for an updated one', d.kind::text;
  end if;
  update public.sales_docs
     set status = case when p_accept then 'accepted' else 'declined' end, responded_by = who, responded_at = now()
   where id = d.id;
  insert into public.activity_log (rel_type, rel_id, description, actor_id)
  select case when d.customer_id is not null then 'customer' else 'lead' end, coalesce(d.customer_id, d.lead_id),
         coalesce(who, 'client') || case when p_accept then ' accepted ' else ' declined ' end || d.kind::text || ' #' || d.number || ' (public link)', null
  where coalesce(d.customer_id, d.lead_id) is not null;
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
    values (owner, who || ' commented on ' || case d.kind when 'estimate' then 'EST-' else 'PRO-' end || lpad(d.number::text, 5, '0'), left(msg, 200),
            '/sales/' || case d.kind when 'estimate' then 'estimates' else 'proposals' end || '/' || d.id);
  end if;
end;
$$;

alter function public.public_doc(uuid) set timezone = 'Asia/Kolkata';
alter function public.public_doc_respond(uuid, boolean, text) set timezone = 'Asia/Kolkata';
revoke execute on function public.public_doc(uuid) from public;
revoke execute on function public.public_doc_respond(uuid, boolean, text) from public;
revoke execute on function public.public_doc_comment(uuid, text, text) from public;
grant execute on function public.public_doc(uuid) to anon, authenticated;
grant execute on function public.public_doc_respond(uuid, boolean, text) to anon, authenticated;
grant execute on function public.public_doc_comment(uuid, text, text) to anon, authenticated;
