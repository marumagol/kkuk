-- KKuK 삭제 여행 완전 삭제 검사 (0028). 전부 되돌림
do $t$
declare a uuid := gen_random_uuid(); t1 uuid; t2 uuid; t3 uuid; r text := ''; n int; ok boolean;
begin
  insert into auth.users (id, instance_id, aud, role, email) values (a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'g-a@example.com');
  insert into public.profiles (user_id, display_name) values (a, '가');
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  t1 := public.create_trip('오래됨', '2027-05-01', '2027-05-03', 'Asia/Seoul', '[{"name":"부산","country_code":"KR"}]');
  t2 := public.create_trip('최근', '2027-05-01', '2027-05-03', 'Asia/Seoul', '[{"name":"부산","country_code":"KR"}]');
  t3 := public.create_trip('살아있음', '2027-05-01', '2027-05-03', 'Asia/Seoul', '[{"name":"부산","country_code":"KR"}]');
  insert into public.itinerary_items (trip_id, day_index, title) values (t1, 0, '장소');
  begin perform public.purge_candidates(); r := r || '1 FAIL user | ';
  exception when others then r := r || '1 user blocked | '; end;
  reset role; perform set_config('request.jwt.claims', '{}', true);
  update public.trips set removed_at = now() - interval '31 days' where id = t1;
  update public.trips set removed_at = now() - interval '5 days' where id = t2;
  set local role service_role;
  select count(*) into n from public.purge_candidates() c where c in (t1, t2, t3); r := r || '2 candidates=' || n || ' | ';
  ok := public.purge_trip(t2); r := r || '3 recent purge=' || ok || ' | ';
  ok := public.purge_trip(t1); r := r || '4 old purge=' || ok || ' | ';
  reset role;
  select count(*) into n from public.itinerary_items where trip_id = t1; r := r || '5 items gone=' || (n = 0) || ' | ';
  select count(*) into n from public.trips where id in (t2, t3); r := r || '6 others kept=' || n || ' | ';
  raise exception 'RESULTS(rolled back): %', r;
end $t$;
