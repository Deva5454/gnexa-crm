-- Gnexa CRM — Dashboard options (batch 9)
--
-- Each staff member arranges their own dashboard (Perfex "Dashboard options"): which widgets show and in
-- what order. Stored on their profile as { "order": [widget keys…], "hidden": [widget keys…] }.
-- Staff already update their own profile row (profiles_update_self), so no new policy is needed.

alter table public.profiles add column if not exists dashboard_config jsonb not null default '{}'::jsonb;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_dashboard_config_check') then
    alter table public.profiles add constraint profiles_dashboard_config_check
      check (jsonb_typeof(dashboard_config) = 'object' and pg_column_size(dashboard_config) < 8192);
  end if;
end $$;
