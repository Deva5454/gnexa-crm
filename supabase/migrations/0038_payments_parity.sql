-- Gnexa CRM — Payments parity with Perfex (batch 24)
--
--   • Payment modes get Perfex's options: a description (e.g. bank or UPI details), shown on invoices
--     as payment instructions; one mode "selected by default" when recording a payment; and whether a
--     mode is for invoices, expenses or both
--   • A "Payment receipt" e-mail staff can send (or tick to send) when recording a payment

alter table public.payment_modes add column if not exists description text check (description is null or length(description) <= 1000);
alter table public.payment_modes add column if not exists show_on_invoice boolean not null default false;
alter table public.payment_modes add column if not exists is_default boolean not null default false;
alter table public.payment_modes add column if not exists applies_to text not null default 'all';
alter table public.payment_modes drop constraint if exists payment_modes_applies_to_check;
alter table public.payment_modes add constraint payment_modes_applies_to_check check (applies_to in ('all', 'invoices', 'expenses'));
-- At most one default mode
create unique index if not exists payment_modes_one_default on public.payment_modes ((true)) where is_default;

-- Make the first active mode the default, if none is yet
update public.payment_modes set is_default = true
 where id = (select id from public.payment_modes where is_active order by id limit 1)
   and not exists (select 1 from public.payment_modes where is_default);

insert into public.email_templates (key, name, description, subject, body) values
  ('payment_recorded', 'Payment recorded', 'Receipt sent to the customer when staff record a payment', 'Payment receipt — {doc_number}',
   E'Hi {contact_name},\n\nThank you for your payment of {amount} received on {date} ({mode}{reference}) against invoice {doc_number}.\n\nBalance still due on this invoice: {balance}.\n\nYou can download the receipt and see your invoices any time in your client portal.\n\nRegards,\n{company_name}')
on conflict (key) do nothing;
