-- 1단계 테이블 (CLAUDE.md 5장). 모든 테이블에 id uuid, created_at, updated_at.

create type public.visibility as enum ('private', 'members', 'public');
create type public.trust_level as enum ('sourced', 'tested', 'unverified');
create type public.kiln_type as enum ('electric', 'gas', 'wood', 'other');
create type public.material_category as enum ('feldspar', 'silica', 'flux', 'clay', 'color');
create type public.application_method as enum ('dip', 'brush', 'spray', 'pour', 'other'); -- 담금·붓·분무·부어 바르기·기타

create function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- 사용자 정보 (auth.users와 1:1)
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  display_name text,
  region text, -- 시·구까지만
  bio text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 공방 (화면 노출은 2단계부터)
create table public.studios (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  address text,
  address_public boolean not null default false,
  offers_class boolean not null default false,
  offers_share boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.kilns (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  studio_id uuid references public.studios (id) on delete set null,
  type public.kiln_type not null,
  name text not null,
  capacity_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 원료. owner_id가 없으면 시드(모두 공용), 있으면 사용자가 직접 입력한 원료
create table public.materials (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users (id) on delete cascade,
  name_ko text not null,
  aliases text[] not null default '{}',
  category public.material_category not null,
  analysis_json jsonb,
  safety_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index materials_seed_name on public.materials (name_ko) where owner_id is null;
create unique index materials_owner_name on public.materials (owner_id, name_ko) where owner_id is not null;

-- 레시피. owner_id가 없으면 시드 레시피 (항상 public, 쓰기 불가)
create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users (id) on delete cascade,
  slug text unique,          -- 옛 사이트 id (celadon 등). 시드 레시피 주소용
  name text not null,
  hanja text,
  atmosphere text,
  temp_text text,
  temp_min_c integer,
  surface text,
  note text,
  source_text text,
  source_url text,
  trust public.trust_level not null default 'unverified',
  visibility public.visibility not null default 'private',
  art jsonb,                 -- 시편 그림 색 (사진이 없을 때의 자리표시)
  sort integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recipes_sourced_needs_source check (trust <> 'sourced' or source_text is not null),
  constraint recipes_seed_is_public check (owner_id is not null or visibility = 'public'),
  constraint recipes_slug_seed_only check (owner_id is null or slug is null)
);

create table public.recipe_lines (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  -- no action: 쓰이는 원료는 지울 수 없음. 회원 탈퇴 때는 레시피 줄과 원료가 한 번에 지워지므로
  -- 문장 끝에서 검사하는 no action이어야 함 (restrict는 지우는 순서에 따라 탈퇴가 실패할 수 있음)
  material_id uuid not null references public.materials (id),
  pct numeric(8, 3) not null check (pct > 0),
  is_addition boolean not null default false,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.recipe_warnings (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  label text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 시편 기록 (1단계의 핵심 기록 단위)
create table public.tests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  -- 레시피가 지워져도 시편 기록은 남김 (다른 사람의 공개 레시피로 구운 기록 등).
  -- 시편 기록이 있는 레시피는 보통 지울 수 없음: 아래 block_recipe_delete_with_tests
  recipe_id uuid references public.recipes (id) on delete set null,
  kiln_id uuid references public.kilns (id) on delete set null,
  clay_body text,
  application public.application_method,
  thickness_text text,
  atmosphere text,
  cone_or_temp text,
  schedule_text text,
  result_note text,
  fired_on date,
  visibility public.visibility not null default 'private',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.test_photos (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.tests (id) on delete cascade,
  storage_path text not null unique, -- test-photos 버킷 안 경로: <user_id>/<test_id>/<파일>
  caption text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 외래 키·소유자 색인
create index on public.studios (owner_id);
create index on public.kilns (owner_id);
create index on public.kilns (studio_id);
create index on public.recipes (owner_id);
create index on public.recipe_lines (recipe_id);
create index on public.recipe_lines (material_id);
create index on public.recipe_warnings (recipe_id);
create index on public.tests (owner_id);
create index on public.tests (recipe_id);
create index on public.tests (kiln_id);
create index on public.test_photos (test_id);

-- updated_at 자동 갱신
do $$
declare t text;
begin
  foreach t in array array['profiles','studios','kilns','materials','recipes','recipe_lines',
                           'recipe_warnings','tests','test_photos'] loop
    execute format('create trigger set_updated_at before update on public.%I
                    for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- 가입하면 빈 프로필을 하나 만듭니다
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (user_id) values (new.id);
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- 사용자는 신뢰 등급을 'tested'로 직접 올릴 수 없습니다 (구워 본 기록으로만 — 2단계 자동 갱신)
create function public.guard_recipe_trust() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.trust = 'tested'
     and (tg_op = 'INSERT' or old.trust is distinct from 'tested')
     and coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
     and current_user not in ('postgres', 'service_role') then
    raise exception '신뢰 등급 tested는 시편 기록으로만 정해집니다.';
  end if;
  return new;
end $$;

create trigger guard_recipe_trust before insert or update of trust on public.recipes
  for each row execute function public.guard_recipe_trust();

-- 시편 기록이 있는 레시피는 지울 수 없습니다 (화면에서 이유를 보여 줌).
-- 예외: 회원 탈퇴로 레시피 주인이 사라지는 경우. 이때 주인의 시편은 함께 지워지고,
-- 다른 사람이 이 레시피로 남긴 시편은 recipe_id만 비운 채 남습니다.
-- 시드 레시피(주인 없음)는 시편 기록이 있으면 늘 지울 수 없습니다.
create function public.block_recipe_delete_with_tests() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.tests t where t.recipe_id = old.id)
     and (old.owner_id is null
          or exists (select 1 from auth.users u where u.id = old.owner_id)) then
    raise exception '이 레시피로 구운 시편 기록이 있어 지울 수 없습니다.'
      using detail = 'recipe_has_tests',
            hint = '시편 기록을 먼저 지우거나, 레시피를 비공개로 두세요.';
  end if;
  return old;
end $$;

create trigger block_recipe_delete_with_tests before delete on public.recipes
  for each row execute function public.block_recipe_delete_with_tests();
