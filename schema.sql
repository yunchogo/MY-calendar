-- ============================================================
-- Bboggl · Supabase DB 스키마
-- Supabase 대시보드 → SQL Editor에 붙여넣고 실행하세요.
-- ============================================================

-- 확장 기능: UUID 자동 생성
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- 1. profiles — 로그인한 사용자 1명당 1행. auth.users와 1:1 연결
--    (캘린더 이름, 테마, 구독 플랜, 알림 설정 등 개인 설정 저장)
-- ------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  calendar_name text not null default '나의 캘린더',
  point_color text not null default '#4A154B',
  bg_color text not null default '#FAFAFB',
  border_color text not null default '#E8E8E8',
  active_template_id text,                 -- 'minimal' | 'sage' | 'bold' | 'stripe' | null
  calendar_bg_image_url text,               -- Storage에 올린 배경 이미지 URL
  subscription_plan text not null default 'free'
    check (subscription_plan in ('free', 'basic', 'premium')),
  image_format text not null default 'circle'
    check (image_format in ('circle', 'text', 'block')),
  push_enabled boolean not null default false,
  push_lead_minutes int not null default 10,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 2. events — 캘린더의 일정 하나하나 (반복 일정 / 특별 일정 모두 포함)
--    프론트엔드 entries 배열과 1:1로 대응돼요
-- ------------------------------------------------------------
create table public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('recurring', 'special')),
  days_of_week int[],                       -- 반복 일정: 예) {1,2,3,4,5} = 월~금 (0=일 ... 6=토)
  event_date date,                          -- 특별 일정: 정확한 날짜
  start_minutes int,                        -- 0~1439, 자정부터 몇 분 후. 시간 미지정 시 null
  end_minutes int,
  label text not null default '제목 없음',
  color text,
  raw_text text,                            -- 사용자가 원래 입력한 문장 (사이드바 목록 표시용)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_type_fields check (
    (type = 'recurring' and days_of_week is not null and event_date is null)
    or
    (type = 'special' and event_date is not null and days_of_week is null)
  )
);

create index idx_events_user on public.events(user_id);
create index idx_events_date on public.events(event_date);

-- ------------------------------------------------------------
-- 3. event_overrides — 반복 일정의 "이 날짜만 예외" 처리
--    (상세보기에서 드래그로 시간 조정 시 "이 날짜만 적용" 선택했을 때,
--     또는 텍스트 명령으로 "28일 회사 쉬어" 같은 걸 처리할 때 사용)
-- ------------------------------------------------------------
create table public.event_overrides (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  override_date date not null,
  start_minutes int,
  end_minutes int,
  skip boolean not null default false,      -- true면 이 날짜엔 표시 안 함 (일정 쉬는 날)
  created_at timestamptz not null default now(),
  unique (event_id, override_date)
);

create index idx_overrides_user on public.event_overrides(user_id);

-- ------------------------------------------------------------
-- 4. cell_decorations — 특정 날짜 칸의 커스텀 배경색 / 붙인 사진
-- ------------------------------------------------------------
create table public.cell_decorations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  cell_date date not null,
  color text,
  image_url text,                           -- Storage에 올린 이미지 URL
  created_at timestamptz not null default now(),
  unique (user_id, cell_date)
);

create index idx_decorations_user on public.cell_decorations(user_id);

-- ============================================================
-- Row Level Security (RLS) — "내 데이터는 나만 볼 수 있게" 강제하는 핵심 설정
-- 이걸 켜지 않으면 anon key를 아는 누구나 모든 사용자의 데이터를 읽을 수 있어요!
-- ============================================================

alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.event_overrides enable row level security;
alter table public.cell_decorations enable row level security;

-- profiles: 본인 것만 조회/수정 가능 (생성은 회원가입 시 트리거로 자동 처리)
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- events: 본인 것만 전체 CRUD 가능
create policy "events_all_own" on public.events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- event_overrides: 본인 것만 전체 CRUD 가능
create policy "overrides_all_own" on public.event_overrides
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- cell_decorations: 본인 것만 전체 CRUD 가능
create policy "decorations_all_own" on public.cell_decorations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- 회원가입 시 profiles 행 자동 생성 트리거
-- (구글/카카오로 처음 로그인하는 순간 profiles에 기본값으로 1행 자동 생성)
-- ============================================================

create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, calendar_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', '나의 캘린더'));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- updated_at 자동 갱신 트리거 (profiles, events 공통)
-- ============================================================

create function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

create trigger set_events_updated_at
  before update on public.events
  for each row execute procedure public.set_updated_at();
