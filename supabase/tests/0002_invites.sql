-- KKuK 같이 쓰기 검사 (2단계 0). 가짜 사용자 4명, 마지막에 전부 되돌림
-- 결과는 일부러 'ERROR: RESULTS(rolled back): ...' 오류 문구로 나온다
do $t$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); c uuid := gen_random_uuid(); d uuid := gen_random_uuid();
  tid uuid; tok text; tok2 text; n int; r text := ''; s text; mb uuid;
begin
  insert into auth.users (id, instance_id, aud, role, email) values
    (a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'inv-a@example.com'),
    (b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'inv-b@example.com'),
    (c, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'inv-c@example.com'),
    (d, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'inv-d@example.com');
  insert into public.profiles (user_id, display_name) values (a, '가'), (b, '나'), (c, '다'), (d, '라');

  -- A : 여행 만들고 편집 가능 링크
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  tid := public.create_trip('같이 여행', '2027-02-01', '2027-02-03', 'Asia/Tokyo', '[{"name":"도쿄","country_code":"JP"}]');
  tok := public.create_invite(tid, 'editor');
  r := r || '1 owner made link ok | ';
  select count(*) into n from public.trip_invites where trip_id = tid; r := r || '2 owner sees link rows=' || n || ' | ';

  -- B : 링크 보기, 참여
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select p.status into s from public.invite_preview(tok) p; r := r || '3 B preview=' || s || ' | ';
  select count(*) into n from public.trip_invites; r := r || '4 B sees links=' || n || ' | ';
  perform public.accept_invite(tok);
  select count(*) into n from public.trips where id = tid; r := r || '5 B joined sees trip=' || n || ' | ';
  perform public.accept_invite(tok); select count(*) into n from public.trip_members where trip_id = tid and user_id = b and removed_at is null; r := r || '6 B join twice rows=' || n || ' | ';
  begin tok2 := public.create_invite(tid, 'viewer'); r := r || '7 FAIL editor made link | ';
  exception when others then r := r || '7 editor link -> ' || sqlerrm || ' | '; end;
  select id into mb from public.trip_members where trip_id = tid and user_id = b;
  begin perform public.transfer_owner(mb); r := r || '8 FAIL editor transfer | ';
  exception when others then r := r || '8 editor transfer -> ' || sqlerrm || ' | '; end;
  begin update public.trip_members set role = 'owner' where id = mb; get diagnostics n = row_count; r := r || '9 direct role update rows=' || n || ' | ';
  exception when others then r := r || '9 direct role update blocked ok | '; end;

  -- A : 보기만 링크로 바꾸면 예전 링크는 끊김
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  tok2 := public.create_invite(tid, 'viewer');
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin perform public.accept_invite(tok); r := r || '10 FAIL old link worked | ';
  exception when others then r := r || '10 old link -> ' || sqlerrm || ' | '; end;
  perform public.accept_invite(tok2);
  select role into s from public.trip_members where trip_id = tid and user_id = c and removed_at is null; r := r || '11 C role=' || s || ' | ';
  begin insert into public.itinerary_items (trip_id, title, created_by) values (tid, '보기만', c); r := r || '12 FAIL viewer inserted | ';
  exception when others then r := r || '12 viewer item blocked ok | '; end;
  begin perform public.leave_trip(tid); r := r || '13 C left ok | ';
  exception when others then r := r || '13 FAIL C leave ' || sqlerrm || ' | '; end;
  select count(*) into n from public.trips where id = tid; r := r || '14 C after leave sees trip=' || n || ' | ';

  -- D : 끊긴 링크, 이상한 링크
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.revoke_invite(tid);
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', d, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select p.status into s from public.invite_preview(tok2) p; r := r || '15 revoked preview=' || s || ' | ';
  begin perform public.accept_invite(tok2); r := r || '16 FAIL revoked worked | ';
  exception when others then r := r || '16 revoked -> ' || sqlerrm || ' | '; end;
  select p.status into s from public.invite_preview('0000') p; r := r || '17 bad token=' || s || ' | ';
  begin perform public.remove_member(mb); r := r || '18 FAIL outsider removed | ';
  exception when others then r := r || '18 outsider remove -> ' || sqlerrm || ' | '; end;

  -- A : 권한 바꾸기, 주인 넘기기, 주인 나가기
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin perform public.leave_trip(tid); r := r || '19 FAIL owner left | ';
  exception when others then r := r || '19 owner leave -> ' || sqlerrm || ' | '; end;
  perform public.set_member_role(mb, 'viewer');
  select role into s from public.trip_members where id = mb; r := r || '20 B now=' || s || ' | ';
  perform public.transfer_owner(mb);
  select string_agg(display_name || ':' || role, ',' order by display_name) into s from public.trip_members where trip_id = tid and removed_at is null; r := r || '21 after transfer ' || s || ' | ';
  begin perform public.create_invite(tid, 'editor'); r := r || '22 FAIL old owner made link | ';
  exception when others then r := r || '22 old owner link -> ' || sqlerrm || ' | '; end;
  perform public.leave_trip(tid); select count(*) into n from public.trips where id = tid; r := r || '23 A left, sees=' || n || ' | ';

  -- 로그인 전 : 미리 보기만 되고 참여, 표 읽기는 막힘
  reset role;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  begin select p.status into s from public.invite_preview(tok2) p; r := r || '24 anon preview=' || s || ' | ';
  exception when others then r := r || '24 FAIL anon preview ' || sqlerrm || ' | '; end;
  begin perform public.accept_invite(tok2); r := r || '25 FAIL anon accept';
  exception when others then r := r || '25 anon accept blocked ok'; end;
  reset role;
  raise exception 'RESULTS(rolled back): %', r;
end $t$;
