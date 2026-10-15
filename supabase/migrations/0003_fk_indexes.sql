-- Cover foreign keys
create index if not exists activity_actor_idx      on public.activity_log(actor_id);
create index if not exists customers_created_by_idx on public.customers(created_by);
create index if not exists customers_group_idx      on public.customers(group_id);
create index if not exists leads_converted_idx      on public.leads(converted_customer_id);
create index if not exists leads_created_by_idx     on public.leads(created_by);
create index if not exists leads_source_idx         on public.leads(source_id);
create index if not exists notes_created_by_idx     on public.notes(created_by);
create index if not exists profiles_role_idx        on public.profiles(role_id);
create index if not exists tasks_created_by_idx     on public.tasks(created_by);
