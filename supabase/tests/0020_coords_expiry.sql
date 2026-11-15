-- KKuK 좌표 30일 검사 (0029). 전부 되돌림
do $t$
declare a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); tid uuid; tok text; iid uuid; r text := ''; n int; ok boolean; u timestamptz; u2 timestamptz;
begin
  insert into auth.users (id, instance_id, aud, role, email) values
    (a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'k-a@example.com'),
    (b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'k-b@example.com');
  insert into public.profiles (user_id, display_name) values (a, '가'), (b, '나');
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  tid := public.create_trip('좌표', '2027-05-01', '2027-05-03', 'Asia/Seoul', '[{"name":"부산","country_code":"KR"}]');
  tok := public.create_invite(tid, 'viewer');
  insert into public.itinerary_items (trip_id, day_index, title, google_place_id, lat, lng, coords_at) values (tid, 0, '검색 장소', 'ChIJabcdefghij', 35.1, 129.0, now()) returning id into iid;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  perform public.accept_invite(tok);
  reset role; perform set_config('request.jwt.claims', '{}', true);
  update public.itinerary_items set coords_at = now() - interval '31 days' where id = iid;
  select updated_at into u from public.itinerary_items where id = iid;
  perform private.expire_coords();
  select count(*) into n from public.itinerary_items where id = iid and lat is null and google_place_id is not null; r := r || '1 expired kept id=' || n || ' | ';
  select updated_at into u2 from public.itinerary_items where id = iid; r := r || '2 updated_at kept=' || (u = u2) || ' | ';
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  ok := public.refill_coords('item', iid, 'wrongplaceid1', 1, 1); r := r || '3 wrong id=' || ok || ' | ';
  ok := public.refill_coords('item', iid, 'ChIJabcdefghij', 35.2, 129.1); r := r || '4 viewer refill=' || ok || ' | ';
  ok := public.refill_coords('item', iid, 'ChIJabcdefghij', 0, 0); r := r || '5 again (not empty)=' || ok || ' | ';
  reset role;
  select count(*) into n from public.notifications where user_id = a and kind = 'items'; r := r || '6 no item notice=' || (n = 0) || ' | ';
  select updated_at into u2 from public.itinerary_items where id = iid; r := r || '7 updated_at kept=' || (u = u2) || ' | ';
  raise exception 'RESULTS(rolled back): %', r;
end $t$;
