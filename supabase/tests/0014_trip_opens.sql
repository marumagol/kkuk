-- KKuK 여행 열기 기록 검사 (0021). 전부 되돌림
do $t$
declare a uuid := gen_random_uuid(); d uuid := gen_random_uuid(); tid uuid; r text := ''; n int;
begin
  insert into auth.users (id, instance_id, aud, role, email) values
    (a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'o-a@example.com'),
    (d, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'o-d@example.com');
  insert into public.profiles (user_id, display_name) values (a, '가'), (d, '라');
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  tid := public.create_trip('열기', '2027-05-01', '2027-05-03', 'Asia/Seoul', '[{"name":"부산","country_code":"KR"}]');
  perform public.log_trip_open(tid); perform public.log_trip_open(tid);
  begin select count(*) into n from public.trip_opens; r := r || '1 FAIL read | ';
  exception when others then r := r || '1 table read blocked | '; end;
  perform set_config('request.jwt.claims', json_build_object('sub', d, 'role', 'authenticated')::text, true);
  perform public.log_trip_open(tid);
  reset role;
  select count(*) into n from public.trip_opens where trip_id = tid;
  r := r || '2 rows=' || n || ' (twice + outsider = 1) | ';
  raise exception 'RESULTS(rolled back): %', r;
end $t$;
