/*
  여행 정보 수정 (S09). 이름, 기간, 시간대, 도시를 한 번에 바꾼다
  - 주인과 편집 가능만 (security definer 라 RLS 대신 can_edit_trip 으로 직접 검사)
  - 기간이 줄어 사라지는 날의 장소는 날짜 미정(day_index 비움)으로 옮기고, 옮긴 개수를 돌려준다
  - 시작 날짜를 옮겨도 day_index 는 "몇 일차"라 그대로 따라간다
*/
create function public.update_trip(p_trip uuid, p_title text, p_start_date date, p_end_date date, p_time_zone text, p_cities jsonb)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare v_moved integer;
begin
  if (select auth.uid()) is null then raise exception 'not_signed_in' using errcode = '28000'; end if;
  if not private.can_edit_trip(p_trip) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_cities is null or jsonb_typeof(p_cities) <> 'array' or jsonb_array_length(p_cities) not between 1 and 20 then
    raise exception 'cities_invalid' using errcode = '22023';
  end if;

  update public.trips
     set title = btrim(p_title), start_date = p_start_date, end_date = p_end_date, time_zone = coalesce(p_time_zone, time_zone)
   where id = p_trip;

  update public.itinerary_items
     set day_index = null
   where trip_id = p_trip and removed_at is null and day_index >= (p_end_date - p_start_date + 1);
  get diagnostics v_moved = row_count;

  delete from public.trip_cities where trip_id = p_trip;
  insert into public.trip_cities (trip_id, sort_order, name, country_code)
  select p_trip, (t.ord - 1)::int, btrim(t.c ->> 'name'), nullif(upper(btrim(t.c ->> 'country_code')), '')
  from jsonb_array_elements(p_cities) with ordinality as t(c, ord);

  return v_moved;
end $$;
revoke all on function public.update_trip(uuid, text, date, date, text, jsonb) from public, anon;
grant execute on function public.update_trip(uuid, text, date, date, text, jsonb) to authenticated;
