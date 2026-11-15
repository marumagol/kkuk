-- KKuK 여행 전체 공유 검사 (0018). 전부 되돌림. 결과는 'RESULTS(rolled back): ...' 오류 문구
do $t$
declare
  a uuid := gen_random_uuid(); tid uuid; tok text; tok2 text; j jsonb; r text := '';
begin
  insert into auth.users (id, instance_id, aud, role, email) values (a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'w-a@example.com');
  insert into public.profiles (user_id, display_name) values (a, '가');
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  tid := public.create_trip('전체 공유', '2027-05-01', '2027-05-03', 'Asia/Seoul', '[{"name":"부산","country_code":"KR"}]');
  insert into public.itinerary_items (trip_id, day_index, title, memo) values (tid, 0, '첫날', '비밀 메모'), (tid, 2, '셋째날', null), (tid, null, '미정', null);
  tok := public.create_trip_share(tid, null);
  tok2 := public.create_trip_share(tid, array[0]);
  begin perform public.create_trip_share(tid, array[]::int[]); r := r || '1 FAIL empty | ';
  exception when others then r := r || '1 empty blocked | '; end;
  reset role;
  update public.trips set end_date = '2027-05-04' where id = tid;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  j := public.public_trip_share(tok);
  r := r || '2 whole=' || (j ->> 'whole') || ' days=' || (j ->> 'days') || ' items=' || jsonb_array_length(j -> 'items') || ' last=' || (j -> 'items' -> 2 ->> 'title') || ' | ';
  r := r || '3 no memo=' || (position('비밀' in j::text) = 0) || ' | ';
  j := public.public_trip_share(tok2);
  r := r || '4 part whole=' || (j ->> 'whole') || ' days=' || (j ->> 'days') || ' items=' || jsonb_array_length(j -> 'items') || ' | ';
  raise exception 'RESULTS(rolled back): %', r;
end $t$;
