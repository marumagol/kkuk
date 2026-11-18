/*
  도장 받기 위치 판단을 휴대폰 안으로 (2026-11-18 오픈 전 점검, 위치정보법 검토 기획/17)
  - 좌표를 서버로 보내지 않는다. 앱이 trip_stamp_targets 로 여행 도시 좌표·반경을 받아 휴대폰에서 거리를 재고,
    도시 안이면 claim_stamp_city(여행, 도시 이름, 나라) 만 부른다
  - 도시 좌표는 인기 도시 목록(cities) 값을 먼저 쓴다 (편집자가 여행 도시 좌표를 바꿔 다른 곳에서 받는 것 막기)
  - 예전 claim_stamp(좌표 받는 함수)는 실행 권한을 거둔다 (함수는 남김)
*/
create or replace function private.stamp_targets(p_trip uuid)
returns table (city_id integer, name text, country_code text, gpid text, lat double precision, lng double precision, radius_km double precision)
language sql stable security definer set search_path = '' as $$
  select c.id, c.name, c.country_code, null::text, coalesce(c.lat, tc.lat), coalesce(c.lng, tc.lng), c.radius_km::double precision
  from public.trip_cities tc
  join public.cities c on (c.country_code = tc.country_code and c.name = tc.name)
    or (tc.google_place_id is not null and c.google_place_id = tc.google_place_id)
  where tc.trip_id = p_trip and coalesce(c.lat, tc.lat) is not null
  union all
  select null, tc.name, tc.country_code, tc.google_place_id, tc.lat, tc.lng, 30
  from public.trip_cities tc
  where tc.trip_id = p_trip and tc.lat is not null and tc.google_place_id is not null and tc.country_code is not null
    and not exists (select 1 from public.cities c where (c.country_code = tc.country_code and c.name = tc.name) or c.google_place_id = tc.google_place_id)
$$;
revoke all on function private.stamp_targets(uuid) from public, anon, authenticated;

/* 함께하는 사람만. 같은 도시가 두 번 나오면 하나만 */
create or replace function public.trip_stamp_targets(p_trip uuid)
returns table (name text, country_code text, lat double precision, lng double precision, radius_km double precision, max_accuracy_m double precision)
language plpgsql stable security definer set search_path = '' as $$
declare v_max double precision;
begin
  if auth.uid() is null or not private.can_view_trip(p_trip) then raise exception 'not_member' using errcode = '42501'; end if;
  select coalesce((r.params ->> 'max_accuracy_m')::double precision, 5000) into v_max from public.collectible_rules r where r.key = 'stamp_location';
  return query select distinct on (t.country_code, t.name) t.name, t.country_code, t.lat, t.lng, t.radius_km, coalesce(v_max, 5000)
    from private.stamp_targets(p_trip) t order by t.country_code, t.name;
end $$;

create or replace function public.claim_stamp_city(p_trip uuid, p_name text, p_country text)
returns table (status text, city_id integer, city_name text, country_code text, visits integer, verified_by_me boolean)
language plpgsql security definer set search_path = ''
as $$
#variable_conflict use_column
declare v_me uuid := auth.uid(); v_trip public.trips; v_today date; v_city record; v_city_id integer;
  v_check public.stamp_checkins; v_new boolean; v_visits integer;
begin
  if v_me is null or not private.can_view_trip(p_trip) then raise exception 'not_member' using errcode = '42501'; end if;
  select * into v_trip from public.trips t where t.id = p_trip;
  if v_trip.removed_at is not null then raise exception 'trip_removed' using errcode = '22023'; end if;
  v_today := (now() at time zone v_trip.time_zone)::date;
  if v_today < v_trip.start_date or v_today > v_trip.end_date then raise exception 'not_in_dates' using errcode = '22023'; end if;
  select * into v_city from private.stamp_targets(p_trip) t
    where t.name = btrim(p_name) and t.country_code = upper(btrim(p_country)) limit 1;
  if v_city is null or v_city.name is null then raise exception 'no_city' using errcode = '22023'; end if;

  v_city_id := v_city.city_id;
  if v_city_id is null then
    insert into public.cities (country_code, name, google_place_id) values (v_city.country_code, v_city.name, v_city.gpid) on conflict do nothing;
    select c.id into v_city_id from public.cities c
      where c.google_place_id = v_city.gpid or (c.country_code = v_city.country_code and c.name = v_city.name) limit 1;
  end if;
  insert into public.stamp_checkins (trip_id, city_id, verified_by, local_date) values (p_trip, v_city_id, v_me, v_today)
    on conflict (trip_id, city_id) do nothing;
  select * into v_check from public.stamp_checkins s where s.trip_id = p_trip and s.city_id = v_city_id;
  v_new := not exists (select 1 from public.stamp_grants g where g.user_id = v_me and g.trip_id = p_trip and g.city_id = v_city_id);
  insert into public.stamp_grants (user_id, trip_id, city_id)
    select m.user_id, p_trip, v_city_id from public.trip_members m where m.trip_id = p_trip and m.removed_at is null and m.user_id is not null
    on conflict do nothing;
  select count(*)::int into v_visits from public.stamp_grants g where g.user_id = v_me and g.city_id = v_city_id;
  return query select case when not v_new then 'already' when v_visits > 1 then 'again' else 'new' end,
    v_city_id, v_city.name, v_city.country_code, v_visits, v_check.verified_by = v_me;
end $$;

revoke all on function public.trip_stamp_targets(uuid), public.claim_stamp_city(uuid, text, text) from public, anon;
grant execute on function public.trip_stamp_targets(uuid), public.claim_stamp_city(uuid, text, text) to authenticated;
revoke execute on function public.claim_stamp(uuid, double precision, double precision, double precision) from public, anon, authenticated;
