-- Keep helper functions out of the exposed API schema
create schema if not exists private;
grant usage on schema private to authenticated;

alter function public.is_staff() set schema private;
alter function public.is_admin() set schema private;
revoke execute on function private.is_staff(), private.is_admin() from public, anon;
grant execute on function private.is_staff(), private.is_admin() to authenticated;

alter function public.guard_profile_update() set schema private;
alter function public.handle_new_user() set schema private;
alter function public.stamp_task_completion() set schema private;
revoke execute on function private.guard_profile_update(), private.handle_new_user(), private.stamp_task_completion()
  from public, anon, authenticated;

-- guard_profile_update references is_admin by name
create or replace function private.guard_profile_update() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then
    if new.is_admin is distinct from old.is_admin
       or new.is_active is distinct from old.is_active
       or new.role_id is distinct from old.role_id
       or new.email is distinct from old.email then
      raise exception 'Only administrators can change roles or access';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.convert_lead(p_lead_id bigint) returns bigint
language plpgsql security invoker set search_path = '' as $$
declare
  l public.leads;
  cid bigint;
  won bigint;
begin
  if not private.is_staff() then raise exception 'not allowed'; end if;
  select * into l from public.leads where id = p_lead_id for update;
  if not found then raise exception 'lead not found'; end if;
  if l.converted_customer_id is not null then return l.converted_customer_id; end if;

  insert into public.customers (company, phone, website, address, city, country)
  values (coalesce(nullif(l.company, ''), l.name), l.phone, l.website, l.address, l.city, l.country)
  returning id into cid;

  insert into public.contacts (customer_id, first_name, last_name, email, phone, title, is_primary)
  values (cid, split_part(l.name, ' ', 1), nullif(substr(l.name, length(split_part(l.name, ' ', 1)) + 2), ''),
          l.email, l.phone, l.title, true);

  select id into won from public.lead_statuses where is_won order by sort_order limit 1;
  update public.leads
     set converted_customer_id = cid, converted_at = now(), status_id = coalesce(won, status_id)
   where id = p_lead_id;

  update public.notes set rel_type = 'customer', rel_id = cid where rel_type = 'lead' and rel_id = p_lead_id;

  insert into public.activity_log (rel_type, rel_id, description)
  values ('customer', cid, 'Converted from lead "' || l.name || '"');
  return cid;
end;
$$;

create schema if not exists extensions;
alter extension pg_trgm set schema extensions;
