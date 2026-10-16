-- Gnexa CRM — Scheduled background work (audit batch 5)
--
-- Recurring invoices and expenses, subscription billing and overdue reminders used to be raised whenever
-- someone opened the dashboard, invoices, expenses or subscriptions — a database write blocking every one
-- of those page loads, and nothing at all happened on days nobody signed in. They now run on a schedule
-- (pg_cron, every 15 minutes). Saving a recurring record still raises anything already due straight away.
--
-- Due reminders keep turning into notifications when their owner next loads a page (a no-op update
-- unless something is due), so they need no schedule.

-- Overdue-reminder scan: only sent invoices with a due date are candidates
create index if not exists sales_docs_open_invoices_due_idx on public.sales_docs (due_date)
  where kind = 'invoice' and status = 'sent';
-- Reminders that are due and not yet notified
create index if not exists reminders_due_idx on public.reminders (staff_id, remind_at) where not is_notified;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    -- same name again replaces the job, so re-running this file is safe
    perform cron.schedule('gnexa-recurring', '*/15 * * * *', 'select private.run_recurring_core()');
  else
    raise notice 'pg_cron is not available here — recurring billing will only run when records are saved.';
  end if;
end $$;
