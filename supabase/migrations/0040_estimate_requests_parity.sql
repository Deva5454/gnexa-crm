-- Gnexa CRM — Estimate requests parity with Perfex (batch 26)
--
--   • A request can be turned into an estimate: it then points at the customer it was quoted for
--   • Whoever a request is assigned to gets a notification (bell), like Perfex's "assigned to you"
--   • E-mail templates for replying to the requester and telling them their request's status changed

alter table public.estimate_requests add column if not exists customer_id bigint references public.customers(id) on delete set null;
create index if not exists estimate_requests_customer_idx on public.estimate_requests(customer_id);

-- Notify the new assignee (not when you assign it to yourself; private.notify skips that)
create or replace function private.estimate_request_assigned() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.assigned_to is not null and new.assigned_to is distinct from old.assigned_to then
    perform private.notify(new.assigned_to,
      'Estimate request from ' || new.name || coalesce(' (' || new.company || ')', '') || ' assigned to you',
      '/estimate-requests/' || new.id,
      left(new.message, 140));
  end if;
  return new;
end;
$$;
revoke execute on function private.estimate_request_assigned() from public, anon, authenticated;
drop trigger if exists estimate_requests_assigned on public.estimate_requests;
create trigger estimate_requests_assigned after update of assigned_to on public.estimate_requests
  for each row execute function private.estimate_request_assigned();

insert into public.email_templates (key, name, description, subject, body) values
  ('estimate_request_reply', 'Estimate request reply', 'Replying to someone who asked for a quote', 'Re: your quote request',
   E'Hi {name},\n\nThank you for asking {company_name} for a quote. We are looking at your request and will send you an estimate shortly.\n\nIf there is anything else we should know, just reply to this e-mail.\n\nRegards,\n{staff_name}\n{company_name}'),
  ('estimate_request_status', 'Estimate request status changed', 'Telling the requester their request moved to a new status', 'Your quote request: {status}',
   E'Hi {name},\n\nAn update on the quote you requested from {company_name}: it is now “{status}”.\n\nRegards,\n{staff_name}\n{company_name}')
on conflict (key) do nothing;
