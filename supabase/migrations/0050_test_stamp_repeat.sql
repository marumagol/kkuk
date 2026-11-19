/*
  도장 테스트로 등급 카드 보기 (2026-11-19 마루님 "테스트할 때 여러 번 찍으면 레어, 에픽 볼 수 있게")
  - 같은 도시를 다시 테스트하면, 보이지 않는 테스트 여행을 하나 만들어 거기에 도장을 하나 더 붙인다 → 방문 수가 올라 레어(2)/에픽(3)/유니크(5)
  - 테스트 여행은 함께하는 사람이 없고 지워진 상태(removed_at)로 만들어 여행 목록과 휴지통에 보이지 않는다
  - test_stamp_clear 가 테스트 여행도 함께 지운다 (지운 여행의 도장도 함께 사라짐)
*/
create table private.test_trips (
  trip_id uuid primary key references public.trips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
revoke all on private.test_trips from public, anon, authenticated;

create or replace function public.test_stamp(p_country text, p_name text)
returns table (status text, city_id integer, city_name text, country_code text, visits integer, verified_by_me boolean)
language plpgsql security definer set search_path = ''
as $$
#variable_conflict use_column
declare v_me uuid := auth.uid(); v_city public.cities; v_trip uuid; v_visits integer;
begin
  if not public.am_stamp_tester() then raise exception 'not_tester' using errcode = '42501'; end if;
  select * into v_city from public.cities c where c.country_code = upper(btrim(p_country)) and c.name = btrim(p_name) limit 1;
  if v_city.id is null then raise exception 'no_city' using errcode = '22023'; end if;
  select t.id into v_trip from public.trips t join public.trip_members m on m.trip_id = t.id
  where m.user_id = v_me and m.removed_at is null and t.removed_at is null
  order by t.created_at desc limit 1;
  if v_trip is null then raise exception 'no_trip' using errcode = '22023'; end if;

  -- 이 여행에서 이미 받았으면 보이지 않는 테스트 여행을 만들어 한 번 더
  if exists (select 1 from public.stamp_grants g where g.user_id = v_me and g.trip_id = v_trip and g.city_id = v_city.id) then
    insert into public.trips (title, start_date, end_date, removed_at)
      values ('도장 테스트', current_date, current_date, now()) returning id into v_trip;
    insert into private.test_trips (trip_id, user_id) values (v_trip, v_me);
  end if;
  insert into public.stamp_grants (user_id, trip_id, city_id) values (v_me, v_trip, v_city.id);
  insert into private.test_stamp_grants (user_id, trip_id, city_id) values (v_me, v_trip, v_city.id) on conflict do nothing;

  select count(*)::int into v_visits from public.stamp_grants g where g.user_id = v_me and g.city_id = v_city.id;
  return query select case when v_visits > 1 then 'again' else 'new' end,
    v_city.id, v_city.name, v_city.country_code, v_visits, true;
end $$;

create or replace function public.test_stamp_clear()
returns integer language plpgsql security definer set search_path = ''
as $$
declare v_me uuid := auth.uid(); v_n integer; v_t integer;
begin
  if not public.am_stamp_tester() then raise exception 'not_tester' using errcode = '42501'; end if;
  delete from public.stamp_grants g using private.test_stamp_grants t
  where t.user_id = v_me and g.user_id = t.user_id and g.trip_id = t.trip_id and g.city_id = t.city_id
    and not exists (select 1 from public.stamp_checkins s where s.trip_id = g.trip_id and s.city_id = g.city_id);
  get diagnostics v_n = row_count;
  delete from private.test_stamp_grants t where t.user_id = v_me;
  delete from public.trips t using private.test_trips x where x.user_id = v_me and t.id = x.trip_id;
  return v_n;
end $$;

revoke all on function public.test_stamp(text, text), public.test_stamp_clear() from public, anon;
grant execute on function public.test_stamp(text, text), public.test_stamp_clear() to authenticated;
