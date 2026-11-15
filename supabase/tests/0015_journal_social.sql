-- KKuK 일기 좋아요, 댓글 검사 (0022). 전부 되돌림. 결과는 'RESULTS(rolled back): ...' 오류 문구
-- a 주인(일기 씀), b 보기만으로 함께함, c 함께하지 않음
do $t$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); c uuid := gen_random_uuid();
  tid uuid; tok text; e1 uuid; e2 uuid; cid uuid; cid2 uuid; n int; n2 int; s text; r text := '';
begin
  insert into auth.users (id, instance_id, aud, role, email) values
    (a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 's-a@example.com'),
    (b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 's-b@example.com'),
    (c, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 's-c@example.com');
  insert into public.profiles (user_id, display_name) values (a, '가'), (b, '나'), (c, '다');
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  tid := public.create_trip('피드 여행', current_date, current_date + 2, 'Asia/Seoul', '[{"name":"서울","country_code":"KR"}]');
  tok := public.create_invite(tid, 'viewer');
  insert into public.journal_entries (trip_id, kind, day_index, body) values (tid, 'day', 0, '함께 보는 글') returning id into e1;
  insert into public.journal_entries (trip_id, kind, day_index, body, visibility) values (tid, 'day', 1, '나만 보는 글', 'private') returning id into e2;
  insert into public.journal_likes (entry_id) values (e1);
  r := r || '1 author likes own ok | ';
  begin insert into public.journal_likes (entry_id) values (e2); r := r || '2 FAIL like on private | ';
  exception when others then r := r || '2 private like blocked | '; end;
  begin insert into public.journal_comments (entry_id, body) values (e2, '혼잣말'); r := r || '3 FAIL comment on private | ';
  exception when others then r := r || '3 private comment blocked | '; end;
  reset role;

  -- b : 보기만으로 들어옴
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.accept_invite(tok);
  insert into public.journal_likes (entry_id) values (e1);
  insert into public.journal_comments (entry_id, body) values (e1, '좋다') returning id into cid;
  insert into public.journal_comments (entry_id, body) values (e1, '또 가자') returning id into cid2;
  r := r || '4 viewer like+comment ok | ';
  begin insert into public.journal_likes (entry_id) values (e1); r := r || '5 FAIL double like | ';
  exception when unique_violation then r := r || '5 double like blocked | '; end;
  begin insert into public.journal_likes (entry_id, user_id) values (e1, c); r := r || '6 FAIL like as other | ';
  exception when others then r := r || '6 like as other blocked | '; end;
  begin insert into public.journal_comments (entry_id, author_id, body) values (e1, a, '사칭'); r := r || '7 FAIL comment as other | ';
  exception when others then r := r || '7 comment as other blocked | '; end;
  begin insert into public.journal_comments (entry_id, body) values (e1, repeat('가', 501)); r := r || '8 FAIL 501 chars | ';
  exception when others then r := r || '8 501 chars blocked | '; end;
  begin insert into public.journal_comments (entry_id, body) values (e1, '  '); r := r || '9 FAIL blank | ';
  exception when others then r := r || '9 blank blocked | '; end;
  begin update public.journal_comments set body = '고침' where id = cid; r := r || '10 FAIL edit | ';
  exception when others then r := r || '10 edit blocked | '; end;
  select likes || '/' || liked || '/' || comments into s from public.journal_counts(array[e1]); r := r || '11 counts b=' || s || ' | ';
  select likes || '/' || liked || '/' || comments into s from public.journal_counts(array[e2]); r := r || '12 private counts b=' || s || ' | ';
  reset role;
  select count(*), max(count), max(detail) into n, n2, s from public.notifications where user_id = a and kind = 'comment';
  r := r || '13 author notified rows=' || n || ' count=' || n2 || ' last=' || s || ' | ';
  select count(*) into n from public.notifications where user_id = b and kind = 'comment'; r := r || '14 commenter self=' || n || ' | ';

  -- c : 함께하지 않는 사람
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select (select count(*) from public.journal_likes) + (select count(*) from public.journal_comments) into n; r := r || '15 outsider sees=' || n || ' | ';
  begin insert into public.journal_likes (entry_id) values (e1); r := r || '16 FAIL outsider like | ';
  exception when others then r := r || '16 outsider like blocked | '; end;
  begin insert into public.journal_comments (entry_id, body) values (e1, '누구세요'); r := r || '17 FAIL outsider comment | ';
  exception when others then r := r || '17 outsider comment blocked | '; end;
  delete from public.journal_comments where id = cid; get diagnostics n = row_count; r := r || '18 outsider delete rows=' || n || ' | ';
  reset role;

  -- a : 일기 쓴 사람이 남의 댓글을 지움, 자기 댓글은 알림 없음, 남의 좋아요는 못 지움
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  delete from public.journal_comments where id = cid; get diagnostics n = row_count; r := r || '19 entry author deletes comment rows=' || n || ' | ';
  delete from public.journal_likes where entry_id = e1 and user_id = b; get diagnostics n = row_count; r := r || '20 delete other like rows=' || n || ' | ';
  insert into public.journal_comments (entry_id, body) values (e1, '고마워');
  reset role;
  select count(*) into n from public.notifications where kind = 'comment' and actor_id = a; r := r || '21 own comment notif=' || n || ' | ';

  -- b : 일기 쓴 사람의 댓글은 못 지우고 자기 것만 지움, 좋아요 취소
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  delete from public.journal_comments where entry_id = e1 and author_id = a; get diagnostics n = row_count; r := r || '22 delete others comment rows=' || n || ' | ';
  delete from public.journal_comments where id = cid2; get diagnostics n = row_count; r := r || '23 delete own comment rows=' || n || ' | ';
  delete from public.journal_likes where entry_id = e1 and user_id = b; get diagnostics n = row_count; r := r || '24 unlike rows=' || n || ' | ';
  insert into public.journal_likes (entry_id) values (e1);
  reset role;

  -- 공개 범위 바꾸기 : 나만 보기로 바꾸면 가려지고, 되돌리면 다시 보인다
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update public.journal_entries set visibility = 'private' where id = e1;
  select (select count(*) from public.journal_likes) + (select count(*) from public.journal_comments) into n; r := r || '25 hidden while private=' || n || ' | ';
  update public.journal_entries set visibility = 'public' where id = e1;
  select share_token into tok from public.journal_entries where id = e1;
  select likes || '/' || liked || '/' || comments into s from public.journal_counts(array[e1]); r := r || '26 back after public=' || s || ' | ';
  reset role;

  -- 링크로 본 사람 : 좋아요 수만, 표는 못 읽고 못 씀
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  select p.like_count into n from public.public_entry(tok) p; r := r || '27 anon like_count=' || n || ' | ';
  begin select count(*) into n from public.journal_comments; r := r || '28 FAIL anon reads comments | ';
  exception when others then r := r || '28 anon comments blocked | '; end;
  begin select count(*) into n from public.journal_likes; r := r || '29 FAIL anon reads likes | ';
  exception when others then r := r || '29 anon likes blocked | '; end;
  begin perform public.journal_counts(array[e1]); r := r || '30 FAIL anon counts | ';
  exception when others then r := r || '30 anon counts blocked | '; end;
  reset role;

  -- 일기를 지우면, 여행을 지우면 더 못 단다. 내보낸 사람도 못 본다
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.remove_member((select m.id from public.trip_members m where m.trip_id = tid and m.user_id = b));
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select (select count(*) from public.journal_likes) + (select count(*) from public.journal_comments) into n; r := r || '31 removed member sees=' || n || ' | ';
  begin insert into public.journal_comments (entry_id, body) values (e1, '나간 뒤'); r := r || '32 FAIL removed member comment | ';
  exception when others then r := r || '32 removed member comment blocked | '; end;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update public.journal_entries set removed_at = now() where id = e1;
  begin insert into public.journal_comments (entry_id, body) values (e1, '지운 글'); r := r || '33 FAIL comment on removed entry | ';
  exception when others then r := r || '33 removed entry comment blocked | '; end;
  reset role;
  raise exception 'RESULTS(rolled back): %', r;
end $t$;
