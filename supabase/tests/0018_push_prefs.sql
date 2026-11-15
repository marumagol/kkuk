-- KKuK 알림 종류별 끄기 검사 (0027). 전부 되돌림
do $t$
declare a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); tid uuid; tok text; r text := ''; n int;
begin
  insert into auth.users (id, instance_id, aud, role, email) values
    (a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'q-a@example.com'),
    (b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'q-b@example.com');
  insert into public.profiles (user_id, display_name) values (a, '가'), (b, '나');
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  tid := public.create_trip('끄기', '2027-05-01', '2027-05-03', 'Asia/Seoul', '[{"name":"부산","country_code":"KR"}]');
  tok := public.create_invite(tid, 'editor');
  perform public.save_push_subscription('https://push.example/q', 'p', 'x');
  insert into public.push_prefs (off_kinds) values (array['items']);
  begin insert into public.push_prefs (user_id, off_kinds) values (b, '{}'); r := r || '1 FAIL spoof | ';
  exception when others then r := r || '1 spoof blocked | '; end;
  begin update public.push_prefs set off_kinds = array['bad']; r := r || '2 FAIL bad kind | ';
  exception when others then r := r || '2 bad kind blocked | '; end;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  perform public.accept_invite(tok);
  insert into public.itinerary_items (trip_id, day_index, title) values (tid, 0, '장소');
  reset role; set local role service_role;
  select count(*) into n from public.push_take_pending(); r := r || '3 pushed (joined only)=' || n || ' | ';
  reset role;
  select count(*) into n from public.notifications where user_id = a; r := r || '4 in-app kept=' || n || ' | ';
  raise exception 'RESULTS(rolled back): %', r;
end $t$;
