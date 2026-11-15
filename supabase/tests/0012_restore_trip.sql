-- KKuK 삭제한 여행 되살리기 검사 (0019). 전부 되돌림
do $t$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); tid uuid; tok text; r text := ''; n int;
begin
  insert into auth.users (id, instance_id, aud, role, email) values
    (a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'r-a@example.com'),
    (b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'r-b@example.com');
  insert into public.profiles (user_id, display_name) values (a, '가'), (b, '나');
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  tid := public.create_trip('되살리기', '2027-05-01', '2027-05-03', 'Asia/Seoul', '[{"name":"부산","country_code":"KR"}]');
  tok := public.create_invite(tid, 'editor');
  begin perform public.restore_trip(tid); r := r || '1 FAIL not removed | ';
  exception when others then r := r || '1 not removed -> ' || sqlerrm || ' | '; end;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  perform public.accept_invite(tok);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  update public.trips set removed_at = now() where id = tid;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  begin perform public.restore_trip(tid); r := r || '2 FAIL editor | ';
  exception when others then r := r || '2 editor -> ' || sqlerrm || ' | '; end;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  perform public.restore_trip(tid);
  select count(*) into n from public.trips where id = tid and removed_at is null;
  r := r || '3 owner restored=' || n || ' | ';
  update public.trips set removed_at = now() where id = tid;
  reset role;
  update public.trips set removed_at = now() - interval '31 days' where id = tid;
  set local role authenticated;
  begin perform public.restore_trip(tid); r := r || '4 FAIL old | ';
  exception when others then r := r || '4 old -> ' || sqlerrm || ' | '; end;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  reset role; set local role anon;
  begin perform public.restore_trip(tid); r := r || '5 FAIL anon | ';
  exception when others then r := r || '5 anon blocked | '; end;
  raise exception 'RESULTS(rolled back): %', r;
end $t$;
