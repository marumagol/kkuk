/*
  0017 장소 검색 하루 사용 상한 (4단계 마무리, 2026-11-15)
  - 구글 무료 체험판은 콘솔에서 할당량을 못 바꿔서 앱 안에서 막는다 (과지출 방지)
  - place_usage : 날짜(한국 시간) × 사람 × 종류(autocomplete, details) 별 횟수
  - take_place_quota(kind) : 허용되면 횟수를 1 올리고 true, 상한을 넘으면 false
    상한 : 전체 하루 자동완성 1000 / 상세 300, 사람마다 하루 자동완성 150 / 상세 40
  - 상한 숫자는 이 함수 안에서만 바꾼다. 화면에는 "오늘 검색 횟수를 다 썼어요"만 보인다 (직접 입력은 계속 가능)
*/
create table public.place_usage (
  day     date not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind    text not null check (kind in ('autocomplete', 'details')),
  n       integer not null default 0,
  primary key (day, user_id, kind)
);
alter table public.place_usage enable row level security;
revoke all on public.place_usage from anon, authenticated;

create function public.take_place_quota(p_kind text) returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
  v_day date := (now() at time zone 'Asia/Seoul')::date;
  v_all integer; v_mine integer; v_cap_all integer; v_cap_me integer;
begin
  if v_me is null then raise exception 'not_signed_in' using errcode = '28000'; end if;
  if p_kind not in ('autocomplete', 'details') then raise exception 'kind_invalid' using errcode = '22023'; end if;
  v_cap_all := case p_kind when 'autocomplete' then 1000 else 300 end;
  v_cap_me  := case p_kind when 'autocomplete' then 150 else 40 end;
  -- 같은 날 같은 종류 요청이 동시에 와도 숫자가 틀어지지 않게 잠근다
  perform pg_advisory_xact_lock(hashtext('place_quota:' || v_day || p_kind));
  select coalesce(sum(u.n), 0) into v_all from public.place_usage u where u.day = v_day and u.kind = p_kind;
  select coalesce(max(u.n), 0) into v_mine from public.place_usage u where u.day = v_day and u.kind = p_kind and u.user_id = v_me;
  if v_all >= v_cap_all or v_mine >= v_cap_me then return false; end if;
  insert into public.place_usage (day, user_id, kind, n) values (v_day, v_me, p_kind, 1)
  on conflict (day, user_id, kind) do update set n = public.place_usage.n + 1;
  return true;
end $$;
revoke all on function public.take_place_quota(text) from public, anon;
grant execute on function public.take_place_quota(text) to authenticated;
