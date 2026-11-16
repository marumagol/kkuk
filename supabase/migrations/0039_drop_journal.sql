/*
  0039 일기 기능 삭제 (2026-11-17 마루님 "일기는 매력도가 없어서 삭제", "응 지워 필요없어")
  - 앱 화면과 코드는 0.64.0 에서 이미 뺐다. 여기서는 DB 표, 함수, 정책, 알림을 지운다. 되돌릴 수 없다
  - 지우는 것 : journal_entries, journal_likes, journal_comments (표에 걸린 트리거와 정책은 같이 사라짐)
               일기 전용 함수, 일기 사진 올리기/공개 보기 정책, 일기 알림(journal, comment, reply)
  - 남기는 것 : notifications.kind 와 push_prefs.off_kinds 의 check 목록(예전 값이 있어도 안 깨지게), private.photos_within_limit(장소 사진도 씀),
               plan_limits 의 entry_photos 줄(쓰는 곳 없음), 저장소 place-photos/<여행>/j/ 아래 사진 파일(SQL 로는 못 지움, Storage API 로 따로)
*/

-- 저장소 정책 (일기 사진 올리기, 링크 공개 일기 사진 보기)
drop policy if exists place_photos_insert_journal on storage.objects;
drop policy if exists place_photos_select_public on storage.objects;
drop function if exists public.is_public_photo(text);

-- 표 (트리거, 정책, 외래 키는 같이)
drop table if exists public.journal_likes cascade;
drop table if exists public.journal_comments cascade;
drop table if exists public.journal_entries cascade;

-- 일기 전용 함수
drop function if exists public.public_entry(text);
drop function if exists public.journal_counts(uuid[]);
drop function if exists private.can_react_entry(uuid);
drop function if exists private.is_entry_author(uuid);
drop function if exists private.comment_before_insert();
drop function if exists private.notify_comment();
drop function if exists private.notify_reply();
drop function if exists private.notify_journal();
drop function if exists private.journal_before_update();
drop function if exists private.journal_before_insert();

-- 일기 알림
delete from public.notifications where kind in ('journal', 'comment', 'reply');
