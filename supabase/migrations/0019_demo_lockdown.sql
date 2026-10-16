-- Gnexa CRM — Demo lockdown (audit batch 3)
--
-- One switch, company_settings.demo_mode, decides whether this install is a public demo or a real CRM.
-- Only the owner can flip it — from the Supabase SQL editor — never through the app or the API:
--
--     select private.go_live('you@yourcompany.com');          -- keep the data you've entered
--     select private.go_live('you@yourcompany.com', true);    -- …or start from an empty CRM
--
-- (Create that account first: Supabase → Authentication → Users → Add user.)
--
-- While the demo is on, visitors can try everything but can't break the demo for the next person:
--   • the demo accounts can't be deactivated, demoted, deleted, or have their e-mail/password changed;
--   • no other account can be activated or made admin (no lasting back door);
--   • "Reset demo data" also restores the demo roles' permissions.
-- Once live: /demo is closed, the demo accounts are deactivated and blocked, and resets are refused.

alter table public.company_settings add column if not exists demo_mode boolean not null default true;

create or replace function private.demo_mode() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select demo_mode from public.company_settings limit 1), true);
$$;
revoke execute on function private.demo_mode() from public, anon;
grant execute on function private.demo_mode() to authenticated;

-- For the app's sign-in screens (anyone may ask whether this is the demo)
create or replace function public.demo_mode() returns boolean
language sql stable security definer set search_path = '' as $$
  select private.demo_mode();
$$;
revoke execute on function public.demo_mode() from public;
grant execute on function public.demo_mode() to anon, authenticated;

create or replace function private.is_demo_account(p_email text) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(lower(p_email) like '%@demo.gnexa.app', false);
$$;

-- demo_mode only changes from the SQL editor (no signed-in user), i.e. through private.go_live
create or replace function private.guard_demo_switch() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.demo_mode is distinct from old.demo_mode and auth.uid() is not null then
    raise exception 'Demo mode can only be switched off by the owner, from the Supabase SQL editor.';
  end if;
  return new;
end;
$$;
revoke execute on function private.guard_demo_switch() from public, anon, authenticated;
drop trigger if exists company_settings_demo_switch on public.company_settings;
create trigger company_settings_demo_switch before update on public.company_settings
  for each row execute function private.guard_demo_switch();

-- ───────────────────────── Demo accounts can't be broken ─────────────────────────
create or replace function private.guard_demo_profiles() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or private.seeding() or not private.demo_mode() then
    return coalesce(new, old);
  end if;
  if tg_op = 'DELETE' then
    if private.is_demo_account(old.email) then raise exception 'The demo accounts can''t be removed.'; end if;
    return old;
  end if;
  if private.is_demo_account(old.email) then
    if new.is_active is distinct from old.is_active or new.is_admin is distinct from old.is_admin
       or new.role_id is distinct from old.role_id or new.email is distinct from old.email then
      raise exception 'The demo accounts'' access can''t be changed — switch role with the role switcher instead.';
    end if;
  elsif (new.is_active and not old.is_active) or (new.is_admin and not old.is_admin) then
    raise exception 'While the demo is running, only the demo accounts can be active. Go live first to add your own staff.';
  end if;
  return new;
end;
$$;
revoke execute on function private.guard_demo_profiles() from public, anon, authenticated;
drop trigger if exists profiles_demo_guard on public.profiles;
create trigger profiles_demo_guard before update or delete on public.profiles
  for each row execute function private.guard_demo_profiles();

-- Signing in as a demo account must keep working for everyone: quietly ignore e-mail/password changes
create or replace function private.keep_demo_credentials() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if private.is_demo_account(old.email) and private.demo_mode() and not private.seeding() then
    new.email := old.email;
    new.encrypted_password := old.encrypted_password;
  end if;
  return new;
end;
$$;
revoke execute on function private.keep_demo_credentials() from public, anon, authenticated;
drop trigger if exists keep_demo_credentials on auth.users;
create trigger keep_demo_credentials before update on auth.users
  for each row execute function private.keep_demo_credentials();

-- ───────────────────────── Reset: demo only, and restores the roles too ─────────────────────────
do $$ begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'reset_demo_data')
     and not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'private' and p.proname = 'reset_demo_data_core') then
    alter function public.reset_demo_data() rename to reset_demo_data_core;
    alter function public.reset_demo_data_core() set schema private;
  end if;
end $$;
revoke execute on function private.reset_demo_data_core() from public, anon, authenticated;

create or replace function public.reset_demo_data() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.demo_mode() then raise exception 'This CRM is live — demo data can''t be restored.'; end if;
  perform private.reset_demo_data_core();  -- checks the caller is an admin
  update public.roles set permissions = case name
    when 'Sales Manager' then '{"leads":"full","sales":"full","tasks":"full","reports":"full","support":"full","expenses":"full","projects":"full","contracts":"full","customers":"full","knowledge_base":"full"}'::jsonb
    when 'Sales Executive' then '{"leads":"edit","sales":"edit","tasks":"edit","reports":"view","support":"edit","expenses":"edit","projects":"edit","contracts":"edit","customers":"edit","knowledge_base":"view"}'::jsonb
    when 'Support' then '{"leads":"view","sales":"view","tasks":"edit","reports":"view","support":"full","expenses":"none","projects":"view","contracts":"view","customers":"view","knowledge_base":"full"}'::jsonb
    else permissions end
  where name in ('Sales Manager', 'Sales Executive', 'Support');
end;
$$;
revoke execute on function public.reset_demo_data() from public, anon;
grant execute on function public.reset_demo_data() to authenticated;

-- ───────────────────────── Go live (owner only, SQL editor) ─────────────────────────
create or replace function private.go_live(p_owner_email text, p_clear_data boolean default false) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid;
begin
  if auth.uid() is not null then raise exception 'Run this from the Supabase SQL editor.'; end if;
  select id into v_owner from auth.users where lower(email) = lower(trim(p_owner_email));
  if v_owner is null then
    raise exception 'No account for %. Create it first: Supabase → Authentication → Users → Add user.', p_owner_email;
  end if;
  if private.is_demo_account(p_owner_email) then raise exception 'Use your own e-mail address, not a demo account.'; end if;

  perform set_config('gnexa.seeding', 'on', true);  -- no notifications, no demo guards
  insert into public.profiles (id, email, full_name, is_admin, is_active)
  values (v_owner, lower(trim(p_owner_email)), split_part(p_owner_email, '@', 1), true, true)
  on conflict (id) do update set is_admin = true, is_active = true;

  if p_clear_data then
    delete from public.gdpr_requests where true;
    delete from public.survey_responses where true;
    delete from public.posts where true;
    delete from public.estimate_requests where true;
    delete from public.custom_field_values where true;
    delete from public.email_log where true;
    delete from public.notifications where true;
    delete from public.todos where true;
    delete from public.reminders where true;
    delete from public.taggables where true;
    delete from public.task_timers where true;
    delete from public.task_comments where true;
    delete from public.task_checklist_items where true;
    delete from public.task_followers where true;
    delete from public.task_files where true;
    delete from public.goals where true;
    delete from public.announcements where true;
    delete from public.calendar_events where true;
    delete from public.ticket_replies where true;
    delete from public.tickets where true;
    delete from public.kb_articles where true;
    delete from public.contracts where true;
    delete from public.timesheets where true;
    delete from public.project_comments where true;
    delete from public.project_files where true;
    delete from public.task_assignees where true;
    delete from public.tasks where true;
    delete from public.milestones where true;
    delete from public.project_members where true;
    delete from public.credit_applications where true;
    delete from public.payments where true;
    delete from public.expenses where true;
    delete from public.sales_doc_items where true;
    delete from public.sales_docs where true;
    delete from public.subscriptions where true;
    delete from public.projects where true;
    delete from public.items where true;
    delete from public.notes where true;
    delete from public.activity_log where true;
    delete from public.portal_users where true;
    delete from public.contacts where true;
    delete from public.leads where true;
    delete from public.customers where true;
    delete from public.surveys where true;
    delete from public.web_forms where true;
  end if;

  -- Close the demo: accounts deactivated and blocked from signing in, client logins unlinked
  update public.profiles set is_active = false, is_admin = false where private.is_demo_account(email);
  delete from public.portal_users where user_id in (select id from auth.users where private.is_demo_account(email));
  update auth.users set banned_until = 'infinity' where private.is_demo_account(email);
  update public.company_settings set demo_mode = false;
  return format('Live. %s is the administrator; the demo accounts are switched off%s. Sign in at /login.',
                p_owner_email, case when p_clear_data then ' and the demo data is cleared' else '' end);
end;
$$;
revoke execute on function private.go_live(text, boolean) from public, anon, authenticated;
