-- Gnexa CRM — Subscriptions parity with Perfex (batch 21)
--
--   • A subscription can belong to a project; the invoices it raises carry that project
--   • Cancel at the end of the billing period (staff, or the customer from the portal), with undo:
--     no further invoice is raised and the plan ends on its next billing date
--   • "Last sent" for e-mailing the subscription to the customer, and a template for it

alter table public.subscriptions add column if not exists project_id bigint references public.projects(id) on delete set null;
create index if not exists subscriptions_project_idx on public.subscriptions(project_id);
alter table public.subscriptions add column if not exists cancel_at_period_end boolean not null default false;
-- The plan's own "end after N invoices", kept while a period-end cancellation borrows that field
alter table public.subscriptions add column if not exists ends_after_before_cancel int;
alter table public.subscriptions add column if not exists last_sent_at timestamptz;

-- Invoices raised for a subscription inherit its project
create or replace function private.subscription_doc_project() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.subscription_id is not null and new.project_id is null then
    select project_id into new.project_id from public.subscriptions where id = new.subscription_id;
  end if;
  return new;
end;
$$;
revoke execute on function private.subscription_doc_project() from public, anon, authenticated;
drop trigger if exists sales_docs_subscription_project on public.sales_docs;
create trigger sales_docs_subscription_project before insert on public.sales_docs
  for each row execute function private.subscription_doc_project();

-- A plan that reaches its end because of a period-end cancellation is "cancelled", not "completed"
create or replace function private.subscription_end_state() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'completed' and old.status <> 'completed' and new.cancel_at_period_end then
    new.status := 'cancelled';
    new.cancelled_at := now();
    new.next_billing_date := null;
  end if;
  return new;
end;
$$;
revoke execute on function private.subscription_end_state() from public, anon, authenticated;
drop trigger if exists subscriptions_end_state on public.subscriptions;
create trigger subscriptions_end_state before update on public.subscriptions
  for each row execute function private.subscription_end_state();

/**
 * Cancel at the end of the current period (or undo that). Staff with sales edit can do it for any plan;
 * a client only for their own company's plans. Nothing billed yet → the plan is cancelled straight away.
 */
create or replace function public.subscription_cancel_at_end(p_id bigint, p_undo boolean default false) returns text
language plpgsql security definer set search_path = '' as $$
declare
  s public.subscriptions;
  staff boolean := private.has_perm('sales', 'edit');
  who text;
begin
  select * into s from public.subscriptions where id = p_id for update;
  if s.id is null or not (staff or (private.portal_customer() is not null and s.customer_id = private.portal_customer())) then
    raise exception 'Not found';
  end if;
  who := case when staff then 'staff' else 'client' end;

  if p_undo then
    if not s.cancel_at_period_end or s.status not in ('active', 'paused') then raise exception 'This subscription is not set to end'; end if;
    update public.subscriptions set cancel_at_period_end = false, ends_after_cycles = ends_after_before_cancel, ends_after_before_cancel = null where id = s.id;
    insert into public.activity_log (rel_type, rel_id, description, actor_id)
    values ('customer', s.customer_id, 'subscription “' || s.name || '” will continue (period-end cancellation undone by ' || who || ')', case when staff then auth.uid() end);
    return 'continues';
  end if;

  if s.status not in ('active', 'paused') then raise exception 'This subscription has already ended'; end if;
  if s.cancel_at_period_end then return 'already'; end if;
  if s.cycles_billed = 0 then
    update public.subscriptions set status = 'cancelled', cancelled_at = now(), next_billing_date = null where id = s.id;
    insert into public.activity_log (rel_type, rel_id, description, actor_id)
    values ('customer', s.customer_id, 'subscription “' || s.name || '” cancelled before its first invoice (' || who || ')', case when staff then auth.uid() end);
    return 'cancelled';
  end if;
  update public.subscriptions
     set cancel_at_period_end = true, ends_after_before_cancel = ends_after_cycles, ends_after_cycles = cycles_billed
   where id = s.id;
  insert into public.activity_log (rel_type, rel_id, description, actor_id)
  values ('customer', s.customer_id, 'subscription “' || s.name || '” set to end on ' || coalesce(to_char(s.next_billing_date, 'DD Mon YYYY'), 'its next billing date') || ' (' || who || ')', case when staff then auth.uid() end);
  if not staff and s.created_by is not null and exists (select 1 from public.profiles where id = s.created_by and is_active) then
    insert into public.notifications (user_id, title, link, body)
    values (s.created_by, 'Client cancelled subscription “' || s.name || '” at period end', '/subscriptions/' || s.id, null);
  end if;
  return 'ending';
end;
$$;
revoke execute on function public.subscription_cancel_at_end(bigint, boolean) from public, anon;
grant execute on function public.subscription_cancel_at_end(bigint, boolean) to authenticated;

insert into public.email_templates (key, name, description, subject, body) values
  ('subscription_send', 'Subscription details', 'Sending a subscription''s details to the customer', 'Your subscription: {plan}',
   E'Hi {contact_name},\n\nHere are the details of your subscription with {company_name}:\n\nPlan: {plan}\nPrice: {price} every {interval}\nNext invoice: {next_billing}\n\nYou can see your subscriptions and invoices any time in your client portal.\n\nRegards,\n{company_name}')
on conflict (key) do nothing;
