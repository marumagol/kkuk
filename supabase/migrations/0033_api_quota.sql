/*
  0033 영업시간 받기 하루 상한 (2026-11-16 마루님, 영업시간 경고 안전장치)
  - 0017 장소 검색 상한(take_place_quota)에 종류 'hours' 를 더한다. 전체 하루 300, 사람마다 하루 40
  - 처음 만든 api_daily_usage / take_api_quota 는 같은 일을 하는 0017 을 쓰기로 해서 지운다
*/
drop function if exists public.take_api_quota(text, integer, integer);
drop table if exists public.api_daily_usage;

alter table public.place_usage drop constraint place_usage_kind_check;
alter table public.place_usage add constraint place_usage_kind_check check (kind in ('autocomplete', 'details', 'hours'));

create or replace function public.take_place_quota(p_kind text) returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
  v_day date := (now() at time zone 'Asia/Seoul')::date;
  v_all integer; v_mine integer; v_cap_all integer; v_cap_me integer;
begin
  if v_me is null then raise exception 'not_signed_in' using errcode = '28000'; end if;
  if p_kind not in ('autocomplete', 'details', 'hours') then raise exception 'kind_invalid' using errcode = '22023'; end if;
  v_cap_all := case p_kind when 'autocomplete' then 1000 else 300 end;
  v_cap_me  := case p_kind when 'autocomplete' then 150 else 40 end;
  perform pg_advisory_xact_lock(hashtext('place_quota:' || v_day || p_kind));
  select coalesce(sum(u.n), 0) into v_all from public.place_usage u where u.day = v_day and u.kind = p_kind;
  select coalesce(max(u.n), 0) into v_mine from public.place_usage u where u.day = v_day and u.kind = p_kind and u.user_id = v_me;
  if v_all >= v_cap_all or v_mine >= v_cap_me then return false; end if;
  insert into public.place_usage (day, user_id, kind, n) values (v_day, v_me, p_kind, 1)
  on conflict (day, user_id, kind) do update set n = public.place_usage.n + 1;
  return true;
end $$;
