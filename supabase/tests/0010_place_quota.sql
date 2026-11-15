-- KKuK 장소 검색 하루 상한 검사. 전부 되돌림. 결과는 'RESULTS(rolled back): ...' 오류 문구
do $t$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid();
  i int; ok boolean; n int; r text := '';
begin
  insert into auth.users (id, instance_id, aud, role, email) values
    (a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'q-a@example.com'),
    (b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'q-b@example.com');
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  n := 0; for i in 1..150 loop if public.take_place_quota('autocomplete') then n := n + 1; end if; end loop;
  r := r || '1 first 150 allowed=' || n || ' | ';
  r := r || '2 151st=' || public.take_place_quota('autocomplete') || ' | ';
  n := 0; for i in 1..45 loop if public.take_place_quota('details') then n := n + 1; end if; end loop;
  r := r || '3 details allowed=' || n || ' (cap 40) | ';
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  r := r || '4 other user still ok=' || public.take_place_quota('autocomplete') || ' | ';
  begin perform public.take_place_quota('bad'); r := r || '5 FAIL bad kind | ';
  exception when others then r := r || '5 bad kind blocked | '; end;
  begin select count(*) into n from public.place_usage; r := r || '6 FAIL table read ' || n || ' | ';
  exception when others then r := r || '6 table read blocked | '; end;
  reset role;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  begin perform public.take_place_quota('autocomplete'); r := r || '7 FAIL anon | ';
  exception when others then r := r || '7 anon blocked | '; end;
  reset role;
  select sum(u.n) into n from public.place_usage u where u.kind = 'autocomplete'; r := r || '8 global autocomplete total=' || n || ' | ';
  raise exception 'RESULTS(rolled back): %', r;
end $t$;
