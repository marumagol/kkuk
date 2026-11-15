-- KKuK 여행 등급과 한도 검사 (0020). 전부 되돌림
do $t$
declare
  a uuid := gen_random_uuid(); tid uuid; iid uuid; tok text; r text := ''; j jsonb; p text; i int; u uuid;
begin
  insert into auth.users (id, instance_id, aud, role, email) values (a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'p-a@example.com');
  insert into public.profiles (user_id, display_name) values (a, '가');
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  tid := public.create_trip('등급', '2027-05-01', '2027-05-03', 'Asia/Seoul', '[{"name":"부산","country_code":"KR"}]');
  j := public.trip_limits(tid);
  r := r || '1 limits=' || j::text || ' | ';
  update public.trips set plan = 'pass' where id = tid;
  select plan into p from public.trips where id = tid;
  r := r || '2 user cannot set plan=' || p || ' | ';
  insert into public.itinerary_items (trip_id, day_index, title, photos) values (tid, 0, '다섯 장', array['1','2','3','4','5']) returning id into iid;
  begin update public.itinerary_items set photos = array['1','2','3','4','5','6'] where id = iid; r := r || '3 FAIL 6 photos | ';
  exception when others then r := r || '3 6th photo -> ' || sqlerrm || ' | '; end;
  begin insert into public.journal_entries (trip_id, author_id, kind, day_index, title, body, photos)
    values (tid, a, 'day', 0, 't', 'b', array['1','2','3','4','5','6','7','8','9','10','11']); r := r || '4 FAIL 11 | ';
  exception when others then r := r || '4 11 entry photos -> ' || sqlerrm || ' | '; end;
  -- 등급이 pass 면 늘어남 (서버 관리 작업으로 등급 바꾸기)
  reset role; perform set_config('request.jwt.claims', '{}', true);
  insert into public.plan_limits values ('pass', 3, 8, 20);
  update public.trips set plan = 'pass' where id = tid;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update public.itinerary_items set photos = array['1','2','3','4','5','6'] where id = iid;
  r := r || '5 pass 6 photos ok | ';
  -- 한도가 줄어도 이미 올린 건 그대로, 줄이는 수정은 됨
  reset role; perform set_config('request.jwt.claims', '{}', true);
  update public.trips set plan = 'free' where id = tid;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update public.itinerary_items set title = '이름만' , photos = array['1','2','3','4','5','6'] where id = iid;
  update public.itinerary_items set photos = array['1','2','3','4','5'] where id = iid;
  r := r || '6 over-limit kept and shrink ok | ';
  -- 인원 : pass 한도 3명
  reset role; perform set_config('request.jwt.claims', '{}', true);
  update public.trips set plan = 'pass' where id = tid;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  tok := public.create_invite(tid, 'viewer');
  for i in 1..3 loop
    u := gen_random_uuid();
    reset role;
    insert into auth.users (id, instance_id, aud, role, email) values (u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'p' || i || '@example.com');
    insert into public.profiles (user_id, display_name) values (u, '사람' || i);
    perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
    set local role authenticated;
    begin perform public.accept_invite(tok); r := r || '7.' || i || ' joined | ';
    exception when others then r := r || '7.' || i || ' ' || sqlerrm || ' | '; end;
  end loop;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  reset role; set local role anon;
  begin j := public.trip_limits(tid); r := r || '8 FAIL anon | ';
  exception when others then r := r || '8 anon blocked | '; end;
  raise exception 'RESULTS(rolled back): %', r;
end $t$;
