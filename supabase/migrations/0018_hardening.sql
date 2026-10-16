-- Gnexa CRM — Hardening (audit batches 1 & 2)
--
-- 1. Role permissions are enforced by the database, not only by the app:
--    private.has_perm(module, level) mirrors lib/permissions.ts, and every module table gets
--    read = view, insert/update = edit, delete = full policies. Storage buckets follow suit.
-- 2. Money can't be corrupted: payments and credit applications are validated under a row lock
--    (no overpaying, no over-applying, no cross-customer credit); documents with money on them
--    can't be deleted, cancelled or reopened as draft; an edit can't drop a total below what's settled.
-- 3. Billing is claimed atomically: an expense can sit on one live invoice only; a project's hours or
--    fixed price can't be invoiced twice; cancelling an invoice releases its expenses and hours.
-- 4. Saving a document (header + lines) is one transaction: public.save_sales_doc.
-- 5. Authorship can't be forged (notes, comments, posts, reminders, e-mail log, timesheets, media),
--    and only the author or an admin can change or delete them.
-- 6. Deleting a lead no longer deletes documents already moved to a customer; GDPR records survive
--    the customer being erased.
--
-- Demo re-seeding (gnexa.seeding = 'on') skips the money guards so reset_demo_data keeps working.

-- ───────────────────────── Permission helper ─────────────────────────
create or replace function private.has_perm(p_module text, p_level text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select p.is_admin or
      (case coalesce(r.permissions ->> p_module, 'edit')
         when 'none' then 0 when 'view' then 1 when 'edit' then 2 when 'full' then 3 else 2 end)
      >= (case p_level when 'view' then 1 when 'edit' then 2 else 3 end)
    from public.profiles p left join public.roles r on r.id = p.role_id
    where p.id = auth.uid() and p.is_active
  ), false);
$$;
revoke execute on function private.has_perm(text, text) from public, anon;
grant execute on function private.has_perm(text, text) to authenticated;

create or replace function private.seeding() returns boolean
language sql stable set search_path = '' as $$
  select coalesce(current_setting('gnexa.seeding', true), '') = 'on';
$$;
revoke execute on function private.seeding() from public, anon;
grant execute on function private.seeding() to authenticated;

-- ───────────────────────── Module tables: view / edit / full ─────────────────────────
do $$
declare
  r record;
begin
  for r in select * from (values
    ('customers', 'customers'), ('contacts', 'customers'),
    ('leads', 'leads'),
    ('tasks', 'tasks'), ('task_assignees', 'tasks'), ('task_checklist_items', 'tasks'), ('task_files', 'tasks'),
    ('sales_docs', 'sales'), ('sales_doc_items', 'sales'), ('payments', 'sales'), ('credit_applications', 'sales'),
    ('subscriptions', 'sales'), ('items', 'sales'), ('estimate_requests', 'sales'),
    ('expenses', 'expenses'),
    ('projects', 'projects'), ('milestones', 'projects'), ('project_members', 'projects'), ('project_files', 'projects'),
    ('contracts', 'contracts'),
    ('tickets', 'support'), ('ticket_replies', 'support'),
    ('kb_articles', 'knowledge_base'),
    ('goals', 'reports')
  ) as t(tbl, module)
  loop
    execute format('drop policy if exists %I on public.%I', r.tbl || '_staff', r.tbl);
    execute format('create policy %I on public.%I for select to authenticated using ((select private.has_perm(%L, ''view'')))', r.tbl || '_staff_read', r.tbl, r.module);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select private.has_perm(%L, ''edit'')))', r.tbl || '_staff_insert', r.tbl, r.module);
    execute format('create policy %I on public.%I for update to authenticated using ((select private.has_perm(%L, ''edit''))) with check ((select private.has_perm(%L, ''edit'')))', r.tbl || '_staff_update', r.tbl, r.module, r.module);
    execute format('create policy %I on public.%I for delete to authenticated using ((select private.has_perm(%L, ''full'')))', r.tbl || '_staff_delete', r.tbl, r.module);
  end loop;
  -- Rows that are replaced as part of editing their parent: removing them is an edit, not a delete
  for r in select * from (values
    ('sales_doc_items', 'sales'), ('task_assignees', 'tasks'), ('task_checklist_items', 'tasks'), ('project_members', 'projects')
  ) as t(tbl, module)
  loop
    execute format('drop policy %I on public.%I', r.tbl || '_staff_delete', r.tbl);
    execute format('create policy %I on public.%I for delete to authenticated using ((select private.has_perm(%L, ''edit'')))', r.tbl || '_staff_delete', r.tbl, r.module);
  end loop;
end $$;

-- Attachments: the uploader (with edit) or someone with full access removes them
drop policy task_files_staff_delete on public.task_files;
create policy task_files_staff_delete on public.task_files for delete to authenticated
  using ((select private.has_perm('tasks', 'full')) or (uploaded_by = (select auth.uid()) and (select private.has_perm('tasks', 'edit'))));
drop policy project_files_staff_delete on public.project_files;
create policy project_files_staff_delete on public.project_files for delete to authenticated
  using ((select private.has_perm('projects', 'full')) or (uploaded_by = (select auth.uid()) and (select private.has_perm('projects', 'edit'))));

-- Task followers: follow/unfollow yourself on tasks you can see; task editors manage anyone
drop policy if exists task_followers_staff on public.task_followers;
create policy task_followers_read on public.task_followers for select to authenticated using ((select private.has_perm('tasks', 'view')));
create policy task_followers_insert on public.task_followers for insert to authenticated
  with check ((select private.has_perm('tasks', 'edit')) or (staff_id = (select auth.uid()) and (select private.has_perm('tasks', 'view'))));
create policy task_followers_delete on public.task_followers for delete to authenticated
  using ((select private.has_perm('tasks', 'edit')) or (staff_id = (select auth.uid()) and (select private.is_staff())));

-- Timesheets: log your own time (project editors, or task editors via timers); project admins manage all
drop policy if exists timesheets_staff on public.timesheets;
create policy timesheets_read on public.timesheets for select to authenticated using ((select private.has_perm('projects', 'view')));
create policy timesheets_insert on public.timesheets for insert to authenticated
  with check ((select private.has_perm('projects', 'full'))
              or (staff_id = (select auth.uid()) and ((select private.has_perm('projects', 'edit')) or (select private.has_perm('tasks', 'edit')))));
create policy timesheets_update on public.timesheets for update to authenticated
  using ((select private.has_perm('projects', 'edit'))) with check ((select private.has_perm('projects', 'edit')));
create policy timesheets_delete on public.timesheets for delete to authenticated
  using ((select private.has_perm('projects', 'full')) or (staff_id = (select auth.uid()) and (select private.is_staff())));

-- GDPR requests are handled by admins (clients raise them through portal_gdpr_request)
drop policy if exists gdpr_requests_staff on public.gdpr_requests;
create policy gdpr_requests_read on public.gdpr_requests for select to authenticated using ((select private.is_staff()));
create policy gdpr_requests_write on public.gdpr_requests for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- ───────────────────────── Authored records: own or admin ─────────────────────────
-- Comments on tasks/projects, newsfeed posts and comments, media: anyone on staff reads and adds
-- (as themselves); only the author or an admin edits or deletes.
do $$
declare
  r record;
begin
  for r in select * from (values
    ('task_comments', 'created_by', 'tasks'), ('project_comments', 'created_by', 'projects'),
    ('posts', 'created_by', null), ('post_comments', 'created_by', null),
    ('media_files', 'uploaded_by', null), ('surveys', 'created_by', null)
  ) as t(tbl, col, module)
  loop
    execute format('drop policy if exists %I on public.%I', r.tbl || '_staff', r.tbl);
    execute format('create policy %I on public.%I for select to authenticated using (%s)', r.tbl || '_read', r.tbl,
      case when r.module is null then '(select private.is_staff())' else format('(select private.has_perm(%L, ''view''))', r.module) end);
    execute format('create policy %I on public.%I for insert to authenticated with check (%s and %I = (select auth.uid()))', r.tbl || '_insert', r.tbl,
      case when r.module is null then '(select private.is_staff())' else format('(select private.has_perm(%L, ''view''))', r.module) end, r.col);
    execute format('create policy %I on public.%I for update to authenticated using ((select private.is_staff()) and (%I = (select auth.uid()) or (select private.is_admin()))) with check ((select private.is_staff()))', r.tbl || '_update', r.tbl, r.col);
    execute format('create policy %I on public.%I for delete to authenticated using ((select private.is_staff()) and (%I = (select auth.uid()) or (select private.is_admin())))', r.tbl || '_delete', r.tbl, r.col);
  end loop;
end $$;

-- Likes: your own only
drop policy if exists post_likes_staff on public.post_likes;
create policy post_likes_read on public.post_likes for select to authenticated using ((select private.is_staff()));
create policy post_likes_insert on public.post_likes for insert to authenticated with check ((select private.is_staff()) and staff_id = (select auth.uid()));
create policy post_likes_delete on public.post_likes for delete to authenticated using (staff_id = (select auth.uid()));

-- Survey questions and responses belong to the survey's creator (or an admin)
create or replace function private.owns_survey(p_survey bigint) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_admin() or exists (select 1 from public.surveys s where s.id = p_survey and s.created_by = auth.uid() and private.is_staff());
$$;
revoke execute on function private.owns_survey(bigint) from public, anon;
grant execute on function private.owns_survey(bigint) to authenticated;

drop policy if exists survey_questions_staff on public.survey_questions;
create policy survey_questions_read on public.survey_questions for select to authenticated using ((select private.is_staff()));
create policy survey_questions_write on public.survey_questions for all to authenticated
  using (private.owns_survey(survey_id)) with check (private.owns_survey(survey_id));
drop policy if exists survey_responses_staff on public.survey_responses;
create policy survey_responses_read on public.survey_responses for select to authenticated using ((select private.is_staff()));
create policy survey_responses_delete on public.survey_responses for delete to authenticated using (private.owns_survey(survey_id));
drop policy if exists survey_answers_staff on public.survey_answers;
create policy survey_answers_read on public.survey_answers for select to authenticated using ((select private.is_staff()));

-- Tags: anyone on staff tags records and creates tags; renaming, recolouring and deleting is admin-only
drop policy if exists tags_staff on public.tags;
create policy tags_read on public.tags for select to authenticated using ((select private.is_staff()));
create policy tags_insert on public.tags for insert to authenticated with check ((select private.is_staff()));
create policy tags_update on public.tags for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy tags_delete on public.tags for delete to authenticated using ((select private.is_admin()));

-- Notes, reminders, e-mail log: written as yourself
drop policy if exists notes_insert on public.notes;
create policy notes_insert on public.notes for insert to authenticated
  with check ((select private.is_staff()) and created_by = (select auth.uid()));

drop policy if exists reminders_insert on public.reminders;
drop policy if exists reminders_update on public.reminders;
create policy reminders_insert on public.reminders for insert to authenticated
  with check ((select private.is_staff()) and created_by = (select auth.uid()) and (staff_id = (select auth.uid()) or (select private.is_admin())));
create policy reminders_update on public.reminders for update to authenticated
  using ((staff_id = (select auth.uid())) or (created_by = (select auth.uid())) or (select private.is_admin()))
  with check ((select private.is_staff()) and (staff_id = (select auth.uid()) or (select private.is_admin())));

drop policy if exists email_log_insert on public.email_log;
create policy email_log_insert on public.email_log for insert to authenticated
  with check ((select private.is_staff()) and sent_by = (select auth.uid()));

drop policy if exists task_timers_update on public.task_timers;
create policy task_timers_update on public.task_timers for update to authenticated
  using ((select private.is_staff()) and staff_id = (select auth.uid()))
  with check ((select private.is_staff()) and staff_id = (select auth.uid()));

-- ───────────────────────── Storage buckets follow the modules ─────────────────────────
-- Delete: the uploader, or someone with full access to the module (media: the uploader or an admin)
drop policy if exists project_files_read on storage.objects;
drop policy if exists project_files_write on storage.objects;
drop policy if exists project_files_remove on storage.objects;
create policy project_files_read on storage.objects for select to authenticated
  using (bucket_id = 'project-files' and (select private.has_perm('projects', 'view')));
create policy project_files_write on storage.objects for insert to authenticated
  with check (bucket_id = 'project-files' and (select private.has_perm('projects', 'edit')));
create policy project_files_remove on storage.objects for delete to authenticated
  using (bucket_id = 'project-files' and ((select private.has_perm('projects', 'full')) or (owner_id = (select auth.uid())::text and (select private.has_perm('projects', 'edit')))));

drop policy if exists task_files_read on storage.objects;
drop policy if exists task_files_write on storage.objects;
drop policy if exists task_files_remove on storage.objects;
create policy task_files_read on storage.objects for select to authenticated
  using (bucket_id = 'task-files' and (select private.has_perm('tasks', 'view')));
create policy task_files_write on storage.objects for insert to authenticated
  with check (bucket_id = 'task-files' and (select private.has_perm('tasks', 'edit')));
create policy task_files_remove on storage.objects for delete to authenticated
  using (bucket_id = 'task-files' and ((select private.has_perm('tasks', 'full')) or (owner_id = (select auth.uid())::text and (select private.has_perm('tasks', 'edit')))));

drop policy if exists expense_receipts_read on storage.objects;
drop policy if exists expense_receipts_write on storage.objects;
drop policy if exists expense_receipts_remove on storage.objects;
create policy expense_receipts_read on storage.objects for select to authenticated
  using (bucket_id = 'expense-receipts' and (select private.has_perm('expenses', 'view')));
create policy expense_receipts_write on storage.objects for insert to authenticated
  with check (bucket_id = 'expense-receipts' and (select private.has_perm('expenses', 'edit')));
create policy expense_receipts_remove on storage.objects for delete to authenticated
  using (bucket_id = 'expense-receipts' and (select private.has_perm('expenses', 'edit')));

drop policy if exists media_remove on storage.objects;
create policy media_remove on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (select private.is_staff()) and (owner_id = (select auth.uid())::text or (select private.is_admin())));

-- ───────────────────────── Money guards ─────────────────────────
-- Settled = paid + credited (invoices) or credit used (credit notes)
create or replace function private.doc_settled(p_id bigint) returns numeric
language sql stable security definer set search_path = '' as $$
  select coalesce((select sum(amount) from public.payments where invoice_id = p_id), 0)
       + coalesce((select sum(amount) from public.credit_applications where invoice_id = p_id), 0)
       + coalesce((select sum(amount) from public.credit_applications where credit_note_id = p_id), 0);
$$;
revoke execute on function private.doc_settled(bigint) from public, anon, authenticated;

create or replace function private.inr(p numeric) returns text
language sql immutable set search_path = '' as $$ select '₹' || to_char(p, 'FM99,99,99,99,990.00') $$;

-- Payments: only on live invoices, never more than the balance. The invoice row lock serialises
-- concurrent payments, so two at once can't both pass the balance check.
create or replace function private.guard_payment() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  d record;
  bal numeric;
begin
  if tg_op = 'INSERT' and auth.uid() is not null and private.is_staff() then new.created_by := auth.uid(); end if;
  if private.seeding() then return new; end if;
  select kind, status, total into d from public.sales_docs where id = new.invoice_id for update;
  if not found then raise exception 'Invoice not found.'; end if;
  if d.kind <> 'invoice' then raise exception 'Payments can only be recorded against invoices.'; end if;
  if d.status = 'cancelled' then raise exception 'This invoice is cancelled.'; end if;
  bal := d.total
       - coalesce((select sum(amount) from public.payments where invoice_id = new.invoice_id and id <> new.id), 0)
       - coalesce((select sum(amount) from public.credit_applications where invoice_id = new.invoice_id), 0);
  if new.amount > bal + 0.005 then
    raise exception 'Amount is more than the balance due (%).', private.inr(greatest(bal, 0));
  end if;
  return new;
end;
$$;
revoke execute on function private.guard_payment() from public, anon, authenticated;
drop trigger if exists payments_guard on public.payments;
create trigger payments_guard before insert or update on public.payments
  for each row execute function private.guard_payment();

-- Credit applications: an issued credit note, an invoice of the same customer, within both balances
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
  avail := cn.total - coalesce((select sum(amount) from public.credit_applications where credit_note_id = new.credit_note_id and id <> new.id), 0);
  due := inv.total
       - coalesce((select sum(amount) from public.payments where invoice_id = new.invoice_id), 0)
       - coalesce((select sum(amount) from public.credit_applications where invoice_id = new.invoice_id and id <> new.id), 0);
  if new.amount > avail + 0.005 then raise exception 'Only % credit is left on this note.', private.inr(greatest(avail, 0)); end if;
  if new.amount > due + 0.005 then raise exception 'The invoice only has % outstanding.', private.inr(greatest(due, 0)); end if;
  return new;
end;
$$;
revoke execute on function private.guard_credit() from public, anon, authenticated;
drop trigger if exists credit_applications_guard on public.credit_applications;
create trigger credit_applications_guard before insert or update on public.credit_applications
  for each row execute function private.guard_credit();

-- Documents: fixed kind; valid status per kind; no cancel/draft/delete with money on it;
-- a total can't drop below what's been settled; a cancelled project invoice stays cancelled.
create or replace function private.guard_doc() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  settled numeric;
  label text;
begin
  if private.seeding() then return coalesce(new, old); end if;
  label := case coalesce(new.kind, old.kind) when 'credit_note' then 'credit note' else coalesce(new.kind, old.kind)::text end;

  if tg_op = 'DELETE' then
    if private.doc_settled(old.id) > 0 then
      raise exception 'This % has payments or applied credit — remove those first, or cancel it instead of deleting.', label;
    end if;
    return old;
  end if;

  if new.kind <> old.kind then raise exception 'A document''s type can''t be changed.'; end if;

  if new.status is distinct from old.status then
    if new.kind in ('invoice', 'credit_note') and new.status not in ('draft', 'sent', 'cancelled') then
      raise exception 'This % can''t be marked %.', label, new.status;
    end if;
    if new.status in ('cancelled', 'draft') and private.doc_settled(new.id) > 0 then
      raise exception 'This % has payments or applied credit — remove those first.', label;
    end if;
    if old.status = 'cancelled' and new.kind = 'invoice' then
      if new.project_id is not null then
        raise exception 'A cancelled project invoice can''t be reopened — invoice the project again instead.';
      end if;
      if exists (
        select 1 from public.sales_doc_items i
        join public.sales_doc_items o on o.expense_id = i.expense_id and o.doc_id <> i.doc_id
        join public.sales_docs s on s.id = o.doc_id and s.status <> 'cancelled'
        where i.doc_id = new.id
      ) then
        raise exception 'An expense on this invoice has since been billed on another invoice — remove that line before reopening.';
      end if;
    end if;
  end if;

  if new.total < old.total then
    settled := private.doc_settled(new.id);
    if new.total + 0.005 < settled then
      raise exception 'Total can''t be less than the % (%).',
        case when new.kind = 'credit_note' then 'credit already applied' else 'amount already received' end, private.inr(settled);
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function private.guard_doc() from public, anon, authenticated;
drop trigger if exists sales_docs_guard on public.sales_docs;
create trigger sales_docs_guard before update or delete on public.sales_docs
  for each row execute function private.guard_doc();

-- ───────────────────────── Billing claims ─────────────────────────
-- expenses.invoice_id is derived: the live (non-cancelled) invoice whose line points at the expense.
create or replace function private.sync_expense(p_expense bigint) returns void
language sql security definer set search_path = '' as $$
  update public.expenses e set invoice_id = (
    select i.doc_id from public.sales_doc_items i join public.sales_docs s on s.id = i.doc_id
    where i.expense_id = p_expense and s.kind = 'invoice' and s.status <> 'cancelled'
    order by i.doc_id limit 1
  )
  where e.id = p_expense
    and e.invoice_id is distinct from (
      select i.doc_id from public.sales_doc_items i join public.sales_docs s on s.id = i.doc_id
      where i.expense_id = p_expense and s.kind = 'invoice' and s.status <> 'cancelled'
      order by i.doc_id limit 1);
$$;
revoke execute on function private.sync_expense(bigint) from public, anon, authenticated;

-- An expense line must be a billable expense of this invoice's customer, not on another live invoice.
-- Locking the expense row serialises two invoices racing for the same expense.
create or replace function private.guard_expense_line() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  d record;
  e record;
begin
  if new.expense_id is null or private.seeding() then return new; end if;
  select kind, customer_id into d from public.sales_docs where id = new.doc_id;
  if d.kind <> 'invoice' then new.expense_id := null; return new; end if;
  select id, name, customer_id, is_billable into e from public.expenses where id = new.expense_id for update;
  if not found then raise exception 'An expense on this invoice no longer exists — remove that line.'; end if;
  if not e.is_billable or e.customer_id is distinct from d.customer_id then
    raise exception '“%” isn''t a billable expense for this customer.', e.name;
  end if;
  if exists (select 1 from public.sales_doc_items i where i.expense_id = new.expense_id and i.doc_id = new.doc_id and i.id <> new.id) then
    raise exception '“%” is on this invoice twice.', e.name;
  end if;
  if exists (
    select 1 from public.sales_doc_items i join public.sales_docs s on s.id = i.doc_id
    where i.expense_id = new.expense_id and i.doc_id <> new.doc_id and s.status <> 'cancelled'
  ) then
    raise exception '“%” is already billed on another invoice.', e.name;
  end if;
  return new;
end;
$$;
revoke execute on function private.guard_expense_line() from public, anon, authenticated;
drop trigger if exists sales_doc_items_expense_guard on public.sales_doc_items;
create trigger sales_doc_items_expense_guard before insert or update of expense_id, doc_id on public.sales_doc_items
  for each row execute function private.guard_expense_line();

create or replace function private.sync_line_expense() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op in ('UPDATE', 'DELETE') and old.expense_id is not null then perform private.sync_expense(old.expense_id); end if;
  if tg_op in ('INSERT', 'UPDATE') and new.expense_id is not null then perform private.sync_expense(new.expense_id); end if;
  return null;
end;
$$;
revoke execute on function private.sync_line_expense() from public, anon, authenticated;
drop trigger if exists sales_doc_items_expense_sync on public.sales_doc_items;
create trigger sales_doc_items_expense_sync after insert or delete or update of expense_id, doc_id on public.sales_doc_items
  for each row execute function private.sync_line_expense();

-- Cancelling an invoice frees its expenses and hours; reopening re-claims its expenses
create or replace function private.on_doc_status() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  x bigint;
begin
  if new.kind <> 'invoice' then return null; end if;
  if new.status = 'cancelled' then
    update public.timesheets set invoice_id = null where invoice_id = new.id;
  end if;
  for x in select distinct expense_id from public.sales_doc_items where doc_id = new.id and expense_id is not null loop
    perform private.sync_expense(x);
  end loop;
  return null;
end;
$$;
revoke execute on function private.on_doc_status() from public, anon, authenticated;
drop trigger if exists sales_docs_status_sync on public.sales_docs;
create trigger sales_docs_status_sync after update of status on public.sales_docs
  for each row when (old.status is distinct from new.status) execute function private.on_doc_status();

-- A billed expense keeps its amount, tax, customer and billable flag until it's off the invoice
create or replace function private.guard_billed_expense() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.invoice_id is not null and not private.seeding()
     and (new.amount, new.tax_rate, new.customer_id, new.is_billable) is distinct from (old.amount, old.tax_rate, old.customer_id, old.is_billable) then
    raise exception 'This expense is already billed — remove it from the invoice first to change its amount, tax, customer or billing.';
  end if;
  return new;
end;
$$;
revoke execute on function private.guard_billed_expense() from public, anon, authenticated;
drop trigger if exists expenses_billed_guard on public.expenses;
create trigger expenses_billed_guard before update on public.expenses
  for each row execute function private.guard_billed_expense();

-- ───────────────────────── Authorship can't be forged ─────────────────────────
create or replace function private.stamp_author() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or private.seeding() or not private.is_staff() then return new; end if;
  if tg_op = 'INSERT' then
    new := jsonb_populate_record(new, jsonb_build_object(tg_argv[0], auth.uid()));
  else
    -- the author column never changes after insert
    new := jsonb_populate_record(new, jsonb_build_object(tg_argv[0], to_jsonb(old) -> tg_argv[0]));
  end if;
  return new;
end;
$$;
revoke execute on function private.stamp_author() from public, anon, authenticated;

do $$
declare
  r record;
begin
  for r in select * from (values
    ('notes', 'created_by'), ('task_comments', 'created_by'), ('project_comments', 'created_by'),
    ('posts', 'created_by'), ('post_comments', 'created_by'), ('media_files', 'uploaded_by'),
    ('surveys', 'created_by'), ('sales_docs', 'created_by'), ('expenses', 'created_by'),
    ('task_files', 'uploaded_by'), ('project_files', 'uploaded_by')
  ) as t(tbl, col)
  loop
    execute format('drop trigger if exists %I on public.%I', r.tbl || '_author', r.tbl);
    execute format('create trigger %I before insert or update on public.%I for each row execute function private.stamp_author(%L)', r.tbl || '_author', r.tbl, r.col);
  end loop;
end $$;

-- ───────────────────────── Safer deletes ─────────────────────────
-- Deleting a lead keeps documents that already belong to a customer (only lead-only proposals go)
create or replace function private.detach_lead_docs() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.sales_docs set lead_id = null where lead_id = old.id and customer_id is not null;
  return old;
end;
$$;
revoke execute on function private.detach_lead_docs() from public, anon, authenticated;
drop trigger if exists leads_detach_docs on public.leads;
create trigger leads_detach_docs before delete on public.leads
  for each row execute function private.detach_lead_docs();

-- GDPR requests are compliance evidence: they outlive an erased customer
alter table public.gdpr_requests drop constraint if exists gdpr_requests_customer_id_fkey;
alter table public.gdpr_requests add constraint gdpr_requests_customer_id_fkey
  foreign key (customer_id) references public.customers(id) on delete set null;

-- ───────────────────────── Atomic saves ─────────────────────────
-- Create or update a sales document and replace its lines in one transaction. Runs as the caller,
-- so RLS (sales: edit) and every guard above apply; any failure leaves the document untouched.
-- p_doc: customer_id, lead_id, subject, content, date, due_date, currency, discount_percent, adjustment,
--        subtotal, discount_total, tax_total, total, notes, terms, [status, project_id, source_id],
--        [recurring_every, recurring_unit, recurring_cycles, next_recurring_date]
-- p_lines: [{item_id, description, long_description, qty, unit, rate, tax_rate, expense_id}]
create or replace function public.save_sales_doc(p_kind public.doc_kind, p_id bigint, p_doc jsonb, p_lines jsonb)
returns jsonb
language plpgsql set search_path = '' as $$
declare
  v_id bigint;
  v_number int;
  d jsonb := p_doc;
begin
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then raise exception 'Add at least one line item.'; end if;
  if jsonb_array_length(p_lines) > 200 then raise exception 'A document can have at most 200 lines.'; end if;

  if p_id is not null then
    perform 1 from public.sales_docs where id = p_id and kind = p_kind for update;
    if not found then raise exception 'Document not found.'; end if;
    update public.sales_docs set
      customer_id      = (d ->> 'customer_id')::bigint,
      lead_id          = (d ->> 'lead_id')::bigint,
      subject          = d ->> 'subject',
      content          = d ->> 'content',
      date             = (d ->> 'date')::date,
      due_date         = (d ->> 'due_date')::date,
      currency         = coalesce(d ->> 'currency', currency),
      discount_percent = coalesce((d ->> 'discount_percent')::numeric, 0),
      adjustment       = coalesce((d ->> 'adjustment')::numeric, 0),
      subtotal         = (d ->> 'subtotal')::numeric,
      discount_total   = (d ->> 'discount_total')::numeric,
      tax_total        = (d ->> 'tax_total')::numeric,
      total            = (d ->> 'total')::numeric,
      notes            = d ->> 'notes',
      terms            = d ->> 'terms',
      recurring_every     = case when d ? 'recurring_every' then (d ->> 'recurring_every')::int else recurring_every end,
      recurring_unit      = case when d ? 'recurring_unit' then coalesce(d ->> 'recurring_unit', 'month') else recurring_unit end,
      recurring_cycles    = case when d ? 'recurring_cycles' then (d ->> 'recurring_cycles')::int else recurring_cycles end,
      next_recurring_date = case when d ? 'next_recurring_date' then (d ->> 'next_recurring_date')::date else next_recurring_date end
    where id = p_id
    returning id, number into v_id, v_number;
    delete from public.sales_doc_items where doc_id = v_id;
  else
    insert into public.sales_docs (kind, customer_id, lead_id, subject, content, date, due_date, currency, discount_percent, adjustment,
                                   subtotal, discount_total, tax_total, total, notes, terms, status, sent_at, project_id, source_id,
                                   recurring_every, recurring_unit, recurring_cycles, next_recurring_date)
    values (p_kind, (d ->> 'customer_id')::bigint, (d ->> 'lead_id')::bigint, d ->> 'subject', d ->> 'content',
            coalesce((d ->> 'date')::date, current_date), (d ->> 'due_date')::date, coalesce(d ->> 'currency', 'INR'),
            coalesce((d ->> 'discount_percent')::numeric, 0), coalesce((d ->> 'adjustment')::numeric, 0),
            (d ->> 'subtotal')::numeric, (d ->> 'discount_total')::numeric, (d ->> 'tax_total')::numeric, (d ->> 'total')::numeric,
            d ->> 'notes', d ->> 'terms',
            case when d ->> 'status' = 'sent' then 'sent' else 'draft' end,
            case when d ->> 'status' = 'sent' then now() end,
            (d ->> 'project_id')::bigint, (d ->> 'source_id')::bigint,
            (d ->> 'recurring_every')::int, coalesce(d ->> 'recurring_unit', 'month'), (d ->> 'recurring_cycles')::int, (d ->> 'next_recurring_date')::date)
    returning id, number into v_id, v_number;
  end if;

  insert into public.sales_doc_items (doc_id, position, item_id, description, long_description, qty, unit, rate, tax_rate, expense_id)
  select v_id, (l.ord - 1)::int, (l.x ->> 'item_id')::bigint, l.x ->> 'description', l.x ->> 'long_description',
         (l.x ->> 'qty')::numeric, l.x ->> 'unit', (l.x ->> 'rate')::numeric, coalesce((l.x ->> 'tax_rate')::numeric, 0),
         (l.x ->> 'expense_id')::bigint
  from jsonb_array_elements(p_lines) with ordinality as l(x, ord);

  return jsonb_build_object('id', v_id, 'number', v_number);
end;
$$;
revoke execute on function public.save_sales_doc(public.doc_kind, bigint, jsonb, jsonb) from public, anon;
grant execute on function public.save_sales_doc(public.doc_kind, bigint, jsonb, jsonb) to authenticated;

-- Raise a draft invoice for a project. Hourly: claims the unbilled billable hours (grouped by task)
-- in the same transaction, so two clicks can't bill them twice. Fixed: refuses if a live invoice exists.
create or replace function public.invoice_project(p_project bigint) returns jsonb
language plpgsql set search_path = '' as $$
declare
  p record;
  s record;
  v_lines jsonb;
  v_ids bigint[];
  v_doc jsonb;
  v_sub numeric;
  v_tax numeric;
begin
  select * into p from public.projects where id = p_project for update;
  if not found then raise exception 'Project not found.'; end if;
  select currency, default_terms into s from public.company_settings limit 1;

  if p.billing_type = 'hourly' then
    select array_agg(t.id) into v_ids from public.timesheets t
    where t.project_id = p_project and t.is_billable and t.invoice_id is null;
    if v_ids is null then raise exception 'There are no unbilled billable hours on this project.'; end if;
    select jsonb_agg(jsonb_build_object('description', g.task, 'long_description', p.name || ' — ' || g.hrs || ' h',
                                        'qty', g.hrs, 'unit', 'hrs', 'rate', p.hourly_rate, 'tax_rate', 18) order by g.task)
    into v_lines
    from (select coalesce(k.name, 'General work') task, sum(t.hours) hrs
          from public.timesheets t left join public.tasks k on k.id = t.task_id
          where t.id = any(v_ids) group by 1) g;
  else
    if coalesce(p.fixed_price, 0) <= 0 then raise exception 'Set a fixed price on the project first.'; end if;
    if exists (select 1 from public.sales_docs where project_id = p_project and kind = 'invoice' and status <> 'cancelled') then
      raise exception 'This fixed-price project has already been invoiced.';
    end if;
    v_lines := jsonb_build_array(jsonb_build_object('description', p.name, 'long_description', 'Fixed-price project',
                                                    'qty', 1, 'unit', 'project', 'rate', p.fixed_price, 'tax_rate', 18));
  end if;

  select round(sum((x ->> 'qty')::numeric * (x ->> 'rate')::numeric), 2),
         round(sum((x ->> 'qty')::numeric * (x ->> 'rate')::numeric * 0.18), 2)
  into v_sub, v_tax from jsonb_array_elements(v_lines) x;

  v_doc := public.save_sales_doc('invoice', null, jsonb_build_object(
    'customer_id', p.customer_id, 'project_id', p.id,
    'subject', case when p.billing_type = 'hourly' then p.name || ' — time & materials' else p.name end,
    'date', current_date, 'due_date', current_date + 15, 'currency', coalesce(s.currency, 'INR'),
    'subtotal', v_sub, 'discount_total', 0, 'tax_total', v_tax, 'total', v_sub + v_tax,
    'notes', 'Thank you for your business.', 'terms', s.default_terms), v_lines);

  if v_ids is not null then
    update public.timesheets set invoice_id = (v_doc ->> 'id')::bigint where id = any(v_ids) and invoice_id is null;
  end if;
  return v_doc;
end;
$$;
revoke execute on function public.invoice_project(bigint) from public, anon;
grant execute on function public.invoice_project(bigint) to authenticated;

-- A signed contract's terms are frozen; reopening it as a draft (which clears the signature) unlocks them
create or replace function private.guard_signed_contract() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.status = 'signed' and new.status = 'signed' and not private.seeding()
     and (new.customer_id, new.subject, new.value, new.start_date, new.end_date, new.content, new.type_id)
         is distinct from (old.customer_id, old.subject, old.value, old.start_date, old.end_date, old.content, old.type_id) then
    raise exception 'This contract is signed — reopen it as a draft (which clears the signature) before changing its terms.';
  end if;
  return new;
end;
$$;
revoke execute on function private.guard_signed_contract() from public, anon, authenticated;
drop trigger if exists contracts_signed_guard on public.contracts;
create trigger contracts_signed_guard before update on public.contracts
  for each row execute function private.guard_signed_contract();
