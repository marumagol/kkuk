-- KKuK 준비 탭 + 얼굴 검사 (2단계 5~7). 전부 되돌림. 결과는 'RESULTS(rolled back): ...' 오류 문구
do $t$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); c uuid := gen_random_uuid(); d uuid := gen_random_uuid();
  tid uuid; tok text; n int; r text := ''; iid uuid;
begin
  insert into auth.users (id, instance_id, aud, role, email) values
    (a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'prep-a@example.com'),
    (b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'prep-b@example.com'),
    (c, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'prep-c@example.com'),
    (d, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'prep-d@example.com');
  insert into public.profiles (user_id, display_name) values (a, '가'), (b, '나'), (c, '다'), (d, '라');

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  tid := public.create_trip('준비 여행', '2027-03-01', '2027-03-03', 'Asia/Seoul', '[{"name":"부산","country_code":"KR"}]');
  tok := public.create_invite(tid, 'editor');
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.accept_invite(tok);
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  tok := public.create_invite(tid, 'viewer');
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.accept_invite(tok);
  select count(*) into n from public.profiles; r := r || '1 C sees profiles=' || n || ' | ';
  begin insert into public.checklist_items (trip_id, kind, title) values (tid, 'item', '여권'); r := r || '2 FAIL viewer add | ';
  exception when others then r := r || '2 viewer add blocked ok | '; end;
  begin insert into public.trip_budgets (trip_id, currency, total) values (tid, 'KRW', 100); r := r || '3 FAIL viewer budget | ';
  exception when others then r := r || '3 viewer budget blocked ok | '; end;

  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.checklist_items (trip_id, kind, title, assignee_id) values (tid, 'item', '여권', a) returning id into iid; r := r || '4 editor add ok | ';
  update public.checklist_items set done_at = now() where id = iid;
  select (done_by = b)::int into n from public.checklist_items where id = iid; r := r || '5 done_by set=' || n || ' | ';
  insert into public.trip_budgets (trip_id, currency, total) values (tid, 'KRW', 500000); r := r || '6 editor budget ok | ';
  update public.trip_budgets set total = 600000 where trip_id = tid; get diagnostics n = row_count; r := r || '7 budget update rows=' || n || ' | ';

  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.checklist_items where trip_id = tid; r := r || '8 viewer sees items=' || n || ' | ';
  update public.checklist_items set done_at = null where id = iid; get diagnostics n = row_count; r := r || '9 viewer uncheck rows=' || n || ' | ';

  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', d, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.profiles; r := r || '10 D sees profiles=' || n || ' | ';
  select count(*) into n from public.checklist_items; r := r || '11 D sees items=' || n || ' | ';
  select count(*) into n from public.trip_budgets; r := r || '12 D sees budgets=' || n || ' | ';
  begin insert into public.checklist_items (trip_id, kind, title) values (tid, 'item', '침입'); r := r || '13 FAIL outsider add';
  exception when others then r := r || '13 outsider add blocked ok'; end;
  reset role;
  raise exception 'RESULTS(rolled back): %', r;
end $t$;
