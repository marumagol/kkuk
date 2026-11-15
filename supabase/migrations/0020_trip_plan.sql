/*
  0020 여행 등급과 한도 한 곳 (5단계 4번, 2026-11-15)
  - trips.plan : 'free' (기본) / 'pass' (여행 패스, 아직 파는 곳 없음). 앱에서는 못 바꿈 (서버 관리 작업만)
  - plan_limits : 등급별 한도 표. 지금은 free 한 줄 = 지금 한도 그대로 (10명, 장소 사진 5, 일기 사진 10)
    pass 숫자는 기획/10 결정 뒤 이 표에 한 줄 넣으면 끝
  - private.trip_limit(trip, key) 한 곳에서 읽는다. 표에 없는 등급은 free 숫자
  - 사진 한도는 "더 올리기"만 막는다 (이미 올린 사진은 한도가 줄어도 그대로, 기획/10 원칙)
*/
create table public.plan_limits (
  plan              text primary key check (plan in ('free', 'pass')),
  max_members       int not null check (max_members > 0),
  max_place_photos  int not null check (max_place_photos >= 0),
  max_entry_photos  int not null check (max_entry_photos >= 0)
);
alter table public.plan_limits enable row level security;
create policy plan_limits_select on public.plan_limits for select to authenticated using (true);
insert into public.plan_limits values ('free', 10, 5, 10);

alter table public.trips add column plan text not null default 'free' check (plan in ('free', 'pass'));

-- 앱(로그인한 사람)에서 온 수정은 등급을 바꿀 수 없음
create function private.trips_keep_plan() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if (select auth.uid()) is not null then
    if tg_op = 'INSERT' then new.plan := 'free'; else new.plan := old.plan; end if;
  end if;
  return new;
end $$;
create trigger trips_keep_plan before insert or update on public.trips
  for each row execute function private.trips_keep_plan();

create function private.trip_limit(p_trip uuid, p_key text) returns int
language sql stable security definer set search_path = ''
as $$
  select case p_key
           when 'members' then l.max_members
           when 'place_photos' then l.max_place_photos
           when 'entry_photos' then l.max_entry_photos
         end
    from public.trips t
    join public.plan_limits l on l.plan = t.plan
   where t.id = p_trip
  union all
  select case p_key
           when 'members' then f.max_members
           when 'place_photos' then f.max_place_photos
           when 'entry_photos' then f.max_entry_photos
         end
    from public.plan_limits f where f.plan = 'free'
  limit 1
$$;
revoke all on function private.trip_limit(uuid, text) from public, anon;
grant execute on function private.trip_limit(uuid, text) to authenticated;

-- 앱 화면이 쓸 한도 (보기 권한 있는 사람만)
create function public.trip_limits(p_trip uuid) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select case when private.can_view_trip(p_trip) then jsonb_build_object(
    'plan', (select plan from public.trips where id = p_trip),
    'members', private.trip_limit(p_trip, 'members'),
    'place_photos', private.trip_limit(p_trip, 'place_photos'),
    'entry_photos', private.trip_limit(p_trip, 'entry_photos')) end
$$;
revoke all on function public.trip_limits(uuid) from public, anon;
grant execute on function public.trip_limits(uuid) to authenticated;

-- 인원 : accept_invite 의 10 을 한도 표로
create or replace function public.accept_invite(p_token text) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := (select auth.uid()); v public.trip_invites; v_name text; v_n int;
begin
  if v_uid is null then raise exception 'not_signed_in' using errcode = '28000'; end if;
  select p.display_name into v_name from public.profiles p where p.user_id = v_uid and p.deleted_at is null;
  if v_name is null then raise exception 'profile_required' using errcode = '22023'; end if;
  select * into v from public.trip_invites i where i.token = p_token for update;
  if not found then raise exception 'invite_not_found' using errcode = '22023'; end if;
  if private.trip_role(v.trip_id) is not null then return v.trip_id; end if;
  if v.revoked_at is not null then raise exception 'invite_revoked' using errcode = '22023'; end if;
  if v.expires_at < now() then raise exception 'invite_expired' using errcode = '22023'; end if;
  if exists (select 1 from public.trips t where t.id = v.trip_id and t.removed_at is not null) then raise exception 'trip_removed' using errcode = '22023'; end if;
  select count(*) into v_n from public.trip_members m where m.trip_id = v.trip_id and m.removed_at is null;
  if v_n >= private.trip_limit(v.trip_id, 'members') then raise exception 'trip_full' using errcode = '22023'; end if;
  insert into public.trip_members (trip_id, user_id, role, display_name) values (v.trip_id, v_uid, v.role, v_name);
  return v.trip_id;
end $$;

-- 사진 : 고정 check 대신 한도 표. 늘어날 때만 검사
alter table public.itinerary_items drop constraint if exists itinerary_items_photos_check;
alter table public.journal_entries drop constraint if exists journal_entries_photos_check;
alter table public.itinerary_items add constraint itinerary_items_photos_cap check (cardinality(photos) <= 100);
alter table public.journal_entries add constraint journal_entries_photos_cap check (cardinality(photos) <= 100);

create function private.photos_within_limit() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare v_max int := private.trip_limit(new.trip_id, case tg_table_name when 'itinerary_items' then 'place_photos' else 'entry_photos' end);
begin
  if cardinality(new.photos) > v_max
     and (tg_op = 'INSERT' or cardinality(new.photos) > cardinality(old.photos)) then
    raise exception 'photo_limit' using errcode = '22023';
  end if;
  return new;
end $$;
create trigger itinerary_items_photo_limit before insert or update of photos on public.itinerary_items
  for each row execute function private.photos_within_limit();
create trigger journal_entries_photo_limit before insert or update of photos on public.journal_entries
  for each row execute function private.photos_within_limit();
