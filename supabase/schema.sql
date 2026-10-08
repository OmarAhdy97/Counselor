-- ====================================================================
-- أجندة المستشار — قاعدة البيانات (Supabase project: jpehrfddmdmgefjfzzyw)
-- كل مستخدم يرى ويعدّل بياناته فقط (RLS على user_id).
-- الجداول القديمة counselor_* لا يمسّها هذا الملف.
-- ====================================================================

create extension if not exists pgcrypto;

-- 1) القضايا: صف لكل دعوى (يقابل صف في شيت الإكسيل)
create table if not exists public.agenda_cases (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  court           text not null,
  case_number     text not null,
  case_year       int  not null check (case_year between 1900 and 2200),
  plaintiff       text,
  defendant       text,
  case_type       text,
  status          text,                 -- متداول / محجوز للحكم / متابعة / شطب / حفظ / محكوم فيه / إحالة ...
  next_session    date,                 -- "تاريخ الجلسة" في الشيت
  last_decision   text,                 -- "القرار" في الشيت (قرار آخر جلسة)
  ruling_text     text,                 -- منطوق الحكم
  ruling_date     date,
  ruling_outcome  text,                 -- صالح / ضد / شطب / اختصاص نوعي / حفظ / إحالة
  appeal_deadline date,                 -- آخر ميعاد للطعن (تقديري)
  notes           text,                 -- الملاحظات الهامة
  copy_numbers    text,                 -- رقم النسخ
  memos           text,                 -- المذكرات ورقم النسخ
  followup_date   date,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id, court, case_number, case_year)
);

-- 2) سجل الجلسات: صف لكل جلسة انعقدت وقرارها
create table if not exists public.agenda_sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  case_id      uuid not null references public.agenda_cases(id) on delete cascade,
  session_date date not null,
  decision     text,
  next_date    date,
  created_at   timestamptz not null default now()
);

create index if not exists agenda_cases_user_next_idx     on public.agenda_cases (user_id, next_session);
create index if not exists agenda_cases_user_followup_idx on public.agenda_cases (user_id, followup_date);
create index if not exists agenda_sessions_case_idx       on public.agenda_sessions (case_id, session_date desc);
create index if not exists agenda_sessions_user_idx       on public.agenda_sessions (user_id);

-- updated_at تلقائي
create or replace function public.agenda_touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists agenda_cases_touch on public.agenda_cases;
create trigger agenda_cases_touch before update on public.agenda_cases
for each row execute function public.agenda_touch_updated_at();

-- RLS: صاحب البيانات فقط
alter table public.agenda_cases    enable row level security;
alter table public.agenda_sessions enable row level security;

drop policy if exists "own cases" on public.agenda_cases;
create policy "own cases" on public.agenda_cases
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "own sessions" on public.agenda_sessions;
create policy "own sessions" on public.agenda_sessions
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.agenda_cases c where c.id = case_id and c.user_id = (select auth.uid()))
  );

-- لا وصول لغير المسجّلين
revoke all on public.agenda_cases, public.agenda_sessions from anon;
grant select, insert, update, delete on public.agenda_cases, public.agenda_sessions to authenticated;
