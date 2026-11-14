/*
  탈퇴 (S13). 로그인한 본인만, 본인 계정만
  - 다른 사람이 함께하는 여행의 주인이면 먼저 주인을 넘겨야 함 (transfer_required)
  - 내가 주인인 여행은 일정, 장소, 도시와 함께 지운다 (1단계는 혼자 쓰기라 대부분 이 경우)
  - 남의 여행에서는 빠진다 (내가 쓴 장소는 여행에 남고 만든 사람만 비워짐)
  - 마지막에 로그인 정보(auth.users)를 지운다. 이름(profiles)은 함께 지워짐
  돌려주는 값 : 함께 지운 여행 수
*/
create function public.delete_my_account()
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_trips integer;
begin
  if v_uid is null then raise exception 'not_signed_in' using errcode = '28000'; end if;
  if exists (
    select 1 from public.trip_members m
     where m.user_id = v_uid and m.role = 'owner' and m.removed_at is null
       and exists (select 1 from public.trip_members o
                    where o.trip_id = m.trip_id and o.removed_at is null and o.user_id is distinct from v_uid)
  ) then
    raise exception 'transfer_required' using errcode = 'P0001';
  end if;

  delete from public.trips t
   using public.trip_members m
   where m.trip_id = t.id and m.user_id = v_uid and m.role = 'owner';
  get diagnostics v_trips = row_count;

  update public.trip_members set removed_at = now() where user_id = v_uid and removed_at is null;
  delete from auth.users where id = v_uid;
  return v_trips;
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
