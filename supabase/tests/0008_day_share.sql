-- KKuK 일부 일정 공유 검사 (4단계 7). 전부 되돌림. 결과는 'RESULTS(rolled back): ...' 오류 문구
do $t$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid();
  tid uuid; tok text; j jsonb; n int; r text := '';
begin
  insert into auth.users (id, instance_id, aud, role, email) values
    (a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 's-a@example.com'),
    (b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 's-b@example.com');
  insert into public.profiles (user_id, display_name) values (a, '가'), (b, '나');
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  tid := public.create_trip('공유 여행', '2027-05-01', '2027-05-03', 'Asia/Seoul', '[{"name":"부산","country_code":"KR"}]');
  insert into public.itinerary_items (trip_id, day_index, title, memo, estimated_cost, cost_currency) values
    (tid, 0, '첫날 장소', '비밀 메모', 1000, 'KRW'), (tid, 1, '둘째날 장소', null, null, null), (tid, null, '미정 장소', null, null, null);
  tok := public.create_trip_share(tid, array[1, 1]); r := r || '1 token len=' || length(tok) || ' | ';
  begin perform public.create_trip_share(tid, array[3]); r := r || '2 FAIL out of range | ';
  exception when others then r := r || '2 out of range blocked ' || sqlerrm || ' | '; end;
  begin perform public.create_trip_share(tid, array[]::int[]); r := r || '3 FAIL empty | ';
  exception when others then r := r || '3 empty blocked ' || sqlerrm || ' | '; end;

  reset role;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  j := public.public_trip_share(tok);
  r := r || '4 anon items=' || jsonb_array_length(j -> 'items') || ' first=' || (j -> 'items' -> 0 ->> 'title') || ' days=' || (j ->> 'days') || ' | ';
  r := r || '5 no memo=' || (position('비밀' in j::text) = 0) || ' no cost=' || (position('1000' in j::text) = 0) || ' | ';
  r := r || '6 bad token=' || coalesce(public.public_trip_share(repeat('0', 32))::text, 'null') || ' | ';
  begin select count(*) into n from public.trip_shares; r := r || '7 FAIL anon table ' || n || ' | ';
  exception when others then r := r || '7 anon table blocked | '; end;
  begin perform public.create_trip_share(tid, array[0]); r := r || '8 FAIL anon create | ';
  exception when others then r := r || '8 anon create blocked | '; end;

  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin perform public.create_trip_share(tid, array[0]); r := r || '9 FAIL stranger create | ';
  exception when others then r := r || '9 stranger blocked ' || sqlerrm || ' | '; end;
  begin perform public.revoke_trip_share(tid, tok); r := r || '10 FAIL stranger revoke | ';
  exception when others then r := r || '10 stranger revoke blocked ' || sqlerrm || ' | '; end;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.revoke_trip_share(tid, tok);
  reset role;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  r := r || '11 revoked=' || coalesce(public.public_trip_share(tok)::text, 'null') || ' | ';
  raise exception 'RESULTS(rolled back): %', r;
end $t$;
