/*
  도장 테스트 권한 (2026-11-18 마루님 "도장 테스트를 못 해 봐서, 내 계정만 확인할 수 있는 권한")
  - private.stamp_testers 에 있는 계정만 : 위치·여행 기간 확인 없이 도시를 골라 도장을 받아 보고, 테스트로 받은 것만 지운다
  - 테스트 도장은 그 사람 혼자만 받는다 (함께하는 사람에게 퍼지지 않음, stamp_checkins 도 남기지 않음)
  - 테스트로 받은 것은 private.test_stamp_grants 에 적어 두어, 진짜로 받은 도장은 지우지 않는다
  - 테스터 목록은 저장소에 적지 않고 DB 에서 직접 넣는다 (insert into private.stamp_testers ...)
*/
create table private.stamp_testers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  note    text,
  created_at timestamptz not null default now()
);
create table private.test_stamp_grants (
  user_id uuid not null references auth.users(id) on delete cascade,
  trip_id uuid not null references public.trips(id) on delete cascade,
  city_id integer not null references public.cities(id),
  created_at timestamptz not null default now(),
  primary key (user_id, trip_id, city_id)
);
revoke all on private.stamp_testers, private.test_stamp_grants from public, anon, authenticated;

create function public.am_stamp_tester()
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (select 1 from private.stamp_testers t where t.user_id = auth.uid())
$$;

/* 결과는 claim_stamp 와 같은 모양 (화면 재사용). 여행은 내가 함께하는 가장 최근 여행에 붙인다 */
create function public.test_stamp(p_country text, p_name text)
returns table (status text, city_id integer, city_name text, country_code text, visits integer, verified_by_me boolean)
language plpgsql security definer set search_path = ''
as $$
#variable_conflict use_column
declare v_me uuid := auth.uid(); v_city public.cities; v_trip uuid; v_new boolean; v_visits integer;
begin
  if not public.am_stamp_tester() then raise exception 'not_tester' using errcode = '42501'; end if;
  select * into v_city from public.cities c where c.country_code = upper(btrim(p_country)) and c.name = btrim(p_name) limit 1;
  if v_city.id is null then raise exception 'no_city' using errcode = '22023'; end if;
  select t.id into v_trip from public.trips t join public.trip_members m on m.trip_id = t.id
  where m.user_id = v_me and m.removed_at is null and t.removed_at is null
  order by t.created_at desc limit 1;
  if v_trip is null then raise exception 'no_trip' using errcode = '22023'; end if;

  v_new := not exists (select 1 from public.stamp_grants g where g.user_id = v_me and g.trip_id = v_trip and g.city_id = v_city.id);
  if v_new then
    insert into public.stamp_grants (user_id, trip_id, city_id) values (v_me, v_trip, v_city.id);
    insert into private.test_stamp_grants (user_id, trip_id, city_id) values (v_me, v_trip, v_city.id) on conflict do nothing;
  end if;
  select count(*)::int into v_visits from public.stamp_grants g where g.user_id = v_me and g.city_id = v_city.id;
  return query select case when not v_new then 'already' when v_visits > 1 then 'again' else 'new' end,
    v_city.id, v_city.name, v_city.country_code, v_visits, true;
end $$;

/* 테스트로 받은 도장만 지운다. 지운 수를 돌려준다 */
create function public.test_stamp_clear()
returns integer language plpgsql security definer set search_path = ''
as $$
declare v_me uuid := auth.uid(); v_n integer;
begin
  if not public.am_stamp_tester() then raise exception 'not_tester' using errcode = '42501'; end if;
  delete from public.stamp_grants g using private.test_stamp_grants t
  where t.user_id = v_me and g.user_id = t.user_id and g.trip_id = t.trip_id and g.city_id = t.city_id
    -- 테스트 뒤 그 여행에서 진짜로 받았으면(체크인 있음) 남긴다
    and not exists (select 1 from public.stamp_checkins s where s.trip_id = g.trip_id and s.city_id = g.city_id);
  get diagnostics v_n = row_count;
  delete from private.test_stamp_grants t where t.user_id = v_me;
  return v_n;
end $$;

revoke all on function public.am_stamp_tester(), public.test_stamp(text, text), public.test_stamp_clear() from public, anon;
grant execute on function public.am_stamp_tester(), public.test_stamp(text, text), public.test_stamp_clear() to authenticated;
