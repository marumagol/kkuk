/*
  0009 주인 검사 고치기 (2026-11-14). 함께하지 않는 사람은 trip_role 이 null 이라
  "not is_trip_owner" 가 null 이 되어 막히지 않던 문제 (검사 18번에서 발견). 항상 true/false 를 돌려주게 한다
*/
create or replace function private.is_trip_owner(p_trip uuid) returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce(private.trip_role(p_trip) = 'owner', false) $$;

create or replace function private.can_edit_trip(p_trip uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(private.trip_role(p_trip) in ('owner', 'editor'), false)
     and exists (select 1 from public.trips t where t.id = p_trip and t.removed_at is null)
$$;

create or replace function private.require_owner(p_trip uuid) returns void
language plpgsql stable security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is null then raise exception 'not_signed_in' using errcode = '28000'; end if;
  if not coalesce(private.is_trip_owner(p_trip), false) then raise exception 'forbidden' using errcode = '42501'; end if;
  if exists (select 1 from public.trips t where t.id = p_trip and t.removed_at is not null) then raise exception 'trip_removed' using errcode = '22023'; end if;
end $$;
