-- KKuK 앱 안 알림 검사 (4단계 8). 전부 되돌림. 결과는 'RESULTS(rolled back): ...' 오류 문구
do $t$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); c uuid := gen_random_uuid();
  tid uuid; tok text; iid uuid; n int; s text; r text := '';
begin
  insert into auth.users (id, instance_id, aud, role, email) values
    (a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'n-a@example.com'),
    (b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'n-b@example.com'),
    (c, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'n-c@example.com');
  insert into public.profiles (user_id, display_name) values (a, '가'), (b, '나'), (c, '다');
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  tid := public.create_trip('알림 여행', current_date, current_date + 2, 'Asia/Seoul', '[{"name":"서울","country_code":"KR"}]');
  tok := public.create_invite(tid, 'editor');
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.accept_invite(tok);
  reset role;
  select count(*) into n from public.notifications where user_id = a and kind = 'joined' and actor_name = '나'; r := r || '1 owner got joined=' || n || ' | ';
  select count(*) into n from public.notifications where user_id = b; r := r || '2 joiner self=' || n || ' | ';

  set local role authenticated;
  insert into public.itinerary_items (trip_id, day_index, title) values (tid, 0, '경복궁') returning id into iid;
  update public.itinerary_items set title = '경복궁 야간' where id = iid;
  insert into public.itinerary_items (trip_id, day_index, title) values (tid, 1, '남산');
  reset role;
  select count(*), max(count), max(detail) into n, tok, s from public.notifications where user_id = a and kind = 'items';
  r := r || '3 items grouped rows=' || n || ' count=' || tok || ' last=' || s || ' | ';
  select count(*) into n from public.notifications where user_id = b and kind = 'items'; r := r || '4 actor self=' || n || ' | ';

  set local role authenticated;
  insert into public.journal_entries (trip_id, kind, day_index, body, visibility) values (tid, 'day', 0, '혼자', 'private');
  insert into public.journal_entries (trip_id, kind, day_index, title, body) values (tid, 'day', 1, '둘째날', '같이');
  select count(*) into n from public.notifications; r := r || '5 b sees own only rows=' || n || ' | ';
  begin insert into public.notifications (user_id, trip_id, kind) values (a, tid, 'joined'); r := r || '6 FAIL direct insert | ';
  exception when others then r := r || '6 direct insert blocked | '; end;
  reset role;
  select count(*), max(detail) into n, s from public.notifications where user_id = a and kind = 'journal'; r := r || '7 journal=' || n || ' ' || s || ' | ';

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.notifications where read_at is null; r := r || '8 a unread=' || n || ' | ';
  perform public.mark_notifications_read();
  select count(*) into n from public.notifications where read_at is null; r := r || '9 after read=' || n || ' | ';
  update public.itinerary_items set title = '남산타워' where title = '남산';
  reset role;
  select count(*) into n from public.notifications where user_id = b and kind = 'items'; r := r || '10 b got items from a=' || n || ' | ';
  raise exception 'RESULTS(rolled back): %', r;
end $t$;
