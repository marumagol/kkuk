/*
  0013 일기 링크 공개 (3단계 6, 2026-11-15)
  - journal_entries.share_token : 공개(public)로 바꾸면 추측할 수 없는 32자 주소가 생기고, 공개를 끄면 지워진다 (다시 공개하면 새 주소)
  - public_entry(token) : 로그인 없이 그 글 하나만 읽는다. 돌려주는 것은 제목, 본문, 사진 위치, 쓴 사람 이름, 여행 이름과 날짜뿐
  - 사진 : 공개 중인 일기에 들어 있는 사진만 로그인 없이 볼 수 있게 (화면은 1시간 주소)
  - 삭제된 여행, 지운 일기는 링크가 열리지 않는다
*/
alter table public.journal_entries add column share_token text unique check (share_token ~ '^[0-9a-f]{32}$');

create or replace function private.journal_before_update() returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.id := old.id; new.trip_id := old.trip_id; new.author_id := old.author_id; new.kind := old.kind;
  new.day_index := old.day_index; new.created_at := old.created_at; new.updated_at := now();
  if new.visibility = 'public' and new.removed_at is null then
    new.share_token := coalesce(old.share_token, replace(gen_random_uuid()::text, '-', ''));
  else
    new.share_token := null;
  end if;
  return new;
end $$;

create function private.journal_before_insert() returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.share_token := case when new.visibility = 'public' then replace(gen_random_uuid()::text, '-', '') end;
  return new;
end $$;
create trigger journal_before_insert before insert on public.journal_entries
  for each row execute function private.journal_before_insert();

create function public.public_entry(p_token text)
returns table (kind text, day_index integer, title text, body text, photos text[], updated_at timestamptz,
               author text, trip_title text, start_date date, end_date date)
language sql stable security definer set search_path = ''
as $$
  select e.kind, e.day_index, e.title, e.body, e.photos, e.updated_at,
         coalesce((select m.display_name from public.trip_members m where m.trip_id = e.trip_id and m.user_id = e.author_id order by m.removed_at nulls first limit 1), '여행자'),
         t.title, t.start_date, t.end_date
  from public.journal_entries e join public.trips t on t.id = e.trip_id
  where p_token ~ '^[0-9a-f]{32}$' and e.share_token = p_token
    and e.visibility = 'public' and e.removed_at is null and t.removed_at is null
$$;
revoke all on function public.public_entry(text) from public;
grant execute on function public.public_entry(text) to anon, authenticated;

-- 정책 안에서 일기 표를 읽어야 해서 security definer 함수로 (로그인 전 사람은 일기 표 권한이 없다)
create function public.is_public_photo(p_name text) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.journal_entries e join public.trips t on t.id = e.trip_id
    where e.visibility = 'public' and e.removed_at is null and t.removed_at is null and p_name = any (e.photos))
$$;
revoke all on function public.is_public_photo(text) from public;
grant execute on function public.is_public_photo(text) to anon, authenticated;

create policy place_photos_select_public on storage.objects for select to anon, authenticated
  using (bucket_id = 'place-photos' and public.is_public_photo(name));
