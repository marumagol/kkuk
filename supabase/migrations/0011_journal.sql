/*
  0011 여행일기 (2단계 8, 2026-11-14 마루님 결정)
  - 하루 한 편(kind day, day_index) + 여행 회고 한 편(kind recap). 사람마다 따로 쓴다 (같은 칸에 한 사람당 1편)
  - 공개 범위 : private(나만 보기) / members(함께하는 사람만, 기본값 확인 필요) / public(링크 공개, 3단계에서 화면을 연다)
  - 쓰기 : 그 여행을 함께하는 사람 누구나 자기 일기 (보기만 포함, 확인 필요). 고치기와 지우기는 쓴 사람만
  - 사진 : place-photos 저장소의 <여행 id>/ 아래 (최대 10장)
*/
create table public.journal_entries (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references public.trips(id) on delete cascade,
  author_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind        text not null check (kind in ('day', 'recap')),
  day_index   integer check (day_index >= 0),
  title       text check (title is null or (title = btrim(title) and char_length(title) between 1 and 60)),
  body        text not null default '' check (char_length(body) <= 5000),
  photos      text[] not null default '{}' check (cardinality(photos) <= 10),
  visibility  text not null default 'members' check (visibility in ('private', 'members', 'public')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  removed_at  timestamptz,
  constraint journal_kind_day check ((kind = 'day') = (day_index is not null))
);
create unique index journal_one_per_slot on public.journal_entries (trip_id, author_id, kind, coalesce(day_index, -1)) where removed_at is null;
create index journal_trip on public.journal_entries (trip_id, day_index) where removed_at is null;
create index journal_author on public.journal_entries (author_id, updated_at desc) where removed_at is null;

create function private.journal_before_update() returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.id := old.id; new.trip_id := old.trip_id; new.author_id := old.author_id; new.kind := old.kind;
  new.day_index := old.day_index; new.created_at := old.created_at; new.updated_at := now();
  return new;
end $$;
create trigger journal_before_update before update on public.journal_entries
  for each row execute function private.journal_before_update();

alter table public.journal_entries enable row level security;
revoke all on public.journal_entries from anon, authenticated;
grant select, insert, update on public.journal_entries to authenticated;

create policy journal_select on public.journal_entries for select to authenticated using (
  author_id = (select auth.uid()) or (visibility in ('members', 'public') and private.can_view_trip(trip_id)));
create policy journal_insert on public.journal_entries for insert to authenticated with check (
  author_id = (select auth.uid()) and private.can_view_trip(trip_id)
  and exists (select 1 from public.trips t where t.id = trip_id and t.removed_at is null));
create policy journal_update on public.journal_entries for update to authenticated
  using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()) and private.can_view_trip(trip_id));

-- 일기 사진은 <여행 id>/j/ 아래. 보기만인 사람도 자기 일기 사진은 올릴 수 있게
create policy place_photos_insert_journal on storage.objects for insert to authenticated
  with check (bucket_id = 'place-photos' and (storage.foldername(name))[2] = 'j' and case when (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    then private.can_view_trip(((storage.foldername(name))[1])::uuid) else false end);
