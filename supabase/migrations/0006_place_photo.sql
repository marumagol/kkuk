/*
  0006 장소 사진 최대 5장 (2026-11-14, 마루님 선택)
  - itinerary_items.photos : 저장소 place-photos 안 위치 목록, 순서대로 (<여행 id>/<그림 id>.jpg|png|webp). 최대 5장
  - 저장소 place-photos : 비공개. 그 여행을 볼 수 있는 사람만 보고, 고칠 수 있는 사람만 올리고 지운다
  - 앱이 올리기 전에 긴 변 1600px JPEG 로 줄인다. 저장소 한도 5MB
*/
alter table public.itinerary_items
  add column photos text[] not null default '{}' check (cardinality(photos) <= 5);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('place-photos', 'place-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy place_photos_select on storage.objects for select to authenticated
  using (bucket_id = 'place-photos' and case when (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    then private.can_view_trip(((storage.foldername(name))[1])::uuid) else false end);
create policy place_photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'place-photos' and case when (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    then private.can_edit_trip(((storage.foldername(name))[1])::uuid) else false end);
create policy place_photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'place-photos' and case when (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    then private.can_edit_trip(((storage.foldername(name))[1])::uuid) else false end);
