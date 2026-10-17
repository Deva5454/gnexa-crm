-- Gnexa CRM — Knowledge base parity with Perfex (batch 20)
--
--   • Internal articles: staff only, never shown in the client portal or the public help center
--   • Article order within a group (Perfex sorts by its "article order", then by name)
--   • Groups get a colour and can be switched off (their articles leave the portal and public help center)
--   • Public help center at /help, for visitors who aren't signed in — off by default (Setup → Support).
--     Visitors only reach it through the functions below; the tables stay closed to anonymous users.

alter table public.kb_articles add column if not exists is_internal boolean not null default false;
alter table public.kb_articles add column if not exists position int not null default 0;
alter table public.kb_groups add column if not exists color text not null default '#0d9488' check (color ~ '^#[0-9a-fA-F]{6}$');
alter table public.kb_groups add column if not exists is_active boolean not null default true;
alter table public.company_settings add column if not exists kb_public boolean not null default false;

-- Portal: published, customer-facing articles in active groups only
drop policy if exists kb_articles_portal on public.kb_articles;
create policy kb_articles_portal on public.kb_articles for select to authenticated
  using (is_published and not is_internal and (select private.portal_customer()) is not null
         and (group_id is null or group_id in (select id from public.kb_groups where is_active)));
drop policy if exists kb_groups_portal on public.kb_groups;
create policy kb_groups_portal on public.kb_groups for select to authenticated
  using (is_active and (select private.portal_customer()) is not null);

-- ───────────────────────── Public help center ─────────────────────────
create or replace function public.public_kb(p_q text default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  term text := nullif(trim(coalesce(p_q, '')), '');
begin
  if not coalesce((select kb_public from public.company_settings limit 1), false) then return null; end if;
  term := left(replace(replace(replace(term, '\', ''), '%', ''), '_', ''), 80);
  return jsonb_build_object(
    'company', (select company_name from public.company_settings limit 1),
    'groups', coalesce((select jsonb_agg(jsonb_build_object('id', g.id, 'name', g.name, 'description', g.description, 'color', g.color) order by g.position, g.name)
                          from public.kb_groups g where g.is_active), '[]'::jsonb),
    'articles', coalesce((select jsonb_agg(jsonb_build_object('title', a.title, 'slug', a.slug, 'group_id', a.group_id, 'excerpt', left(a.body, 160)) order by a.position, a.views desc, a.title)
                            from public.kb_articles a
                           where a.is_published and not a.is_internal
                             and (a.group_id is null or a.group_id in (select id from public.kb_groups where is_active))
                             and (term is null or a.title ilike '%' || term || '%' or a.body ilike '%' || term || '%')), '[]'::jsonb));
end;
$$;

create or replace function public.public_kb_article(p_slug text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare a public.kb_articles;
begin
  if not coalesce((select kb_public from public.company_settings limit 1), false) then return null; end if;
  select * into a from public.kb_articles
   where slug = p_slug and is_published and not is_internal
     and (group_id is null or group_id in (select id from public.kb_groups where is_active));
  if a.id is null then return null; end if;
  return jsonb_build_object(
    'id', a.id, 'title', a.title, 'body', a.body, 'updated_at', a.updated_at,
    'company', (select company_name from public.company_settings limit 1),
    'group', (select jsonb_build_object('id', g.id, 'name', g.name, 'color', g.color) from public.kb_groups g where g.id = a.group_id),
    'related', coalesce((select jsonb_agg(jsonb_build_object('title', r.title, 'slug', r.slug) order by r.position, r.views desc)
                           from (select * from public.kb_articles r
                                  where r.group_id = a.group_id and r.id <> a.id and r.is_published and not r.is_internal
                                  order by r.position, r.views desc limit 5) r), '[]'::jsonb));
end;
$$;

-- Views and votes from the public help center (only for articles it shows)
create or replace function public.public_kb_track(p_slug text, p_event text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_event not in ('view', 'yes', 'no') then return; end if;
  if not coalesce((select kb_public from public.company_settings limit 1), false) then return; end if;
  update public.kb_articles set
    views       = views       + (p_event = 'view')::int,
    helpful     = helpful     + (p_event = 'yes')::int,
    not_helpful = not_helpful + (p_event = 'no')::int
  where slug = p_slug and is_published and not is_internal;
end;
$$;

revoke execute on function public.public_kb(text) from public;
revoke execute on function public.public_kb_article(text) from public;
revoke execute on function public.public_kb_track(text, text) from public;
grant execute on function public.public_kb(text) to anon, authenticated;
grant execute on function public.public_kb_article(text) to anon, authenticated;
grant execute on function public.public_kb_track(text, text) to anon, authenticated;

-- Clients only count views and votes on articles they can actually see
create or replace function public.kb_track(p_article bigint, p_event text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_staff() and private.portal_customer() is null then raise exception 'not allowed'; end if;
  update public.kb_articles set
    views       = views       + (p_event = 'view')::int,
    helpful     = helpful     + (p_event = 'yes')::int,
    not_helpful = not_helpful + (p_event = 'no')::int
  where id = p_article and is_published and (private.is_staff() or not is_internal);
end;
$$;
