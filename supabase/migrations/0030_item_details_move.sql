/*
  여행 메뉴 개편 (2026-11-15)
  1. 분류별 맞춤 칸 : itinerary_items.details (이동 = 수단, 편명, 출발/도착, 좌석, 예약번호 / 숙소 = 예약번호, 체크인 등)
     어떤 칸을 받을지는 앱(lib/place-fields.ts)이 정한다. DB 는 모양(객체)과 크기만 막는다
     공개 공유(public_trip_share)는 고른 칸만 내보내므로 details 는 밖으로 나가지 않는다
  2. 날짜를 넘어 끌어서 옮기기 : move_item(여행, 장소, 옮길 날, 그 날의 새 순서)
     장소의 날짜를 바꾸고 그 날 순서를 한 번에 다시 매긴다 (중간에 실패하면 모두 되돌림)
*/
alter table public.itinerary_items
  add column details jsonb not null default '{}'::jsonb,
  add constraint itinerary_items_details_shape check (jsonb_typeof(details) = 'object' and pg_column_size(details) <= 4000);
comment on column public.itinerary_items.details is '분류별 맞춤 칸 (편명, 예약번호 등). 키는 앱이 정함';

create function public.move_item(p_trip uuid, p_item uuid, p_day integer, p_ids uuid[])
returns integer
language plpgsql security definer set search_path = ''
as $$
declare v_len integer; v_count integer;
begin
  if (select auth.uid()) is null then raise exception 'not_signed_in' using errcode = '28000'; end if;
  if not private.can_edit_trip(p_trip) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_ids is null or array_length(p_ids, 1) is null or array_length(p_ids, 1) > 500 or not (p_item = any(p_ids)) then
    raise exception 'ids_invalid' using errcode = '22023';
  end if;
  select (t.end_date - t.start_date) + 1 into v_len from public.trips t where t.id = p_trip and t.removed_at is null;
  if v_len is null then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_day is not null and (p_day < 0 or p_day >= v_len) then raise exception 'day_invalid' using errcode = '22023'; end if;

  update public.itinerary_items set day_index = p_day
   where id = p_item and trip_id = p_trip and removed_at is null;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;

  update public.itinerary_items i
     set sort_order = (t.ord - 1)::int
    from unnest(p_ids) with ordinality as t(id, ord)
   where i.id = t.id and i.trip_id = p_trip and i.removed_at is null
     and i.day_index is not distinct from p_day;
  get diagnostics v_count = row_count;
  return v_count;
end $$;
revoke all on function public.move_item(uuid, uuid, integer, uuid[]) from public, anon;
grant execute on function public.move_item(uuid, uuid, integer, uuid[]) to authenticated;
