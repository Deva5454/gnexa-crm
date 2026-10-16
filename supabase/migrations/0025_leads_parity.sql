-- Gnexa CRM — Leads parity with Perfex (batch 10)
--
--   • State and ZIP on leads (Perfex's lead address fields)
--   • Lead attachments: lead_files + a private "lead-files" storage bucket, following the leads permission
--     (view to download, edit to upload; the uploader or someone with full access removes a file)

alter table public.leads add column if not exists state text;
alter table public.leads add column if not exists zip text;

create table if not exists public.lead_files (
  id           bigint generated always as identity primary key,
  lead_id      bigint not null references public.leads(id) on delete cascade,
  name         text not null,
  path         text not null unique,
  size         bigint not null default 0,
  mime         text,
  uploaded_by  uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now()
);
create index if not exists lead_files_lead_idx on public.lead_files(lead_id);
create index if not exists lead_files_uploaded_by_idx on public.lead_files(uploaded_by);
alter table public.lead_files enable row level security;

drop policy if exists lead_files_staff_read on public.lead_files;
drop policy if exists lead_files_staff_insert on public.lead_files;
drop policy if exists lead_files_staff_delete on public.lead_files;
create policy lead_files_staff_read on public.lead_files for select to authenticated
  using ((select private.has_perm('leads', 'view')));
create policy lead_files_staff_insert on public.lead_files for insert to authenticated
  with check ((select private.has_perm('leads', 'edit')) and uploaded_by = (select auth.uid()));
create policy lead_files_staff_delete on public.lead_files for delete to authenticated
  using ((select private.has_perm('leads', 'full')) or (uploaded_by = (select auth.uid()) and (select private.has_perm('leads', 'edit'))));

insert into storage.buckets (id, name, public, file_size_limit)
values ('lead-files', 'lead-files', false, 10485760)
on conflict (id) do nothing;

drop policy if exists lead_files_read on storage.objects;
drop policy if exists lead_files_write on storage.objects;
drop policy if exists lead_files_remove on storage.objects;
create policy lead_files_read on storage.objects for select to authenticated
  using (bucket_id = 'lead-files' and (select private.has_perm('leads', 'view')));
create policy lead_files_write on storage.objects for insert to authenticated
  with check (bucket_id = 'lead-files' and (select private.has_perm('leads', 'edit')));
create policy lead_files_remove on storage.objects for delete to authenticated
  using (bucket_id = 'lead-files' and ((select private.has_perm('leads', 'full')) or (owner_id = (select auth.uid())::text and (select private.has_perm('leads', 'edit')))));
