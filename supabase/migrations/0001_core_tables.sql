/*
  KKuK 1단계 핵심 표 5개 + 권한 검사 (CLAUDE.md 4-1장, 5장 / 기획 02)

  원칙
  - 권한 검사는 private.trip_role() 한 곳에서만 한다. 모든 RLS 정책이 이 함수를 거친다
  - 여행에 딸린 표는 모두 trip_id 를 가진다
  - 삭제는 행을 지우지 않고 removed_at 으로 표시 (trip_cities 만 예외 : 수정할 때 통째로 바꿈)
  - 여행 만들기는 create_trip() 으로만 (여행 + 주인 + 도시가 한 번에 저장되게)
  - 함께하는 사람 넣기/빼기/권한 바꾸기는 2단계에서 함수로 추가 (지금은 쓰기 정책 없음)
*/

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

-- ───────────── 표 ─────────────

create table public.profiles (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (display_name = btrim(display_name) and char_length(display_name) between 1 and 20),
  avatar_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);
comment on table public.profiles is '표시 이름. 처음 로그인 때 한 번 정한다';

create table public.trips (
  id         uuid primary key default gen_random_uuid(),
  title      text not null check (title = btrim(title) and char_length(title) between 1 and 60),
  start_date date not null,
  end_date   date not null,
  time_zone  text not null default 'Asia/Seoul',
  cover_url  text,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  removed_at timestamptz,
  constraint trips_dates check (end_date >= start_date and end_date - start_date <= 365)
);
comment on table public.trips is '여행. 여행 주인은 trip_members 의 role=owner 가 기준 (created_by 는 만든 사람 기록일 뿐)';

create table public.trip_cities (
  id           uuid primary key default gen_random_uuid(),
  trip_id      uuid not null references public.trips(id) on delete cascade,
  sort_order   integer not null default 0,
  name         text not null check (name = btrim(name) and char_length(name) between 1 and 40),
  country_code text check (country_code ~ '^[A-Z]{2}$'),
  place_id     uuid,
  created_at   timestamptz not null default now()
);
create index trip_cities_trip on public.trip_cities (trip_id, sort_order);

create table public.trip_members (
  id           uuid primary key default gen_random_uuid(),
  trip_id      uuid not null references public.trips(id) on delete cascade,
  user_id      uuid references auth.users(id) on delete set null,  -- 비어 있으면 아직 로그인 전인 초대 자리 (2단계)
  role         text not null check (role in ('owner', 'editor', 'viewer')),
  display_name text not null check (display_name = btrim(display_name) and char_length(display_name) between 1 and 20),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  removed_at   timestamptz
);
comment on table public.trip_members is '함께하는 사람. 여행마다 한 사람이 한 가지 권한';
-- 한 여행에 같은 사람은 한 번만, 여행 주인은 딱 1명
create unique index trip_members_one_per_user on public.trip_members (trip_id, user_id) where user_id is not null and removed_at is null;
create unique index trip_members_one_owner on public.trip_members (trip_id) where role = 'owner' and removed_at is null;
create index trip_members_user on public.trip_members (user_id) where removed_at is null;

create table public.itinerary_items (
  id             uuid primary key default gen_random_uuid(),
  trip_id        uuid not null references public.trips(id) on delete cascade,
  day_index      integer check (day_index >= 0),   -- 0 = 1일차. 비어 있으면 "날짜 미정"
  sort_order     integer not null default 0,
  place_id       uuid,                              -- 장소 검색(4단계) 전까지 비움
  title          text not null check (title = btrim(title) and char_length(title) between 1 and 80),
  address        text check (char_length(address) <= 200),
  category       text not null default 'sight' check (category in ('transport', 'food', 'sight', 'shopping', 'stay')),
  start_time     time,
  estimated_cost bigint check (estimated_cost >= 0),          -- 통화별 최소 단위 정수
  cost_currency  text check (cost_currency ~ '^[A-Z]{3}$'),
  memo           text check (char_length(memo) <= 2000),
  created_by     uuid default auth.uid() references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  updated_by     uuid references auth.users(id) on delete set null,
  removed_at     timestamptz,
  constraint itinerary_items_cost_has_currency check (estimated_cost is null or cost_currency is not null)
);
comment on table public.itinerary_items is '장소 (화면 이름). 일정 한 줄';
create index itinerary_items_trip_day on public.itinerary_items (trip_id, day_index, sort_order) where removed_at is null;

-- ───────────── 권한 검사 (여기 한 곳) ─────────────

-- 지금 로그인한 사람이 이 여행에서 가진 권한. 없으면 null
create function private.trip_role(p_trip uuid) returns text
language sql stable security definer set search_path = ''
as $$
  select m.role from public.trip_members m
  where m.trip_id = p_trip and m.user_id = (select auth.uid()) and m.removed_at is null
$$;

-- 보기 : 함께하는 사람 모두 (삭제된 여행도 "삭제된 여행이에요" 를 보여주려고 행은 보임)
create function private.can_view_trip(p_trip uuid) returns boolean
language sql stable security definer set search_path = ''
as $$ select private.trip_role(p_trip) is not null $$;

-- 고치기 : 여행 주인, 편집 가능. 삭제된 여행은 못 고침
create function private.can_edit_trip(p_trip uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.trip_role(p_trip) in ('owner', 'editor')
     and exists (select 1 from public.trips t where t.id = p_trip and t.removed_at is null)
$$;

create function private.is_trip_owner(p_trip uuid) returns boolean
language sql stable security definer set search_path = ''
as $$ select private.trip_role(p_trip) = 'owner' $$;

revoke all on function private.trip_role(uuid), private.can_view_trip(uuid), private.can_edit_trip(uuid), private.is_trip_owner(uuid) from public, anon;
grant execute on function private.trip_role(uuid), private.can_view_trip(uuid), private.can_edit_trip(uuid), private.is_trip_owner(uuid) to authenticated;

-- ───────────── 자동 처리 (트리거) ─────────────

create function private.profiles_before_update() returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.user_id := old.user_id;
  new.created_at := old.created_at;
  new.updated_at := now();
  return new;
end $$;
create trigger profiles_before_update before update on public.profiles
  for each row execute function private.profiles_before_update();

-- 이름을 바꾸면 내가 들어가 있는 여행의 표시 이름도 같이 바뀐다
create function private.profiles_sync_member_name() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.trip_members set display_name = new.display_name
  where user_id = new.user_id and removed_at is null and display_name is distinct from new.display_name;
  return null;
end $$;
create trigger profiles_sync_member_name after update of display_name on public.profiles
  for each row execute function private.profiles_sync_member_name();

create function private.trips_before_write() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := (select auth.uid());
begin
  if tg_op = 'INSERT' or new.time_zone is distinct from old.time_zone then
    if not exists (select 1 from pg_catalog.pg_timezone_names z where z.name = new.time_zone) then
      raise exception 'invalid_time_zone' using errcode = '22023';
    end if;
  end if;
  if tg_op = 'UPDATE' then
    new.id := old.id;
    new.created_at := old.created_at;
    new.updated_at := now();
    if v_uid is not null then   -- 앱에서 온 요청 (서버 관리 작업은 v_uid 가 없음)
      new.created_by := old.created_by;
      new.updated_by := v_uid;
      -- 여행 삭제와 되살리기는 여행 주인만
      if new.removed_at is distinct from old.removed_at and private.trip_role(old.id) is distinct from 'owner' then
        raise exception 'owner_only' using errcode = '42501';
      end if;
    end if;
  end if;
  return new;
end $$;
create trigger trips_before_write before insert or update on public.trips
  for each row execute function private.trips_before_write();

create function private.items_before_update() returns trigger
language plpgsql set search_path = ''
as $$
declare v_uid uuid := (select auth.uid());
begin
  new.id := old.id;
  new.trip_id := old.trip_id;        -- 장소를 다른 여행으로 옮길 수 없음
  new.created_at := old.created_at;
  new.updated_at := now();
  if v_uid is not null then
    new.created_by := old.created_by;
    new.updated_by := v_uid;
  end if;
  return new;
end $$;
create trigger items_before_update before update on public.itinerary_items
  for each row execute function private.items_before_update();

create function private.cities_before_update() returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.id := old.id;
  new.trip_id := old.trip_id;
  return new;
end $$;
create trigger cities_before_update before update on public.trip_cities
  for each row execute function private.cities_before_update();

create function private.members_before_update() returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.id := old.id;
  new.trip_id := old.trip_id;
  new.created_at := old.created_at;
  new.updated_at := now();
  return new;
end $$;
create trigger members_before_update before update on public.trip_members
  for each row execute function private.members_before_update();

-- ───────────── 여행 만들기 (여행 + 주인 + 도시를 한 번에) ─────────────

create function public.create_trip(p_title text, p_start_date date, p_end_date date, p_time_zone text, p_cities jsonb)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid  uuid := (select auth.uid());
  v_name text;
  v_id   uuid;
begin
  if v_uid is null then raise exception 'not_signed_in' using errcode = '28000'; end if;
  select p.display_name into v_name from public.profiles p where p.user_id = v_uid and p.deleted_at is null;
  if v_name is null then raise exception 'profile_required' using errcode = '22023'; end if;
  if p_cities is null or jsonb_typeof(p_cities) <> 'array' or jsonb_array_length(p_cities) not between 1 and 20 then
    raise exception 'cities_invalid' using errcode = '22023';
  end if;

  insert into public.trips (title, start_date, end_date, time_zone, created_by, updated_by)
  values (btrim(p_title), p_start_date, p_end_date, coalesce(p_time_zone, 'Asia/Seoul'), v_uid, v_uid)
  returning id into v_id;

  insert into public.trip_members (trip_id, user_id, role, display_name) values (v_id, v_uid, 'owner', v_name);

  insert into public.trip_cities (trip_id, sort_order, name, country_code)
  select v_id, (t.ord - 1)::int, btrim(t.c ->> 'name'), nullif(upper(btrim(t.c ->> 'country_code')), '')
  from jsonb_array_elements(p_cities) with ordinality as t(c, ord);

  return v_id;
end $$;
revoke all on function public.create_trip(text, date, date, text, jsonb) from public, anon;
grant execute on function public.create_trip(text, date, date, text, jsonb) to authenticated;

-- ───────────── RLS ─────────────

alter table public.profiles        enable row level security;
alter table public.trips           enable row level security;
alter table public.trip_cities     enable row level security;
alter table public.trip_members    enable row level security;
alter table public.itinerary_items enable row level security;

revoke all on public.profiles, public.trips, public.trip_cities, public.trip_members, public.itinerary_items from anon, authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, update on public.trips to authenticated;
grant select, insert, update, delete on public.trip_cities to authenticated;
grant select on public.trip_members to authenticated;
grant select, insert, update on public.itinerary_items to authenticated;

-- profiles : 내 것만
create policy profiles_select_own on public.profiles for select to authenticated using (user_id = (select auth.uid()));
create policy profiles_insert_own on public.profiles for insert to authenticated with check (user_id = (select auth.uid()));
create policy profiles_update_own on public.profiles for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- trips : 보기는 함께하는 사람, 고치기는 주인과 편집 가능. 만들기는 create_trip() 으로만, 지우기는 removed_at
create policy trips_select on public.trips for select to authenticated using (private.can_view_trip(id));
create policy trips_update on public.trips for update to authenticated
  using (private.can_edit_trip(id)) with check (private.trip_role(id) in ('owner', 'editor'));

create policy trip_cities_select on public.trip_cities for select to authenticated using (private.can_view_trip(trip_id));
create policy trip_cities_insert on public.trip_cities for insert to authenticated with check (private.can_edit_trip(trip_id));
create policy trip_cities_update on public.trip_cities for update to authenticated
  using (private.can_edit_trip(trip_id)) with check (private.can_edit_trip(trip_id));
create policy trip_cities_delete on public.trip_cities for delete to authenticated using (private.can_edit_trip(trip_id));

-- trip_members : 보기만. 넣기/빼기/권한 바꾸기는 2단계에서 여행 주인용 함수로
create policy trip_members_select on public.trip_members for select to authenticated using (private.can_view_trip(trip_id));

create policy itinerary_items_select on public.itinerary_items for select to authenticated using (private.can_view_trip(trip_id));
create policy itinerary_items_insert on public.itinerary_items for insert to authenticated
  with check (private.can_edit_trip(trip_id) and created_by = (select auth.uid()));
create policy itinerary_items_update on public.itinerary_items for update to authenticated
  using (private.can_edit_trip(trip_id)) with check (private.can_edit_trip(trip_id));
