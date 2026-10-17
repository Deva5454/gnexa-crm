-- Gnexa CRM — Expenses parity with Perfex (batch 19)
--
-- Recurring copies of an expense now keep its project (the scheduled job predates projects on expenses),
-- so repeating project costs keep showing on the project's Expenses tab. Existing copies are fixed too.

create or replace function private.expense_copy_project() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.recurring_from is not null and new.project_id is null then
    select project_id into new.project_id from public.expenses where id = new.recurring_from;
  end if;
  return new;
end;
$$;
revoke execute on function private.expense_copy_project() from public, anon, authenticated;
drop trigger if exists expenses_copy_project on public.expenses;
create trigger expenses_copy_project before insert on public.expenses
  for each row execute function private.expense_copy_project();

update public.expenses c set project_id = t.project_id
  from public.expenses t
 where c.recurring_from = t.id and c.project_id is null and t.project_id is not null;
