-- KKuK 일기 링크 공개 검사 (3단계 6). 전부 되돌림. 결과는 'RESULTS(rolled back): ...' 오류 문구
do $t$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid();
  tid uuid; eid uuid; tok text; tok2 text; n int; r text := ''; s text;
begin
  insert into auth.users (id, instance_id, aud, role, email) values
    (a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'p-a@example.com'),
    (b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'p-b@example.com');
  insert into public.profiles (user_id, display_name) values (a, '가'), (b, '나');
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  tid := public.create_trip('공개 여행', '2027-05-01', '2027-05-02', 'Asia/Seoul', '[{"name":"부산","country_code":"KR"}]');
  insert into public.journal_entries (trip_id, kind, day_index, title, body, photos) values (tid, 'day', 0, '바다', '좋았다', array[tid || '/j/11111111-1111-1111-1111-111111111111.jpg']) returning id into eid;
  select share_token into tok from public.journal_entries where id = eid; r := r || '1 members token=' || coalesce(tok, 'null') || ' | ';
  update public.journal_entries set visibility = 'public' where id = eid;
  select share_token into tok from public.journal_entries where id = eid; r := r || '2 public token len=' || length(tok) || ' | ';
  update public.journal_entries set body = '고침' where id = eid;
  select share_token into tok2 from public.journal_entries where id = eid; r := r || '3 edit keeps token=' || (tok = tok2) || ' | ';
  begin update public.journal_entries set share_token = repeat('a', 32) where id = eid; select share_token into tok2 from public.journal_entries where id = eid; r := r || '4 token spoof kept=' || (tok = tok2) || ' | ';
  exception when others then r := r || '4 token spoof blocked ok | '; end;

  reset role;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  select p.title || '/' || p.author || '/' || p.trip_title into s from public.public_entry(tok) p; r := r || '5 anon reads=' || coalesce(s, 'none') || ' | ';
  select count(*) into n from public.public_entry('0000'); r := r || '6 bad token rows=' || n || ' | ';
  r := r || '7 anon photo ok=' || public.is_public_photo(tid || '/j/11111111-1111-1111-1111-111111111111.jpg') || ' | ';
  r := r || '8 other photo=' || public.is_public_photo(tid || '/other.jpg') || ' | ';
  begin select count(*) into n from public.journal_entries; r := r || '9 FAIL anon table read ' || n || ' | ';
  exception when others then r := r || '9 anon table blocked ok | '; end;

  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update public.journal_entries set visibility = 'private' where id = eid;
  select count(*) into n from public.public_entry(tok); r := r || '10 after private rows=' || n || ' | ';
  update public.journal_entries set visibility = 'public' where id = eid;
  select share_token into tok2 from public.journal_entries where id = eid; r := r || '11 republish new token=' || (tok <> tok2) || ' | ';
  update public.trips set removed_at = now() where id = tid;
  select count(*) into n from public.public_entry(tok2); r := r || '12 removed trip rows=' || n;
  reset role;
  raise exception 'RESULTS(rolled back): %', r;
end $t$;
