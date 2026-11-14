/*
  0015 일부 일정만 공유 (4단계 7, 2026-11-15)
  - trip_shares : 고른 일차(day_index 배열)만 보이는 링크. 편집 가능 이상이 만들고 끊는다. 여행당 살아 있는 링크 20개까지
  - public_trip_share(token) : 로그인 없이 읽기. 여행 이름, 날짜, 고른 날의 장소(이름, 분류, 시간, 주소, 좌표)만. 메모, 비용, 사진, 사람 이름은 주지 않는다
  - 삭제된 여행, 끊은 링크는 열리지 않는다
*/
create table public.trip_shares (
  id         uuid primary key default gen_random_uuid(),
  trip_id    uuid not null references public.trips(id) on delete cascade,
  token      text not null unique check (token ~ '^[0-9a-f]{32}$'),
  days       integer[] not null check (cardinality(days) between 1 and 60 and 0 <= all (days)),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
comment on table public.trip_shares is '일부 일정 공유 링크 (고른 일차만 보기)';
create index trip_shares_trip on public.trip_shares (trip_id) where revoked_at is null;
alter table public.trip_shares enable row level security;
revoke all on public.trip_shares from anon;
create policy trip_shares_select on public.trip_shares for select to authenticated using (private.can_view_trip(trip_id));

create function public.create_trip_share(p_trip uuid, p_days integer[]) returns text
language plpgsql security definer set search_path = ''
as $$
declare v_token text := replace(gen_random_uuid()::text, '-', ''); v_len integer; v_days integer[];
begin
  if (select auth.uid()) is null then raise exception 'not_signed_in' using errcode = '28000'; end if;
  if not private.can_edit_trip(p_trip) then raise exception 'forbidden' using errcode = '42501'; end if;
  select t.end_date - t.start_date + 1 into v_len from public.trips t where t.id = p_trip and t.removed_at is null;
  if v_len is null then raise exception 'trip_removed' using errcode = '22023'; end if;
  select array_agg(distinct d order by d) into v_days from unnest(p_days) d where d is not null;
  if v_days is null or exists (select 1 from unnest(v_days) d where d < 0 or d >= v_len) then
    raise exception 'days_invalid' using errcode = '22023'; end if;
  if (select count(*) from public.trip_shares s where s.trip_id = p_trip and s.revoked_at is null) >= 20 then
    raise exception 'too_many_shares' using errcode = '22023'; end if;
  insert into public.trip_shares (trip_id, token, days) values (p_trip, v_token, v_days);
  return v_token;
end $$;

create function public.revoke_trip_share(p_trip uuid, p_token text) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not private.can_edit_trip(p_trip) then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.trip_shares set revoked_at = now() where trip_id = p_trip and token = p_token and revoked_at is null;
end $$;

create function public.public_trip_share(p_token text) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'title', t.title, 'start_date', t.start_date, 'end_date', t.end_date, 'days', to_jsonb(s.days),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object('day_index', i.day_index, 'title', i.title, 'category', i.category,
               'start_time', to_char(i.start_time, 'HH24:MI'), 'address', i.address, 'lat', i.lat, 'lng', i.lng)
             order by i.day_index, i.sort_order, i.created_at)
      from public.itinerary_items i
      where i.trip_id = t.id and i.removed_at is null and i.day_index = any (s.days)), '[]'::jsonb))
  from public.trip_shares s join public.trips t on t.id = s.trip_id
  where p_token ~ '^[0-9a-f]{32}$' and s.token = p_token and s.revoked_at is null and t.removed_at is null
$$;

revoke all on function public.create_trip_share(uuid, integer[]) from public, anon;
revoke all on function public.revoke_trip_share(uuid, text) from public, anon;
revoke all on function public.public_trip_share(text) from public;
grant execute on function public.create_trip_share(uuid, integer[]) to authenticated;
grant execute on function public.revoke_trip_share(uuid, text) to authenticated;
grant execute on function public.public_trip_share(text) to anon, authenticated;
