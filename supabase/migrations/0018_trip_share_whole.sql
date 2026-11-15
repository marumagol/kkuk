/*
  0018 여행 단위 공유 (2026-11-15, 마루님 결정)
  - trip_shares.days 가 null 이면 "여행 전체" 링크. 여행 기간이 바뀌어도 모든 날과 날짜 미정 장소가 보인다
  - 일부 날짜 링크(days 배열)는 그대로 둔다
*/
alter table public.trip_shares alter column days drop not null;
comment on table public.trip_shares is '일정 공유 링크 (days null = 여행 전체, 배열 = 고른 일차만)';

create or replace function public.create_trip_share(p_trip uuid, p_days integer[]) returns text
language plpgsql security definer set search_path = ''
as $$
declare v_token text := replace(gen_random_uuid()::text, '-', ''); v_len integer; v_days integer[];
begin
  if (select auth.uid()) is null then raise exception 'not_signed_in' using errcode = '28000'; end if;
  if not private.can_edit_trip(p_trip) then raise exception 'forbidden' using errcode = '42501'; end if;
  select t.end_date - t.start_date + 1 into v_len from public.trips t where t.id = p_trip and t.removed_at is null;
  if v_len is null then raise exception 'trip_removed' using errcode = '22023'; end if;
  if p_days is not null then
    select array_agg(distinct d order by d) into v_days from unnest(p_days) d where d is not null;
    if v_days is null or exists (select 1 from unnest(v_days) d where d < 0 or d >= v_len) then
      raise exception 'days_invalid' using errcode = '22023'; end if;
  end if;
  if (select count(*) from public.trip_shares s where s.trip_id = p_trip and s.revoked_at is null) >= 20 then
    raise exception 'too_many_shares' using errcode = '22023'; end if;
  insert into public.trip_shares (trip_id, token, days) values (p_trip, v_token, v_days);
  return v_token;
end $$;

create or replace function public.public_trip_share(p_token text) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'title', t.title, 'start_date', t.start_date, 'end_date', t.end_date, 'whole', s.days is null,
    'days', coalesce(to_jsonb(s.days), (select jsonb_agg(g) from generate_series(0, t.end_date - t.start_date) g)),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object('day_index', i.day_index, 'title', i.title, 'category', i.category,
               'start_time', to_char(i.start_time, 'HH24:MI'), 'address', i.address, 'lat', i.lat, 'lng', i.lng)
             order by i.day_index nulls last, i.sort_order, i.created_at)
      from public.itinerary_items i
      where i.trip_id = t.id and i.removed_at is null
        and (s.days is null or i.day_index = any (s.days))), '[]'::jsonb))
  from public.trip_shares s join public.trips t on t.id = s.trip_id
  where p_token ~ '^[0-9a-f]{32}$' and s.token = p_token and s.revoked_at is null and t.removed_at is null
$$;
