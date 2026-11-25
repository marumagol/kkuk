-- 0055 로그인 안 한 사람(anon)은 함께하는 사람·초대 함수를 부를 수 없게 (2026-11-25 전수 점검)
-- 함수 안에서도 로그인을 확인하지만, 실행 권한부터 막아 이중으로 지킨다.
-- 초대 미리보기(invite_preview)와 공개 일정(public_trip_share)은 로그인 없이 보는 화면이라 그대로 둔다.
revoke execute on function public.accept_invite(text) from anon;
revoke execute on function public.create_invite(uuid, text) from anon;
revoke execute on function public.leave_trip(uuid) from anon;
revoke execute on function public.remove_member(uuid) from anon;
revoke execute on function public.revoke_invite(uuid) from anon;
revoke execute on function public.set_member_role(uuid, text) from anon;
revoke execute on function public.transfer_owner(uuid) from anon;
