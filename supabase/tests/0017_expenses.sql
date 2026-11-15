-- KKuK 경비 검사 (0026). 전부 되돌림
do $t$
declare a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); c uuid := gen_random_uuid(); d uuid := gen_random_uuid();
  tid uuid; tok text; tokv text; eid uuid; r text := ''; n int; arr uuid[];
begin
  insert into auth.users (id, instance_id, aud, role, email) values
    (a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'e-a@example.com'),
    (b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'e-b@example.com'),
    (c, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'e-c@example.com'),
    (d, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'e-d@example.com');
  insert into public.profiles (user_id, display_name) values (a, '가'), (b, '나'), (c, '다'), (d, '라');
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  tid := public.create_trip('경비', '2027-05-01', '2027-05-03', 'Asia/Seoul', '[{"name":"부산","country_code":"KR"}]');
  tok := public.create_invite(tid, 'editor');
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  perform public.accept_invite(tok);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  tokv := public.create_invite(tid, 'viewer');
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  perform public.accept_invite(tokv);
  -- b(편집) 가 a,b 와 나눔, 중복은 하나로
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  insert into public.trip_expenses (trip_id, title, amount, currency, paid_by, split_with) values (tid, '저녁', 30000, 'KRW', b, array[a, b, b]) returning id, split_with into eid, arr;
  r := r || '1 editor add split=' || cardinality(arr) || ' | ';
  begin insert into public.trip_expenses (trip_id, title, amount, currency, paid_by, split_with) values (tid, '밖', 100, 'KRW', d, array[a]); r := r || '2 FAIL outsider payer | ';
  exception when others then r := r || '2 outsider payer -> ' || sqlerrm || ' | '; end;
  begin insert into public.trip_expenses (trip_id, title, amount, currency, paid_by, split_with) values (tid, '음수', -5, 'KRW', b, array[a]); r := r || '3 FAIL negative | ';
  exception when others then r := r || '3 negative blocked | '; end;
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  select count(*) into n from public.trip_expenses where trip_id = tid; r := r || '4 viewer sees=' || n || ' | ';
  begin insert into public.trip_expenses (trip_id, title, amount, currency, paid_by, split_with) values (tid, '보기만', 100, 'KRW', c, array[c]); r := r || '5 FAIL viewer add | ';
  exception when others then r := r || '5 viewer add blocked | '; end;
  update public.trip_expenses set amount = 1 where id = eid; get diagnostics n = row_count; r := r || '6 viewer update rows=' || n || ' | ';
  perform set_config('request.jwt.claims', json_build_object('sub', d, 'role', 'authenticated')::text, true);
  select count(*) into n from public.trip_expenses where trip_id = tid; r := r || '7 outsider sees=' || n || ' | ';
  -- b 가 나가도 기록 유지, 제목 수정은 됨
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  perform public.leave_trip(tid);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  update public.trip_expenses set title = '저녁 식사' where id = eid; get diagnostics n = row_count; r := r || '8 left payer kept, title edit rows=' || n || ' | ';
  update public.trip_expenses set removed_at = now() where id = eid; get diagnostics n = row_count; r := r || '9 remove rows=' || n || ' | ';
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  reset role; set local role anon;
  begin select count(*) into n from public.trip_expenses; r := r || '10 FAIL anon | ';
  exception when others then r := r || '10 anon blocked | '; end;
  raise exception 'RESULTS(rolled back): %', r;
end $t$;
