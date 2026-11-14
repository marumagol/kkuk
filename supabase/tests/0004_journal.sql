-- KKuK 여행일기 검사 (2단계 8). 전부 되돌림. 결과는 'RESULTS(rolled back): ...' 오류 문구
do $t$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); c uuid := gen_random_uuid(); d uuid := gen_random_uuid();
  tid uuid; tok text; n int; r text := ''; ja uuid;
begin
  insert into auth.users (id, instance_id, aud, role, email) values
    (a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'j-a@example.com'),
    (b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'j-b@example.com'),
    (c, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'j-c@example.com'),
    (d, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'j-d@example.com');
  insert into public.profiles (user_id, display_name) values (a, '가'), (b, '나'), (c, '다'), (d, '라');
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  tid := public.create_trip('일기 여행', '2027-04-01', '2027-04-03', 'Asia/Seoul', '[{"name":"제주","country_code":"KR"}]');
  tok := public.create_invite(tid, 'editor');
  insert into public.journal_entries (trip_id, kind, day_index, title, body) values (tid, 'day', 0, '첫날', '바다') returning id into ja;
  insert into public.journal_entries (trip_id, kind, day_index, body, visibility) values (tid, 'day', 1, '비밀', 'private');
  r := r || '1 A wrote 2 ok | ';
  begin insert into public.journal_entries (trip_id, kind, day_index, body) values (tid, 'day', 0, '또'); r := r || '2 FAIL two per day | ';
  exception when others then r := r || '2 one per day ok | '; end;
  begin insert into public.journal_entries (trip_id, kind, body, author_id) values (tid, 'recap', '남 이름', b); r := r || '3 FAIL spoof | ';
  exception when others then r := r || '3 author spoof blocked ok | '; end;
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
  select count(*) into n from public.journal_entries; r := r || '4 C sees entries=' || n || ' | ';
  insert into public.journal_entries (trip_id, kind, body) values (tid, 'recap', '보기만도 회고'); r := r || '5 viewer wrote own ok | ';
  update public.journal_entries set body = '고침' where id = ja; get diagnostics n = row_count; r := r || '6 C edit A rows=' || n || ' | ';
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.journal_entries; r := r || '7 B sees entries=' || n || ' | ';
  update public.journal_entries set removed_at = now() where id = ja; get diagnostics n = row_count; r := r || '8 B remove A rows=' || n || ' | ';
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', d, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.journal_entries; r := r || '9 D sees=' || n || ' | ';
  begin insert into public.journal_entries (trip_id, kind, body) values (tid, 'recap', '침입'); r := r || '10 FAIL outsider wrote | ';
  exception when others then r := r || '10 outsider blocked ok | '; end;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update public.journal_entries set body = '내가 고침', author_id = b, day_index = 2 where id = ja; get diagnostics n = row_count;
  select (author_id = a and day_index = 0)::int into n from public.journal_entries where id = ja; r := r || '11 A edit own, author/day kept=' || n || ' | ';
  update public.journal_entries set visibility = 'members' where trip_id = tid and day_index = 1;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.journal_entries; r := r || '12 C after A opened sees=' || n || ' | ';
  perform public.leave_trip(tid);
  select count(*) into n from public.journal_entries; r := r || '13 C after leave sees (own only)=' || n || ' | ';
  reset role;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  begin select count(*) into n from public.journal_entries; r := r || '14 FAIL anon read';
  exception when others then r := r || '14 anon blocked ok'; end;
  reset role;
  raise exception 'RESULTS(rolled back): %', r;
end $t$;
