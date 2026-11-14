/*
  0007 프로필 사진 (2026-11-14)
  - profiles.avatar_url 에 저장소 위치 (<내 id>/<그림 id>.jpg). 칸은 0001 에 이미 있음
  - 저장소 avatars : 공개 읽기 (함께하는 사람에게 보이게), 1MB, jpg/png/webp. 올리기와 지우기는 내 폴더만
*/
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 1048576, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy avatars_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy avatars_delete on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
