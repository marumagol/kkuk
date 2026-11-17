/*
  0042 프로필 사진 지우기가 안 되던 문제 (2026-11-17 QA)
  저장소 remove 는 지울 파일을 먼저 select 로 찾는다. avatars 에는 select 규칙이 없어 예전 사진이 하나도 안 지워지고 쌓였다
  (avatars 는 공개 저장소라 보기는 공개 주소로 되므로 select 규칙이 없어도 화면엔 문제가 없었다)
  내 폴더(avatars/<내 id>/)만 찾을 수 있게 한다
*/
drop policy if exists avatars_select on storage.objects;
create policy avatars_select on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
