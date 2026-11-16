/*
  0034 예약 지갑 (2026-11-16 마루님 "③-4 예약 지갑, DB/저장공간/권한 포함")
  - 준비 탭 예약(checklist_items kind 'reservation') 에 예약번호, 메모, 첨부 파일을 더한다. 따로 표를 만들지 않아 권한(RLS)은 예약과 같다
    보기 : 함께하는 사람 모두 / 쓰기 : 여행 주인, 편집 가능
  - 저장소 trip-files : 비공개. 그림(jpg, png, webp)과 PDF, 한 파일 10MB, 예약 하나에 5개. 위치는 <여행 id>/<파일 id>.<확장자>
    보기 : 그 여행을 볼 수 있는 사람 / 올리기, 지우기 : 그 여행을 고칠 수 있는 사람
*/
alter table public.checklist_items
  add column booking_code text check (booking_code is null or (booking_code = btrim(booking_code) and char_length(booking_code) between 1 and 60)),
  add column note text check (note is null or char_length(note) <= 500),
  add column files text[] not null default '{}' check (cardinality(files) <= 5);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('trip-files', 'trip-files', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

create policy trip_files_select on storage.objects for select to authenticated
  using (bucket_id = 'trip-files' and case when (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    then private.can_view_trip(((storage.foldername(name))[1])::uuid) else false end);
create policy trip_files_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'trip-files' and case when (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    then private.can_edit_trip(((storage.foldername(name))[1])::uuid) else false end);
create policy trip_files_delete on storage.objects for delete to authenticated
  using (bucket_id = 'trip-files' and case when (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    then private.can_edit_trip(((storage.foldername(name))[1])::uuid) else false end);
