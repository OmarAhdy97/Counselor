-- ====================================================================
-- 002: ملف كل مستشار (الاسم، الفرع، إعدادات تقويم جوجل)
-- كل مستشار له صف واحد يُنشأ تلقائياً عند التسجيل (بالإيميل أو بجوجل).
-- ====================================================================

create table if not exists public.profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  full_name           text,
  branch              text,
  email               text,
  google_calendar_id  text,                       -- تقويم «أجندة المستشار» في جوجل
  calendar_sync       boolean not null default false,
  reminder_minutes    int not null default 360 check (reminder_minutes between 0 and 40320),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "own profile read" on public.profiles;
create policy "own profile read" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);

drop policy if exists "own profile update" on public.profiles;
create policy "own profile update" on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

revoke all on public.profiles from anon;
grant select, update on public.profiles to authenticated;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
for each row execute function public.agenda_touch_updated_at();

-- إنشاء الملف تلقائياً. جوجل يرسل الاسم في full_name أو name.
create or replace function public.handle_new_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end $$;

revoke execute on function public.handle_new_profile() from public, anon, authenticated;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute function public.handle_new_profile();

-- المستخدمون الموجودون قبل هذا الملف
insert into public.profiles (id, full_name, email)
select id, coalesce(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name'), email
from auth.users
on conflict (id) do nothing;
