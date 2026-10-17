-- Gnexa CRM — Items parity with Perfex (batch 22)
--
--   • Item groups: organise the catalogue; the item picker on proposals, estimates and invoices groups by them
--   • A fixed price per currency (Perfex "rate in USD/EUR…"): used when a document in that currency picks the
--     item, instead of converting the base rate. Stored as {"USD": 120, "EUR": 110} on the item.

create table if not exists public.item_groups (
  id        bigint generated always as identity primary key,
  name      text not null unique check (length(trim(name)) between 1 and 80),
  position  int not null default 0
);
alter table public.item_groups enable row level security;
drop policy if exists item_groups_read on public.item_groups;
drop policy if exists item_groups_write on public.item_groups;
create policy item_groups_read on public.item_groups for select to authenticated using ((select private.has_perm('sales', 'view')));
create policy item_groups_write on public.item_groups for all to authenticated
  using ((select private.has_perm('sales', 'edit'))) with check ((select private.has_perm('sales', 'edit')));

alter table public.items add column if not exists group_id bigint references public.item_groups(id) on delete set null;
create index if not exists items_group_idx on public.items(group_id);

alter table public.items add column if not exists currency_rates jsonb not null default '{}'::jsonb;
alter table public.items drop constraint if exists items_currency_rates_check;
alter table public.items add constraint items_currency_rates_check
  check (jsonb_typeof(currency_rates) = 'object' and not jsonb_path_exists(currency_rates, '$.* ? (@.type() != "number" || @ < 0)'));

-- Starter groups for the demo catalogue (only when there are none yet)
do $$
begin
  if not exists (select 1 from public.item_groups) then
    insert into public.item_groups (name, position) values ('Software licences', 1), ('Services', 2), ('Support & hosting', 3);
  end if;
end $$;
