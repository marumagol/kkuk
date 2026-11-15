/*
  0019 삭제한 여행 되살리기 (5단계 3번, 2026-11-15)
  - 여행 주인만, 지운 지 30일 안에만
  - 삭제된 여행은 RLS(can_edit_trip) 로 못 고치므로 security definer 함수로만 되살린다
  - 30일이 지난 여행은 목록에서만 빠진다 (완전 삭제는 아직 안 함)
*/
create function public.restore_trip(p_trip uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare v_removed timestamptz;
begin
  if (select auth.uid()) is null then raise exception 'not_signed_in' using errcode = '28000'; end if;
  if not private.is_trip_owner(p_trip) then raise exception 'owner_only' using errcode = '42501'; end if;
  select removed_at into v_removed from public.trips where id = p_trip;
  if v_removed is null then raise exception 'not_removed' using errcode = 'P0001'; end if;
  if v_removed < now() - interval '30 days' then raise exception 'too_old' using errcode = 'P0001'; end if;
  update public.trips set removed_at = null where id = p_trip;
end $$;
revoke all on function public.restore_trip(uuid) from public, anon;
grant execute on function public.restore_trip(uuid) to authenticated;
