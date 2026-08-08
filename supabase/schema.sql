-- ============================================================
-- 法语学习伴侣 · Supabase 数据库脚本
-- 在 Supabase 控制台 → SQL Editor 中粘贴并运行（Run）
-- ============================================================

-- 1) 用户学习记录表：每个用户一行一个 key（生词本/闪卡/历史/路径进度/教材解析）
create table if not exists public.user_data (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (user_id, key)
);

-- 2) 建立索引，加速按用户查询
create index if not exists user_data_user_id_idx on public.user_data (user_id);

-- 3) 开启行级安全（RLS）：用户只能读写自己的数据
alter table public.user_data enable row level security;

drop policy if exists "own_data_select" on public.user_data;
drop policy if exists "own_data_insert" on public.user_data;
drop policy if exists "own_data_update" on public.user_data;
drop policy if exists "own_data_delete" on public.user_data;

create policy "own_data_select" on public.user_data
  for select using (auth.uid() = user_id);

create policy "own_data_insert" on public.user_data
  for insert with check (auth.uid() = user_id);

create policy "own_data_update" on public.user_data
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own_data_delete" on public.user_data
  for delete using (auth.uid() = user_id);

-- 4) 允许匿名用户注册（Auth 默认开启）；若想只允许注册用户访问，可加下面策略：
-- create policy "only_authenticated_read" on public.user_data
--   for select using (auth.role() = 'authenticated');

-- ============================================================
-- 教材存储（Supabase Storage，跨设备恢复）
-- 在 Supabase 后台 SQL Editor 执行本段：
--   1) 创建私有桶 textbooks
--   2) RLS：每个用户只能读写自己 user/<uid>/ 目录下的文件
--   3) 另请在 Supabase 后台 → Storage → Settings 把「最大文件大小」
--      调到 200MB（教材约 145MB，免费额度默认 50MB 会传不上去）
-- ============================================================
insert into storage.buckets (id, name, public)
values ('textbooks', 'textbooks', false)
on conflict (id) do nothing;

drop policy if exists "textbooks_select_own" on storage.objects;
create policy "textbooks_select_own" on storage.objects
  for select using (bucket_id = 'textbooks' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "textbooks_insert_own" on storage.objects;
create policy "textbooks_insert_own" on storage.objects
  for insert with check (bucket_id = 'textbooks' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "textbooks_update_own" on storage.objects;
create policy "textbooks_update_own" on storage.objects
  for update using (bucket_id = 'textbooks' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "textbooks_delete_own" on storage.objects;
create policy "textbooks_delete_own" on storage.objects
  for delete using (bucket_id = 'textbooks' and (storage.foldername(name))[1] = auth.uid()::text);
