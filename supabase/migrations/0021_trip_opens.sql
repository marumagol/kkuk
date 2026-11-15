/*
  0021 이용 지표 기록 (5단계 5번, 2026-11-15)
  - 여행을 연 기록 : 사람 × 여행 × 날짜(한국 시간) 한 줄. 하루에 몇 번 열어도 한 줄
  - 남기는 것은 여행 id, 사람 id, 날짜뿐. 화면에서 읽을 수 없고 운영자만 SQL 로 본다
  - 쓰기는 log_trip_open() 으로만 (볼 수 있는 여행만)
*/
create table public.trip_opens (
  trip_id  uuid not null references public.trips(id) on delete cascade,
  user_id  uuid not null references auth.users(id) on delete cascade,
  day      date not null,
  primary key (trip_id, user_id, day)
);
alter table public.trip_opens enable row level security;
-- 정책 없음 : 앱에서 직접 읽기, 쓰기 불가
revoke all on public.trip_opens from anon, authenticated;

create function public.log_trip_open(p_trip uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := (select auth.uid());
begin
  if v_uid is null or not private.can_view_trip(p_trip) then return; end if;
  insert into public.trip_opens (trip_id, user_id, day)
  values (p_trip, v_uid, (now() at time zone 'Asia/Seoul')::date)
  on conflict do nothing;
end $$;
revoke all on function public.log_trip_open(uuid) from public, anon;
grant execute on function public.log_trip_open(uuid) to authenticated;
