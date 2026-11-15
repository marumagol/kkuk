-- KKuK 날짜 넘어 옮기기, 맞춤 칸 검사 (0030). 전부 되돌림
do $t$
declare a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); tid uuid; tok text; i1 uuid; i2 uuid; i3 uuid; r text := ''; n int; d int;
begin
  insert into auth.users (id, instance_id, aud, role, email) values
    (a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'm-a@example.com'),
    (b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'm-b@example.com');
  insert into public.profiles (user_id, display_name) values (a, '가'), (b, '나');
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  tid := public.create_trip('옮기기', '2027-05-01', '2027-05-03', 'Asia/Seoul', '[{"name":"부산","country_code":"KR"}]');
  tok := public.create_invite(tid, 'viewer');
  insert into public.itinerary_items (trip_id, day_index, sort_order, title, details) values (tid, 0, 0, '하나', '{"booking":"AB1"}') returning id into i1;
  insert into public.itinerary_items (trip_id, day_index, sort_order, title) values (tid, 1, 0, '둘') returning id into i2;
  insert into public.itinerary_items (trip_id, day_index, sort_order, title) values (tid, 1, 1, '셋') returning id into i3;
  perform public.move_item(tid, i1, 1, array[i2, i1, i3]);
  select day_index into d from public.itinerary_items where id = i1; r := r || '1 moved day=' || d || ' | ';
  select sort_order into n from public.itinerary_items where id = i1; r := r || '2 order=' || n || ' | ';
  perform public.move_item(tid, i1, null, array[i1]);
  select count(*) into n from public.itinerary_items where id = i1 and day_index is null; r := r || '3 undated=' || n || ' | ';
  begin perform public.move_item(tid, i1, 3, array[i1]); r := r || '4 FAIL out of range | ';
  exception when others then r := r || '4 range blocked | '; end;
  begin insert into public.itinerary_items (trip_id, title, details) values (tid, '틀림', '[1]'); r := r || '5 FAIL array | ';
  exception when others then r := r || '5 array blocked | '; end;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  perform public.accept_invite(tok);
  begin perform public.move_item(tid, i2, 0, array[i2]); r := r || '6 FAIL viewer moved | ';
  exception when others then r := r || '6 viewer blocked | '; end;
  reset role;
  raise exception 'RESULTS(rolled back): %', r;
end $t$;
