-- KKuK 휴대폰 푸시 검사 (0023). 전부 되돌림
do $t$
declare a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); tid uuid; tok text; r text := ''; n int; j jsonb;
begin
  insert into auth.users (id, instance_id, aud, role, email) values
    (a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'w-a@example.com'),
    (b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'w-b@example.com');
  insert into public.profiles (user_id, display_name) values (a, '가'), (b, '나');
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  tid := public.create_trip('푸시', '2027-05-01', '2027-05-03', 'Asia/Seoul', '[{"name":"부산","country_code":"KR"}]');
  tok := public.create_invite(tid, 'editor');
  perform public.save_push_subscription('https://push.example/a', 'p', 'x');
  begin insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values (b, 'https://push.example/spoof', 'p', 'x'); r := r || '1 FAIL spoof | ';
  exception when others then r := r || '1 spoof blocked | '; end;
  begin perform public.push_take_pending(); r := r || '2 FAIL user take | ';
  exception when others then r := r || '2 user cannot take | '; end;
  begin j := public.push_keys(); r := r || '3 FAIL user keys | ';
  exception when others then r := r || '3 user cannot read keys | '; end;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  select count(*) into n from public.push_subscriptions;
  r := r || '4 b sees subs=' || n || ' | ';
  perform public.accept_invite(tok);   -- a 에게 joined 알림
  reset role;
  select count(*) into n from net.calls; r := r || '5 woke push=' || n || ' | ';
  set local role service_role;
  select count(*) into n from public.push_take_pending(); r := r || '6 pending=' || n || ' | ';
  select count(*) into n from public.push_take_pending(); r := r || '7 again=' || n || ' | ';
  j := public.push_keys('PUB', 'PRIV'); j := public.push_keys('PUB2', 'PRIV2');
  r := r || '8 keys kept=' || (j ->> 'public') || ' | ';
  perform public.push_drop('https://push.example/a');
  reset role;
  select count(*) into n from public.push_subscriptions; r := r || '9 dropped left=' || n || ' | ';
  raise exception 'RESULTS(rolled back): %', r;
end $t$;
