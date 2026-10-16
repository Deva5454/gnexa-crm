-- Gnexa CRM — Multi-currency totals (batch 7)
--
-- Each document freezes the exchange rate of its currency when it's raised (or when its currency changes),
-- so totals, reports and goals can add up documents in different currencies in the base currency
-- (a USD 10,000 invoice counts as ₹8,32,000 at 83.2, not ₹10,000). Changing a rate in Setup later
-- doesn't rewrite the value of documents already raised. Payments and credits are in their document's
-- currency, so they convert with the document's rate.

alter table public.sales_docs add column if not exists exchange_rate numeric(14,6) not null default 1 check (exchange_rate > 0);

create or replace function private.set_exchange_rate() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' or new.currency is distinct from old.currency then
    new.exchange_rate := coalesce((select rate from public.currencies where code = new.currency), 1);
  end if;
  return new;
end;
$$;
revoke execute on function private.set_exchange_rate() from public, anon, authenticated;
drop trigger if exists sales_docs_exchange_rate on public.sales_docs;
create trigger sales_docs_exchange_rate before insert or update of currency on public.sales_docs
  for each row execute function private.set_exchange_rate();

-- Existing documents take today's rate once (the guards see no money or status change)
do $$ begin
  perform set_config('gnexa.seeding', 'on', true);
  update public.sales_docs d set exchange_rate = c.rate
  from public.currencies c where c.code = d.currency and d.exchange_rate is distinct from c.rate;
end $$;
