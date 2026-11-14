-- KKuK 권한 검사 (6단계). 가짜 사용자 4명으로 확인하고 마지막에 전부 되돌린다 (아무것도 남지 않음)
-- 결과는 일부러 'ERROR: RESULTS(rolled back): ...' 오류 문구로 나온다. 그 문구가 검사 결과다
do $t$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); c uuid := gen_random_uuid(); d uuid := gen_random_uuid();
  tid uuid; n int; r text := ''; iid uuid;
begin
  insert into auth.users (id, instance_id, aud, role, email) values
    (a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test-a@example.com'),
    (b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test-b@example.com'),
    (c, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test-c@example.com'),
    (d, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test-d@example.com');

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.profiles (user_id, display_name) values (a, '테스트가');
  r := r || '1 A profile insert ok | ';
  begin insert into public.profiles (user_id, display_name) values (b, '남의것'); r := r || '2 FAIL A made B profile | ';
  exception when others then r := r || '2 A cannot make B profile ok | '; end;
  begin insert into public.profiles (user_id, display_name) values (a, ''); r := r || '3 FAIL empty | ';
  exception when others then r := r || '3 empty name blocked ok | '; end;
  tid := public.create_trip('가짜 여행', '2027-01-01', '2027-01-03', 'Asia/Tokyo', '[{"name":"삿포로","country_code":"jp"},{"name":"오타루"}]');
  select count(*) into n from public.trip_cities where trip_id = tid; r := r || '4 create_trip cities=' || n || ' | ';
  select count(*) into n from public.trip_members where trip_id = tid and role='owner'; r := r || '5 owner rows=' || n || ' | ';
  begin insert into public.trips (title, start_date, end_date) values ('직접', '2027-01-01', '2027-01-02'); r := r || '6 FAIL direct trip insert | ';
  exception when others then r := r || '6 direct trip insert blocked ok | '; end;
  begin insert into public.trip_members (trip_id, user_id, role, display_name) values (tid, d, 'editor', 'x'); r := r || '7 FAIL direct member insert | ';
  exception when others then r := r || '7 direct member insert blocked ok | '; end;
  begin perform public.create_trip('나쁜 시간대', '2027-01-01', '2027-01-03', 'Mars/Base', '[{"name":"a"}]'); r := r || '8 FAIL tz | ';
  exception when others then r := r || '8 bad tz blocked (' || sqlerrm || ') | '; end;

  reset role;
  insert into public.trip_members (trip_id, user_id, role, display_name) values (tid, b, 'editor', '테스트나'), (tid, c, 'viewer', '테스트다');

  perform set_config('request.jwt.claims', json_build_object('sub', d, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.trips; r := r || '9 D sees trips=' || n;
  select count(*) into n from public.trip_members; r := r || ' members=' || n;
  select count(*) into n from public.trip_cities; r := r || ' cities=' || n || ' | ';
  update public.trips set title = '침입' where id = tid; get diagnostics n = row_count; r := r || '10 D update rows=' || n || ' | ';
  begin insert into public.itinerary_items (trip_id, title, created_by) values (tid, '침입', d); r := r || '11 FAIL D item | ';
  exception when others then r := r || '11 D item insert blocked ok | '; end;
  begin perform public.create_trip('이름없음', '2027-01-01', '2027-01-03', 'Asia/Seoul', '[{"name":"a"}]'); r := r || '12 FAIL | ';
  exception when others then r := r || '12 no profile -> ' || sqlerrm || ' | '; end;

  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.trips; r := r || '13 C sees trips=' || n;
  select count(*) into n from public.trip_members; r := r || ' members=' || n || ' | ';
  update public.trips set title = '보기만' where id = tid; get diagnostics n = row_count; r := r || '14 C update rows=' || n || ' | ';
  begin insert into public.itinerary_items (trip_id, title, created_by) values (tid, '보기만', c); r := r || '15 FAIL C item | ';
  exception when others then r := r || '15 C item insert blocked ok | '; end;
  delete from public.trip_cities where trip_id = tid; get diagnostics n = row_count; r := r || '16 C city delete rows=' || n || ' | ';

  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update public.trips set title = '편집함', created_by = b where id = tid; get diagnostics n = row_count; r := r || '17 B update rows=' || n;
  select (created_by = a and updated_by = b)::int into n from public.trips where id = tid; r := r || ' created_by kept+updated_by set=' || n || ' | ';
  insert into public.itinerary_items (trip_id, title, day_index, created_by) values (tid, '오르골당', 0, b) returning id into iid; r := r || '18 B item insert ok | ';
  begin insert into public.itinerary_items (trip_id, title, created_by) values (tid, '남 이름으로', a); r := r || '19 FAIL spoof | ';
  exception when others then r := r || '19 created_by spoof blocked ok | '; end;
  begin update public.trips set removed_at = now() where id = tid; r := r || '20 FAIL B removed trip | ';
  exception when others then r := r || '20 B delete trip -> ' || sqlerrm || ' | '; end;
  update public.itinerary_items set removed_at = now() where id = iid; get diagnostics n = row_count; r := r || '21 B item soft delete rows=' || n || ' | ';

  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update public.profiles set display_name = '새이름' where user_id = a;
  select count(*) into n from public.trip_members where trip_id = tid and user_id = a and display_name = '새이름'; r := r || '22 name sync=' || n || ' | ';
  update public.trips set removed_at = now() where id = tid; get diagnostics n = row_count; r := r || '23 A delete trip rows=' || n || ' | ';
  select count(*) into n from public.trips where id = tid and removed_at is not null; r := r || '24 A still sees removed=' || n || ' | ';
  begin insert into public.itinerary_items (trip_id, title, created_by) values (tid, '삭제 뒤', a); r := r || '25 FAIL insert after remove | ';
  exception when others then r := r || '25 insert into removed trip blocked ok | '; end;

  reset role;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  begin select count(*) into n from public.trips; r := r || '26 FAIL anon read ' || n;
  exception when others then r := r || '26 anon blocked ok'; end;
  reset role;
  raise exception 'RESULTS(rolled back): %', r;
end $t$;
