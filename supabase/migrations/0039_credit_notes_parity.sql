-- Gnexa CRM — Credit notes parity with Perfex (batch 25)
--
--   • Refunds: pay part or all of a credit note's remaining credit back to the customer (amount, date,
--     payment mode, reference, note). Refunded credit can no longer be applied to invoices.
--   • "Credit remaining" (doc_balances.balance) now = total − applied − refunded; a new `refunded` column
--   • Guards: applying credit and refunding both stay within what's left on the note; a credit note
--     with refunds can't be voided, deleted or reduced below what's been used

create table if not exists public.credit_note_refunds (
  id              bigint generated always as identity primary key,
  credit_note_id  bigint not null references public.sales_docs(id) on delete cascade,
  amount          numeric(14,2) not null check (amount > 0),
  date            date not null default current_date,
  mode_id         bigint references public.payment_modes(id) on delete set null,
  reference       text check (reference is null or length(reference) <= 120),
  note            text check (note is null or length(note) <= 1000),
  created_by      uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at      timestamptz not null default now()
);
create index if not exists credit_note_refunds_cn_idx on public.credit_note_refunds(credit_note_id);
create index if not exists credit_note_refunds_mode_idx on public.credit_note_refunds(mode_id);
create index if not exists credit_note_refunds_created_by_idx on public.credit_note_refunds(created_by);
alter table public.credit_note_refunds enable row level security;

drop policy if exists credit_note_refunds_read on public.credit_note_refunds;
drop policy if exists credit_note_refunds_insert on public.credit_note_refunds;
drop policy if exists credit_note_refunds_update on public.credit_note_refunds;
drop policy if exists credit_note_refunds_delete on public.credit_note_refunds;
drop policy if exists credit_note_refunds_portal on public.credit_note_refunds;
create policy credit_note_refunds_read on public.credit_note_refunds for select to authenticated using ((select private.has_perm('sales', 'view')));
create policy credit_note_refunds_insert on public.credit_note_refunds for insert to authenticated with check ((select private.has_perm('sales', 'edit')));
create policy credit_note_refunds_update on public.credit_note_refunds for update to authenticated
  using ((select private.has_perm('sales', 'edit'))) with check ((select private.has_perm('sales', 'edit')));
create policy credit_note_refunds_delete on public.credit_note_refunds for delete to authenticated using ((select private.has_perm('sales', 'full')));
-- Clients see refunds on their own issued credit notes
create policy credit_note_refunds_portal on public.credit_note_refunds for select to authenticated
  using ((select private.portal_customer()) is not null and exists (
    select 1 from public.sales_docs d where d.id = credit_note_id and d.customer_id = (select private.portal_customer()) and d.status <> 'draft'));

-- Refunds: only on an issued credit note, never more than the credit left
create or replace function private.guard_refund() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  cn record;
  avail numeric;
begin
  if tg_op = 'INSERT' and auth.uid() is not null and private.is_staff() then new.created_by := auth.uid(); end if;
  if private.seeding() then return new; end if;
  select kind, status, total into cn from public.sales_docs where id = new.credit_note_id for update;
  if cn.kind is distinct from 'credit_note' then raise exception 'Credit note not found.'; end if;
  if cn.status in ('draft', 'cancelled') then raise exception 'Only an issued credit note can be refunded.'; end if;
  avail := cn.total
         - coalesce((select sum(amount) from public.credit_applications where credit_note_id = new.credit_note_id), 0)
         - coalesce((select sum(amount) from public.credit_note_refunds where credit_note_id = new.credit_note_id and id <> new.id), 0);
  if new.amount > avail + 0.005 then raise exception 'Only % credit is left on this note.', private.inr(greatest(avail, 0)); end if;
  return new;
end;
$$;
revoke execute on function private.guard_refund() from public, anon, authenticated;
drop trigger if exists credit_note_refunds_guard on public.credit_note_refunds;
create trigger credit_note_refunds_guard before insert or update on public.credit_note_refunds
  for each row execute function private.guard_refund();

-- Applying credit: what's left now also excludes refunds (otherwise as in 0018)
create or replace function private.guard_credit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  cn record;
  inv record;
  avail numeric;
  due numeric;
begin
  if tg_op = 'INSERT' and auth.uid() is not null and private.is_staff() then new.created_by := auth.uid(); end if;
  if private.seeding() then return new; end if;
  -- lock both documents in a fixed order so concurrent applications can't deadlock
  perform 1 from public.sales_docs where id in (new.credit_note_id, new.invoice_id) order by id for update;
  select kind, status, total, customer_id into cn from public.sales_docs where id = new.credit_note_id;
  select kind, status, total, customer_id into inv from public.sales_docs where id = new.invoice_id;
  if cn.kind is distinct from 'credit_note' or inv.kind is distinct from 'invoice' then raise exception 'Credit note or invoice not found.'; end if;
  if cn.customer_id is distinct from inv.customer_id then raise exception 'The invoice belongs to a different customer.'; end if;
  if cn.status in ('draft', 'cancelled') then raise exception 'Issue the credit note (mark it as sent) before applying it.'; end if;
  if inv.status = 'cancelled' then raise exception 'This invoice is cancelled.'; end if;
  avail := cn.total
         - coalesce((select sum(amount) from public.credit_applications where credit_note_id = new.credit_note_id and id <> new.id), 0)
         - coalesce((select sum(amount) from public.credit_note_refunds where credit_note_id = new.credit_note_id), 0);
  due := inv.total
       - coalesce((select sum(amount) from public.payments where invoice_id = new.invoice_id), 0)
       - coalesce((select sum(amount) from public.credit_applications where invoice_id = new.invoice_id and id <> new.id), 0);
  if new.amount > avail + 0.005 then raise exception 'Only % credit is left on this note.', private.inr(greatest(avail, 0)); end if;
  if new.amount > due + 0.005 then raise exception 'The invoice only has % outstanding.', private.inr(greatest(due, 0)); end if;
  return new;
end;
$$;

-- Settled now includes refunds, so a refunded credit note can't be voided, deleted or shrunk below it
create or replace function private.doc_settled(p_id bigint) returns numeric
language sql stable security definer set search_path = '' as $$
  select coalesce((select sum(amount) from public.payments where invoice_id = p_id), 0)
       + coalesce((select sum(amount) from public.credit_applications where invoice_id = p_id), 0)
       + coalesce((select sum(amount) from public.credit_applications where credit_note_id = p_id), 0)
       + coalesce((select sum(amount) from public.credit_note_refunds where credit_note_id = p_id), 0);
$$;

-- Balances: refunds reduce a credit note's remaining credit (new column added at the end)
create or replace view public.doc_balances with (security_invoker = true) as
select d.id,
       coalesce(p.paid, 0)                         as paid,
       coalesce(ci.credited, 0)                    as credited,
       coalesce(cn.used, 0)                        as credit_used,
       d.total - coalesce(p.paid, 0) - coalesce(ci.credited, 0) - coalesce(cn.used, 0) - coalesce(r.refunded, 0) as balance,
       coalesce(r.refunded, 0)                     as refunded
from public.sales_docs d
left join (select invoice_id, sum(amount) paid from public.payments group by invoice_id) p on p.invoice_id = d.id
left join (select invoice_id, sum(amount) credited from public.credit_applications group by invoice_id) ci on ci.invoice_id = d.id
left join (select credit_note_id, sum(amount) used from public.credit_applications group by credit_note_id) cn on cn.credit_note_id = d.id
left join (select credit_note_id, sum(amount) refunded from public.credit_note_refunds group by credit_note_id) r on r.credit_note_id = d.id;
