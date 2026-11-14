-- KKuK 위치 도장 검사 (3단계 1). 전부 되돌림. 결과는 'RESULTS(rolled back): ...' 오류 문구
do $t$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); c uuid := gen_random_uuid(); d uuid := gen_random_uuid();
  tid uuid; t2 uuid; t3 uuid; t4 uuid; tok text; n int; r text := ''; s text; v int; me boolean;
  today date := (now() at time zone 'Asia/Tokyo')::date;
begin
  insert into auth.users (id, instance_id, aud, role, email) values
    (a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 's-a@example.com'),
    (b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 's-b@example.com'),
    (c, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 's-c@example.com'),
    (d, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 's-d@example.com');
  insert into public.profiles (user_id, display_name) values (a, '가'), (b, '나'), (c, '다'), (d, '라');
  select count(*) into n from public.cities; r := r || '0 cities=' || n || ' | ';

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  tid := public.create_trip('도쿄 여행', today - 1, today + 1, 'Asia/Tokyo', '[{"name":"도쿄","country_code":"JP"},{"name":"우리 동네","country_code":"JP"}]');
  t2 := public.create_trip('도쿄 또', today, today, 'Asia/Tokyo', '[{"name":"도쿄","country_code":"JP"}]');
  t3 := public.create_trip('다음 달', today + 30, today + 32, 'Asia/Tokyo', '[{"name":"도쿄","country_code":"JP"}]');
  t4 := public.create_trip('직접 입력만', today, today + 1, 'Asia/Tokyo', '[{"name":"우리 동네","country_code":"JP"}]');
  tok := public.create_invite(tid, 'viewer');

  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.accept_invite(tok);

  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin perform public.claim_stamp(tid, 35.69, 139.70, 50); r := r || '1 FAIL outsider | ';
  exception when others then r := r || '1 outsider -> ' || sqlerrm || ' | '; end;

  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin perform public.claim_stamp(tid, 34.69, 135.50, 50); r := r || '2 FAIL osaka | ';
  exception when others then r := r || '2 osaka -> ' || sqlerrm || ' | '; end;
  begin perform public.claim_stamp(tid, 35.69, 139.70, 9000); r := r || '3 FAIL accuracy | ';
  exception when others then r := r || '3 accuracy -> ' || sqlerrm || ' | '; end;
  begin perform public.claim_stamp(t3, 35.69, 139.70, 50); r := r || '4 FAIL future | ';
  exception when others then r := r || '4 future -> ' || sqlerrm || ' | '; end;
  begin perform public.claim_stamp(t4, 35.69, 139.70, 50); r := r || '5 FAIL custom city | ';
  exception when others then r := r || '5 custom -> ' || sqlerrm || ' | '; end;
  select x.status, x.visits, x.verified_by_me into s, v, me from public.claim_stamp(tid, 35.69, 139.70, 50) x;
  r := r || '6 A shinjuku=' || s || ' visits=' || v || ' me=' || me || ' | ';
  select x.status into s from public.claim_stamp(tid, 35.70, 139.75, 30) x; r := r || '7 A again same trip=' || s || ' | ';
  select x.status, x.visits into s, v from public.claim_stamp(t2, 35.68, 139.76, 30) x; r := r || '8 A other trip=' || s || ' visits=' || v || ' | ';

  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.stamp_grants where user_id = b; r := r || '9 B got stamp=' || n || ' | ';
  select count(*) into n from public.stamp_grants where user_id = a; r := r || '10 B sees A grants=' || n || ' | ';
  select count(*) into n from public.stamp_checkins where trip_id = tid; r := r || '11 B sees checkin=' || n || ' | ';
  select count(*) into n from public.stamp_checkins where trip_id = t2; r := r || '12 B sees other trip checkin=' || n || ' | ';
  begin insert into public.stamp_grants (user_id, trip_id, city_id) values (b, t2, 1); r := r || '13 FAIL direct insert | ';
  exception when others then r := r || '13 direct insert blocked ok | '; end;

  -- D 는 인증 뒤에 들어옴 : 다음 인증 때 같이 받음
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', d, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.accept_invite(tok);
  select count(*) into n from public.stamp_grants; r := r || '14 D before=' || n || ' | ';
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select x.status, x.verified_by_me into s, me from public.claim_stamp(tid, 35.68, 139.76, 30) x; r := r || '15 B claim=' || s || ' me=' || me || ' | ';
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', d, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.stamp_grants; r := r || '16 D after=' || n || ' | ';

  reset role;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  begin perform public.claim_stamp(tid, 35.69, 139.70, 50); r := r || '17 FAIL anon';
  exception when others then r := r || '17 anon blocked ok'; end;
  reset role;
  raise exception 'RESULTS(rolled back): %', r;
end $t$;
