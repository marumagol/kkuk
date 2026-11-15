-- KKuK 일기 답글 검사 (0024). 전부 되돌림. 결과는 'RESULTS(rolled back): ...' 오류 문구
-- a 일기 쓴 사람, b 댓글 쓴 사람, c 답글 쓴 사람 (셋 다 함께함)
do $t$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); c uuid := gen_random_uuid();
  tid uuid; tok text; e1 uuid; e2 uuid; c1 uuid; c2 uuid; r1 uuid; n int; s text; r text := '';
begin
  insert into auth.users (id, instance_id, aud, role, email) values
    (a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'r-a@example.com'),
    (b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'r-b@example.com'),
    (c, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'r-c@example.com');
  insert into public.profiles (user_id, display_name) values (a, '가'), (b, '나'), (c, '다');
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  tid := public.create_trip('답글 여행', current_date, current_date + 2, 'Asia/Seoul', '[{"name":"서울","country_code":"KR"}]');
  tok := public.create_invite(tid, 'viewer');
  insert into public.journal_entries (trip_id, kind, day_index, body) values (tid, 'day', 0, '첫날') returning id into e1;
  insert into public.journal_entries (trip_id, kind, day_index, body) values (tid, 'day', 1, '둘째날') returning id into e2;
  insert into public.journal_comments (entry_id, body) values (e1, '내 글에 내가') returning id into c2;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.accept_invite(tok);
  insert into public.journal_comments (entry_id, body) values (e1, '좋다') returning id into c1;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.accept_invite(tok);
  insert into public.journal_comments (entry_id, parent_id, body) values (e1, c1, '나도') returning id into r1;
  r := r || '1 reply ok | ';
  begin insert into public.journal_comments (entry_id, parent_id, body) values (e1, r1, '더 깊게'); r := r || '2 FAIL depth 2 | ';
  exception when others then r := r || '2 depth 2 blocked | '; end;
  begin insert into public.journal_comments (entry_id, parent_id, body) values (e2, c1, '다른 글'); r := r || '3 FAIL other entry parent | ';
  exception when others then r := r || '3 other entry parent blocked | '; end;
  begin insert into public.journal_comments (entry_id, parent_id, body) values (e1, gen_random_uuid(), '없는 댓글'); r := r || '4 FAIL missing parent | ';
  exception when others then r := r || '4 missing parent blocked | '; end;
  insert into public.journal_comments (entry_id, parent_id, body) values (e1, c1, '한 번 더');
  insert into public.journal_comments (entry_id, parent_id, body) values (e1, c2, '주인 댓글에 답글');
  reset role;
  select count(*), max(count) into n, s from public.notifications where user_id = b and kind = 'reply'; r := r || '5 parent author reply notif rows=' || n || ' count=' || s || ' | ';
  select count(*) into n from public.notifications where user_id = a and kind = 'reply'; r := r || '6 entry author no reply dup=' || n || ' | ';
  select max(count) into n from public.notifications where user_id = a and kind = 'comment' and actor_id = c; r := r || '7 entry author comment count=' || n || ' | ';
  select count(*) into n from public.notifications where user_id = c; r := r || '8 replier self=' || n || ' | ';
  select count(*) into n from public.push_take_pending() p where p.body like '%답글%'; r := r || '9 push text rows(no subs)=' || n || ' | ';
  -- 댓글 지우면 답글도
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  delete from public.journal_comments where id = c1;
  select count(*) into n from public.journal_comments where parent_id = c1; r := r || '10 replies after parent delete=' || n || ' | ';
  select comments into n from public.journal_counts(array[e1]); r := r || '11 count=' || n || ' | ';
  reset role;
  raise exception 'RESULTS(rolled back): %', r;
end $t$;
