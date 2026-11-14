-- KKuK 장소 검색 좌표 검사 (4단계 1). 전부 되돌림
do $t$
declare
  a uuid := gen_random_uuid(); tid uuid; t2 uuid; n int; r text := ''; s text; v int;
  today date := (now() at time zone 'Asia/Tokyo')::date;
begin
  insert into auth.users (id, instance_id, aud, role, email) values (a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'g-a@example.com');
  insert into public.profiles (user_id, display_name) values (a, '가');
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  tid := public.create_trip('하코다테', today, today + 1, 'Asia/Tokyo',
    '[{"name":"하코다테","country_code":"JP","place_id":"ChIJtest_hakodate_01","lat":41.77,"lng":140.73},{"name":"이상한","country_code":"JP","place_id":"bad id!","lat":"x","lng":1}]');
  select count(*) into n from public.trip_cities where trip_id = tid and lat is not null; r := r || '1 coords saved=' || n || ' | ';
  select count(*) into n from public.trip_cities where trip_id = tid and google_place_id is null and name = '이상한'; r := r || '2 bad input ignored=' || n || ' | ';
  begin perform public.claim_stamp(tid, 35.68, 139.76, 50); r := r || '3 FAIL tokyo | ';
  exception when others then r := r || '3 tokyo -> ' || sqlerrm || ' | '; end;
  select x.status, x.visits into s, v from public.claim_stamp(tid, 41.79, 140.75, 50) x;
  r := r || '4 hakodate=' || s || ' visits=' || v || ' | ';
  t2 := public.create_trip('또 하코다테', today, today, 'Asia/Tokyo', '[{"name":"하코다테시","country_code":"JP","place_id":"ChIJtest_hakodate_01","lat":41.77,"lng":140.73}]');
  select x.status, x.visits into s, v from public.claim_stamp(t2, 41.78, 140.74, 50) x; r := r || '5 same place other trip=' || s || ' visits=' || v || ' | ';
  perform public.update_trip(tid, '하코다테', today, today + 1, 'Asia/Tokyo', '[{"name":"하코다테","country_code":"JP","place_id":"ChIJtest_hakodate_01","lat":41.77,"lng":140.73}]');
  select count(*) into n from public.trip_cities where trip_id = tid and lat is not null; r := r || '6 update keeps coords=' || n || ' | ';
  select x.status into s from public.claim_stamp(tid, 41.79, 140.75, 50) x; r := r || '7 again same trip=' || s || ' | ';
  begin insert into public.itinerary_items (trip_id, title, lat) values (tid, '반쪽 좌표', 41.0); r := r || '8 FAIL half coords | ';
  exception when others then r := r || '8 half coords blocked ok | '; end;
  insert into public.itinerary_items (trip_id, title, google_place_id, lat, lng, coords_at) values (tid, '아침 시장', 'ChIJtest_market_0001', 41.77, 140.72, now());
  r := r || '9 item with place ok | ';
  -- 목록 도시는 그대로
  t2 := public.create_trip('도쿄', today, today, 'Asia/Tokyo', '[{"name":"도쿄","country_code":"JP"}]');
  select x.status into s from public.claim_stamp(t2, 35.69, 139.70, 50) x; r := r || '10 catalog city=' || s;
  reset role;
  raise exception 'RESULTS(rolled back): %', r;
end $t$;
