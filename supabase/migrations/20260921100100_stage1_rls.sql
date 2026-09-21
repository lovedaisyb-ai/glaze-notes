-- 1단계 RLS (CLAUDE.md 5장)
--   private : 소유자만 읽기·쓰기
--   members : 로그인 사용자 읽기, 소유자만 쓰기
--   public  : 누구나 읽기, 소유자만 쓰기
--   시드(owner_id null): 누구나 읽기, 쓰기 불가 (시드는 비밀 키로만 넣음)

-- 이 행을 지금 사용자가 읽을 수 있는가
create function public.can_read(vis public.visibility, owner uuid) returns boolean
language sql stable set search_path = '' as $$
  select owner = (select auth.uid())
      or vis = 'public'
      or (vis = 'members' and (select auth.uid()) is not null)
$$;

alter table public.profiles        enable row level security;
alter table public.studios         enable row level security;
alter table public.kilns           enable row level security;
alter table public.materials       enable row level security;
alter table public.recipes         enable row level security;
alter table public.recipe_lines    enable row level security;
alter table public.recipe_warnings enable row level security;
alter table public.tests           enable row level security;
alter table public.test_photos     enable row level security;

-- profiles: 1단계에서는 본인만
create policy "본인 프로필 읽기" on public.profiles for select to authenticated
  using (user_id = (select auth.uid()));
create policy "본인 프로필 고치기" on public.profiles for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- studios · kilns: 1단계에서는 본인만
create policy "본인 공방" on public.studios for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

create policy "본인 가마" on public.kilns for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and (studio_id is null or exists (
      select 1 from public.studios s where s.id = studio_id and s.owner_id = (select auth.uid())))
  );

-- materials: 시드 원료는 누구나 읽기, 직접 입력한 원료는 본인만
create policy "원료 읽기" on public.materials for select to anon, authenticated
  using (owner_id is null or owner_id = (select auth.uid()));
create policy "본인 원료 쓰기" on public.materials for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy "본인 원료 고치기" on public.materials for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "본인 원료 지우기" on public.materials for delete to authenticated
  using (owner_id = (select auth.uid()));

-- recipes: 공개 범위대로 읽기, 소유자만 쓰기 (시드는 owner_id가 없어 아무도 못 씀)
create policy "레시피 읽기" on public.recipes for select to anon, authenticated
  using (public.can_read(visibility, owner_id));
create policy "본인 레시피 쓰기" on public.recipes for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy "본인 레시피 고치기" on public.recipes for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "본인 레시피 지우기" on public.recipes for delete to authenticated
  using (owner_id = (select auth.uid()));

-- recipe_lines · recipe_warnings: 레시피를 따라감
create policy "레시피 줄 읽기" on public.recipe_lines for select to anon, authenticated
  using (exists (select 1 from public.recipes r
                 where r.id = recipe_id and public.can_read(r.visibility, r.owner_id)));
create policy "본인 레시피 줄 쓰기" on public.recipe_lines for all to authenticated
  using (exists (select 1 from public.recipes r
                 where r.id = recipe_id and r.owner_id = (select auth.uid())))
  with check (
    exists (select 1 from public.recipes r where r.id = recipe_id and r.owner_id = (select auth.uid()))
    and exists (select 1 from public.materials m
                where m.id = material_id and (m.owner_id is null or m.owner_id = (select auth.uid())))
  );

create policy "경고 읽기" on public.recipe_warnings for select to anon, authenticated
  using (exists (select 1 from public.recipes r
                 where r.id = recipe_id and public.can_read(r.visibility, r.owner_id)));
create policy "본인 레시피 경고 쓰기" on public.recipe_warnings for all to authenticated
  using (exists (select 1 from public.recipes r
                 where r.id = recipe_id and r.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.recipes r
                      where r.id = recipe_id and r.owner_id = (select auth.uid())));

-- tests (시편): 공개 범위대로 읽기, 소유자만 쓰기.
-- 읽을 수 있는 레시피에만, 내 가마로만 기록할 수 있음
create policy "시편 읽기" on public.tests for select to anon, authenticated
  using (public.can_read(visibility, owner_id));
create policy "본인 시편 쓰기" on public.tests for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.recipes r
                where r.id = recipe_id and public.can_read(r.visibility, r.owner_id))
    and (kiln_id is null or exists (
      select 1 from public.kilns k where k.id = kiln_id and k.owner_id = (select auth.uid())))
  );
create policy "본인 시편 고치기" on public.tests for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    -- 레시피가 지워져 비어 있는 기록도 메모·사진은 고칠 수 있게
    and (recipe_id is null or exists (select 1 from public.recipes r
                where r.id = recipe_id and public.can_read(r.visibility, r.owner_id)))
    and (kiln_id is null or exists (
      select 1 from public.kilns k where k.id = kiln_id and k.owner_id = (select auth.uid())))
  );
create policy "본인 시편 지우기" on public.tests for delete to authenticated
  using (owner_id = (select auth.uid()));

-- test_photos: 시편을 따라감. 사진 경로는 내 폴더(<user_id>/...)여야 함
create policy "시편 사진 읽기" on public.test_photos for select to anon, authenticated
  using (exists (select 1 from public.tests t
                 where t.id = test_id and public.can_read(t.visibility, t.owner_id)));
create policy "본인 시편 사진 쓰기" on public.test_photos for all to authenticated
  using (exists (select 1 from public.tests t
                 where t.id = test_id and t.owner_id = (select auth.uid())))
  with check (
    exists (select 1 from public.tests t where t.id = test_id and t.owner_id = (select auth.uid()))
    and storage_path like (select auth.uid())::text || '/%'
  );
