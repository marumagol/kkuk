/*
  0005 직접 입력한 나라 (2026-11-14)
  - trip_cities.country_name : 목록에 없는 나라를 직접 적은 이름 (1~20자). 이때 country_code 는 비어 있음
  - trip_cities.country_icon : 그 나라에 올린 아이콘 그림의 저장 위치 (country-icons/<내 id>/<그림 id>.png|jpg|webp)
  - 저장소 country-icons : 공개 읽기 (주소를 알아야 볼 수 있음), 1MB, png/jpg/webp. 올리기와 지우기는 내 폴더에만
*/
alter table public.trip_cities
  add column country_name text check (country_name is null or (country_name = btrim(country_name) and char_length(country_name) between 1 and 20)),
  add column country_icon text check (country_icon is null or country_icon ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(png|jpg|webp)$');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('country-icons', 'country-icons', true, 1048576, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy country_icons_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'country-icons' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy country_icons_delete on storage.objects for delete to authenticated
  using (bucket_id = 'country-icons' and (storage.foldername(name))[1] = (select auth.uid())::text);
