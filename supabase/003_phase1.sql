-- ====================================================================
-- 003: المرحلة الأولى — الدوائر، الأرشيف، تحت الرفع، الطعن، المرفقات
-- ====================================================================

-- 1) الدوائر: لكل مستشار دوائره وأيام انعقادها
create table if not exists public.agenda_circuits (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  court          text not null,
  name           text not null,                -- مثال: الدائرة 3 مدني
  weekday        int  check (weekday between 0 and 6),          -- 0 = الأحد … 6 = السبت
  period         text check (period in ('صباحي', 'مسائي')),
  appeal_weekday int  check (appeal_weekday between 0 and 6),   -- يوم جلسات الاستئناف إن وجد
  notes          text,
  created_at     timestamptz not null default now(),
  unique (user_id, court, name)
);

alter table public.agenda_circuits enable row level security;
drop policy if exists "own circuits" on public.agenda_circuits;
create policy "own circuits" on public.agenda_circuits
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
revoke all on public.agenda_circuits from anon;
grant select, insert, update, delete on public.agenda_circuits to authenticated;

-- 2) أعمدة جديدة على القضايا
alter table public.agenda_cases
  add column if not exists circuit_id      uuid references public.agenda_circuits(id) on delete set null,
  add column if not exists archived_at     timestamptz,   -- محفوظة في الأرشيف (يمكن إلغاء الحفظ)
  add column if not exists ruling_number   text,          -- رقم قيد الحكم
  add column if not exists appeal_decision text,          -- طعن / عدم طعن
  add column if not exists appeal_note     text;

-- «تحت الرفع»: ملف لم يُقيَّد بعد، فلا رقم ولا سنة حتى الآن
alter table public.agenda_cases alter column case_number drop not null;
alter table public.agenda_cases alter column case_year   drop not null;
alter table public.agenda_cases drop constraint if exists agenda_cases_number_required;
alter table public.agenda_cases add constraint agenda_cases_number_required
  check (status = 'تحت الرفع' or (case_number is not null and case_year is not null));

create index if not exists agenda_cases_user_archived_idx on public.agenda_cases (user_id, archived_at);
create index if not exists agenda_cases_circuit_idx on public.agenda_cases (circuit_id);
create index if not exists agenda_sessions_user_date_idx on public.agenda_sessions (user_id, session_date);

-- 3) المرفقات (مذكرات، صورة حكم، رأي…) في Storage خاص؛ المسار يبدأ بمعرّف المستخدم
create table if not exists public.agenda_attachments (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  case_id     uuid not null references public.agenda_cases(id) on delete cascade,
  kind        text,                 -- مذكرة دفاع / رأي / صورة حكم / أخرى
  name        text not null,
  path        text not null unique, -- {user_id}/{case_id}/{uuid}-{name}
  size        bigint,
  mime        text,
  created_at  timestamptz not null default now()
);
create index if not exists agenda_attachments_case_idx on public.agenda_attachments (case_id);

alter table public.agenda_attachments enable row level security;
drop policy if exists "own attachments" on public.agenda_attachments;
create policy "own attachments" on public.agenda_attachments
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.agenda_cases c where c.id = case_id and c.user_id = (select auth.uid()))
  );
revoke all on public.agenda_attachments from anon;
grant select, insert, update, delete on public.agenda_attachments to authenticated;

insert into storage.buckets (id, name, public, file_size_limit)
values ('case-files', 'case-files', false, 20971520)   -- 20 MB لكل ملف
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

drop policy if exists "case-files own read"   on storage.objects;
drop policy if exists "case-files own write"  on storage.objects;
drop policy if exists "case-files own delete" on storage.objects;
create policy "case-files own read" on storage.objects for select to authenticated
  using (bucket_id = 'case-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "case-files own write" on storage.objects for insert to authenticated
  with check (bucket_id = 'case-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "case-files own delete" on storage.objects for delete to authenticated
  using (bucket_id = 'case-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
