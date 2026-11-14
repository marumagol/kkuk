/*
  장소 순서 바꾸기 (S07 끌어서 놓기). 한 날의 장소 id 를 새 순서대로 받아 sort_order 를 0 부터 다시 매긴다
  여러 줄을 한 번에 바꾸므로 함수 하나로 (중간에 실패하면 모두 되돌림)
*/
create function public.reorder_items(p_trip uuid, p_ids uuid[])
returns integer
language plpgsql security definer set search_path = ''
as $$
declare v_count integer;
begin
  if (select auth.uid()) is null then raise exception 'not_signed_in' using errcode = '28000'; end if;
  if not private.can_edit_trip(p_trip) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_ids is null or array_length(p_ids, 1) is null or array_length(p_ids, 1) > 500 then
    raise exception 'ids_invalid' using errcode = '22023';
  end if;

  update public.itinerary_items i
     set sort_order = (t.ord - 1)::int
    from unnest(p_ids) with ordinality as t(id, ord)
   where i.id = t.id and i.trip_id = p_trip and i.removed_at is null;
  get diagnostics v_count = row_count;
  return v_count;
end $$;
revoke all on function public.reorder_items(uuid, uuid[]) from public, anon;
grant execute on function public.reorder_items(uuid, uuid[]) to authenticated;
