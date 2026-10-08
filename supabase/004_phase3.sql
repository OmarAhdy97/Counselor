-- ====================================================================
-- 004: المرحلة الثالثة — دليل المحاكم والجهات، ومكتبة التشريعات الشخصية
-- كل مستشار يضيف بياناته بنفسه؛ لا يوجد محتوى عام مشترك.
-- ====================================================================

-- 1) الدليل: محاكم، أقلام محضرين، جهات تنوب عنها الهيئة، أخرى
create table if not exists public.agenda_directory (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind       text not null check (kind in ('محكمة', 'محضرين', 'جهة', 'أخرى')),
  name       text not null,
  parent     text,            -- المحكمة التابع لها قلم المحضرين، أو الجهة الأم
  address    text,
  phone      text,
  notes      text,
  created_at timestamptz not null default now(),
  unique (user_id, kind, name)
);

alter table public.agenda_directory enable row level security;
drop policy if exists "own directory" on public.agenda_directory;
create policy "own directory" on public.agenda_directory
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
revoke all on public.agenda_directory from anon;
grant select, insert, update, delete on public.agenda_directory to authenticated;

-- 2) التشريعات: يلصق المستشار نص القانون أو يرفعه، فيُقسَّم إلى مواد ويصبح قابلاً للبحث
create table if not exists public.agenda_laws (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title      text not null,
  note       text,            -- المصدر أو ملاحظة (الوقائع المصرية، سنة التعديل…)
  articles   jsonb not null default '[]'::jsonb,   -- [{ "n": "12", "text": "…" }]
  article_count int not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, title)
);

alter table public.agenda_laws enable row level security;
drop policy if exists "own laws" on public.agenda_laws;
create policy "own laws" on public.agenda_laws
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
revoke all on public.agenda_laws from anon;
grant select, insert, update, delete on public.agenda_laws to authenticated;
