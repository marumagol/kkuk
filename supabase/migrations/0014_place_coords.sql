/*
  0014 장소 검색 좌표 (4단계 1, 2026-11-15). 지도/장소 검색은 구글 (마루님 결정)
  - 표를 새로 만들지 않고 장소(itinerary_items)와 여행 도시(trip_cities)에 칸을 더한다
    google_place_id : 구글 장소 id (약관상 계속 저장 가능), lat/lng : 좌표, coords_at : 좌표를 받은 때
    구글 약관은 좌표를 오래 두지 말라고 해서(30일, 확인 필요) 화면이 열릴 때 30일 지난 좌표는 다시 받는다
  - 이름, 주소는 사람이 고칠 수 있는 칸이라 검색 결과로 채워도 그대로 둔다 (확인 필요)
  - 여행 만들기/수정 함수가 도시의 장소 id 와 좌표도 받는다
  - 도장 : 장소 검색으로 넣은 도시도 도장을 준다 (CLAUDE.md 7장 5번). 처음 받을 때 도장 목록(cities)에 이름과 장소 id 만 올림
*/
alter table public.itinerary_items
  add column google_place_id text check (google_place_id ~ '^[A-Za-z0-9_-]{10,255}$'),
  add column lat double precision check (lat between -90 and 90),
  add column lng double precision check (lng between -180 and 180),
  add column coords_at timestamptz,
  add constraint items_coords_pair check ((lat is null) = (lng is null));
alter table public.trip_cities
  add column google_place_id text check (google_place_id ~ '^[A-Za-z0-9_-]{10,255}$'),
  add column lat double precision check (lat between -90 and 90),
  add column lng double precision check (lng between -180 and 180),
  add column coords_at timestamptz,
  add constraint cities_coords_pair check ((lat is null) = (lng is null));

alter table public.cities alter column lat drop not null, alter column lng drop not null;
alter table public.cities add column google_place_id text unique;
alter table public.cities add constraint cities_has_place check ((lat is not null and lng is not null) or google_place_id is not null);

-- 도시 jsonb 한 칸 → 장소 id, 좌표 (형식이 틀리면 비움)
create function private.city_place(c jsonb) returns table (gpid text, lat double precision, lng double precision)
language sql immutable set search_path = '' as $$
  select case when c ->> 'place_id' ~ '^[A-Za-z0-9_-]{10,255}$' then c ->> 'place_id' end,
         case when jsonb_typeof(c -> 'lat') = 'number' and jsonb_typeof(c -> 'lng') = 'number'
               and (c ->> 'lat')::float8 between -90 and 90 and (c ->> 'lng')::float8 between -180 and 180 then (c ->> 'lat')::float8 end,
         case when jsonb_typeof(c -> 'lat') = 'number' and jsonb_typeof(c -> 'lng') = 'number'
               and (c ->> 'lat')::float8 between -90 and 90 and (c ->> 'lng')::float8 between -180 and 180 then (c ->> 'lng')::float8 end
$$;
revoke all on function private.city_place(jsonb) from public, anon;
grant execute on function private.city_place(jsonb) to authenticated;

create or replace function public.create_trip(p_title text, p_start_date date, p_end_date date, p_time_zone text, p_cities jsonb)
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

  insert into public.trip_cities (trip_id, sort_order, name, country_code, google_place_id, lat, lng, coords_at)
  select v_id, (t.ord - 1)::int, btrim(t.c ->> 'name'), nullif(upper(btrim(t.c ->> 'country_code')), ''), p.gpid, p.lat, p.lng, case when p.lat is not null then now() end
  from jsonb_array_elements(p_cities) with ordinality as t(c, ord), private.city_place(t.c) p;

  return v_id;
end $$;

create or replace function public.update_trip(p_trip uuid, p_title text, p_start_date date, p_end_date date, p_time_zone text, p_cities jsonb)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare v_moved integer;
begin
  if (select auth.uid()) is null then raise exception 'not_signed_in' using errcode = '28000'; end if;
  if not private.can_edit_trip(p_trip) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_cities is null or jsonb_typeof(p_cities) <> 'array' or jsonb_array_length(p_cities) not between 1 and 20 then
    raise exception 'cities_invalid' using errcode = '22023';
  end if;

  update public.trips
     set title = btrim(p_title), start_date = p_start_date, end_date = p_end_date, time_zone = coalesce(p_time_zone, time_zone)
   where id = p_trip;

  update public.itinerary_items
     set day_index = null
   where trip_id = p_trip and removed_at is null and day_index >= (p_end_date - p_start_date + 1);
  get diagnostics v_moved = row_count;

  delete from public.trip_cities where trip_id = p_trip;
  insert into public.trip_cities (trip_id, sort_order, name, country_code, google_place_id, lat, lng, coords_at)
  select p_trip, (t.ord - 1)::int, btrim(t.c ->> 'name'), nullif(upper(btrim(t.c ->> 'country_code')), ''), p.gpid, p.lat, p.lng, case when p.lat is not null then now() end
  from jsonb_array_elements(p_cities) with ordinality as t(c, ord), private.city_place(t.c) p;

  return v_moved;
end $$;

create or replace function public.claim_stamp(p_trip uuid, p_lat double precision, p_lng double precision, p_accuracy double precision)
returns table (status text, city_id integer, city_name text, country_code text, visits integer, verified_by_me boolean)
language plpgsql security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  v_me uuid := auth.uid(); v_trip public.trips; v_today date; v_max double precision;
  v_city record; v_city_id integer; v_check public.stamp_checkins; v_new boolean; v_visits integer;
begin
  if v_me is null or not private.can_view_trip(p_trip) then raise exception 'not_member' using errcode = '42501'; end if;
  select * into v_trip from public.trips t where t.id = p_trip;
  if v_trip.removed_at is not null then raise exception 'trip_removed' using errcode = '22023'; end if;
  v_today := (now() at time zone v_trip.time_zone)::date;
  if v_today < v_trip.start_date or v_today > v_trip.end_date then raise exception 'not_in_dates' using errcode = '22023'; end if;
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'bad_location' using errcode = '22023'; end if;
  select coalesce((r.params ->> 'max_accuracy_m')::double precision, 5000) into v_max from public.collectible_rules r where r.key = 'stamp_location';
  if p_accuracy is null or p_accuracy > coalesce(v_max, 5000) then raise exception 'low_accuracy' using errcode = '22023'; end if;

  -- 후보 : ① 앱 목록 도시(이름이 같거나 같은 구글 장소) ② 장소 검색으로 넣어 좌표가 있는 도시
  select x.id, x.name, x.country_code, x.radius_km, x.gpid, private.km_between(p_lat, p_lng, x.lat, x.lng) as dist into v_city
  from (
    select c.id, c.name, c.country_code, c.radius_km, null::text as gpid, coalesce(tc.lat, c.lat) as lat, coalesce(tc.lng, c.lng) as lng
    from public.trip_cities tc join public.cities c
      on (c.country_code = tc.country_code and c.name = tc.name) or (tc.google_place_id is not null and c.google_place_id = tc.google_place_id)
    where tc.trip_id = p_trip and coalesce(tc.lat, c.lat) is not null
    union all
    select null, tc.name, tc.country_code, 30, tc.google_place_id, tc.lat, tc.lng
    from public.trip_cities tc
    where tc.trip_id = p_trip and tc.lat is not null and tc.google_place_id is not null and tc.country_code is not null
      and not exists (select 1 from public.cities c where (c.country_code = tc.country_code and c.name = tc.name) or c.google_place_id = tc.google_place_id)
  ) x
  order by private.km_between(p_lat, p_lng, x.lat, x.lng) / x.radius_km limit 1;
  if v_city is null or v_city.name is null then raise exception 'no_city' using errcode = '22023'; end if;
  if v_city.dist > v_city.radius_km then raise exception 'too_far' using errcode = '22023'; end if;
  v_city_id := v_city.id;
  if v_city_id is null then
    -- 검색으로 넣은 도시 : 도장 목록에 새로 올림 (좌표는 남기지 않고 구글 장소 id 만)
    insert into public.cities (country_code, name, google_place_id) values (v_city.country_code, v_city.name, v_city.gpid)
    on conflict do nothing;
    select c.id into v_city_id from public.cities c
    where c.google_place_id = v_city.gpid or (c.country_code = v_city.country_code and c.name = v_city.name) limit 1;
  end if;

  insert into public.stamp_checkins (trip_id, city_id, verified_by, local_date) values (p_trip, v_city_id, v_me, v_today)
  on conflict (trip_id, city_id) do nothing;
  select * into v_check from public.stamp_checkins s where s.trip_id = p_trip and s.city_id = v_city_id;

  v_new := not exists (select 1 from public.stamp_grants g where g.user_id = v_me and g.trip_id = p_trip and g.city_id = v_city_id);
  insert into public.stamp_grants (user_id, trip_id, city_id)
  select m.user_id, p_trip, v_city_id from public.trip_members m
  where m.trip_id = p_trip and m.removed_at is null and m.user_id is not null
  on conflict do nothing;

  select count(*)::int into v_visits from public.stamp_grants g where g.user_id = v_me and g.city_id = v_city_id;
  return query select case when not v_new then 'already' when v_visits > 1 then 'again' else 'new' end,
    v_city_id, v_city.name, v_city.country_code, v_visits, v_check.verified_by = v_me;
end $$;
