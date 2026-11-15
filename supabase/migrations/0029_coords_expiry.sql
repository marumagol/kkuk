/*
  0029 장소 좌표 30일 (6단계 6번, 2026-11-15). 구글 약관상 좌표는 30일까지만 둔다 (장소 id 는 계속 둘 수 있음, 확인 필요)
  - 매일 03:10(한국 시간) 30일 지난 좌표를 비운다 (장소 id 는 남김)
  - 여행 화면을 열면 앱이 좌표가 빈 검색 장소를 장소 id 로 다시 받아 채운다 (한 번에 5곳, 하루 검색 상한 안에서)
  - 좌표만 바뀌는 수정은 "고친 장소" 알림과 "누가 고쳤는지" 표시를 만들지 않는다
*/
create function private.only_coords(o jsonb, n jsonb) returns boolean
language sql immutable set search_path = ''
as $$ select (o - 'lat' - 'lng' - 'coords_at' - 'updated_at' - 'updated_by') = (n - 'lat' - 'lng' - 'coords_at' - 'updated_at' - 'updated_by') $$;

create or replace function private.items_before_update() returns trigger
language plpgsql set search_path = ''
as $$
declare v_uid uuid := (select auth.uid());
begin
  new.id := old.id;
  new.trip_id := old.trip_id;
  new.created_at := old.created_at;
  if private.only_coords(to_jsonb(old), to_jsonb(new)) then
    new.updated_at := old.updated_at; new.updated_by := old.updated_by; new.created_by := old.created_by;
    return new;
  end if;
  new.updated_at := now();
  if v_uid is not null then
    new.created_by := old.created_by;
    new.updated_by := v_uid;
  end if;
  return new;
end $$;

create or replace function private.notify_items() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare v_actor uuid := (select auth.uid()); v_trip uuid := coalesce(new.trip_id, old.trip_id); v_name text;
begin
  if v_actor is null then return null; end if;
  if tg_op = 'UPDATE' and private.only_coords(to_jsonb(old), to_jsonb(new)) then return null; end if;
  update public.notifications n set count = n.count + 1, created_at = now(), detail = left(coalesce(new.title, old.title), 80)
   where n.trip_id = v_trip and n.kind = 'items' and n.actor_id = v_actor and n.read_at is null and n.created_at > now() - interval '3 hours';
  v_name := private.member_name(v_trip, v_actor);
  insert into public.notifications (user_id, trip_id, kind, actor_id, actor_name, detail)
  select m.user_id, v_trip, 'items', v_actor, v_name, left(coalesce(new.title, old.title), 80)
  from public.trip_members m
  where m.trip_id = v_trip and m.removed_at is null and m.user_id is not null and m.user_id <> v_actor
    and not exists (select 1 from public.notifications n where n.user_id = m.user_id and n.trip_id = v_trip and n.kind = 'items'
                    and n.actor_id = v_actor and n.read_at is null and n.created_at > now() - interval '3 hours');
  return null;
end $$;

-- 좌표 다시 채우기 : 볼 수 있는 여행의, 장소 id 가 같고 좌표가 빈 칸만
create function public.refill_coords(p_kind text, p_id uuid, p_place text, p_lat double precision, p_lng double precision) returns boolean
language plpgsql security definer set search_path = ''
as $$
declare v_trip uuid;
begin
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then return false; end if;
  if p_kind = 'item' then
    select trip_id into v_trip from public.itinerary_items where id = p_id and google_place_id = p_place and lat is null;
    if v_trip is null or not private.can_view_trip(v_trip) then return false; end if;
    update public.itinerary_items set lat = p_lat, lng = p_lng, coords_at = now() where id = p_id;
  elsif p_kind = 'city' then
    select trip_id into v_trip from public.trip_cities where id = p_id and google_place_id = p_place and lat is null;
    if v_trip is null or not private.can_view_trip(v_trip) then return false; end if;
    update public.trip_cities set lat = p_lat, lng = p_lng, coords_at = now() where id = p_id;
  else
    return false;
  end if;
  return true;
end $$;
revoke all on function public.refill_coords(text, uuid, text, double precision, double precision) from public, anon;
grant execute on function public.refill_coords(text, uuid, text, double precision, double precision) to authenticated;

create function private.expire_coords() returns void
language sql security definer set search_path = ''
as $$
  update public.itinerary_items set lat = null, lng = null where google_place_id is not null and lat is not null and coords_at < now() - interval '30 days';
  update public.trip_cities set lat = null, lng = null where google_place_id is not null and lat is not null and coords_at < now() - interval '30 days';
$$;

select cron.schedule('kkuk-expire-coords', '10 18 * * *', $c$ select private.expire_coords() $c$);
