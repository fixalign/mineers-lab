-- Enable RLS on lab tables
alter table public.lab_patients enable row level security;
alter table public.lab_files enable row level security;

-- Add status column for case workflow
do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'lab_patients'
      and column_name = 'status'
  ) then
    alter table public.lab_patients
      add column status text not null default 'draft' check (status in ('draft','sent','done'));
  end if;
end $$;

-- Allow Mineers to manage their own cases
create policy "mineers_can_manage_cases"
on public.lab_patients
for all
using (auth.uid() = created_by)
with check (auth.uid() = created_by);

-- Allow lab users to read all cases
create policy "lab_can_read_all_cases"
on public.lab_patients
for select
using (
  exists (
    select 1 from auth.users u
    where u.id = auth.uid() and u.raw_user_meta_data->>'role' = 'lab'
  )
);

-- Allow lab users to mark cases as done
create policy "lab_can_mark_done"
on public.lab_patients
for update
using (
  exists (
    select 1 from auth.users u
    where u.id = auth.uid() and u.raw_user_meta_data->>'role' = 'lab'
  )
)
with check (
  exists (
    select 1 from auth.users u
    where u.id = auth.uid() and u.raw_user_meta_data->>'role' = 'lab'
  )
);

-- Mineers can manage their own files
create policy "mineers_manage_files"
on public.lab_files
for all
using (
  exists (
    select 1 from public.lab_patients p
    where p.id = patient_id and p.created_by = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.lab_patients p
    where p.id = patient_id and p.created_by = auth.uid()
  )
);

-- Lab can read all files
create policy "lab_read_all_files"
on public.lab_files
for select
using (
  exists (
    select 1 from auth.users u
    where u.id = auth.uid() and u.raw_user_meta_data->>'role' = 'lab'
  )
);



