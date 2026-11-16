/*
  0037 장소 연결 상한 나누기 (2026-11-16 마루님 "장소 연결이 아무 반응이 없어")
  - 원인 : 동선 정리의 [위치 찾기](이름으로 한 번에 찾기)가 사람당 하루 상세 40회를 같이 써서, 다 쓰면 장소 검색 후보를 눌러도 연결이 안 됐다
  - 고침 : 위치 찾기는 새 종류 'find' (전체 300, 사람 60) 로 따로 센다. 장소 검색 연결 'details' 는 사람당 40 → 100 (전체 300 은 그대로)
*/
alter table public.place_usage drop constraint place_usage_kind_check;
alter table public.place_usage add constraint place_usage_kind_check check (kind in ('autocomplete', 'details', 'hours', 'find'));

create or replace function public.take_place_quota(p_kind text) returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
  v_day date := (now() at time zone 'Asia/Seoul')::date;
  v_all integer; v_mine integer; v_cap_all integer; v_cap_me integer;
begin
  if v_me is null then raise exception 'not_signed_in' using errcode = '28000'; end if;
  if p_kind not in ('autocomplete', 'details', 'hours', 'find') then raise exception 'kind_invalid' using errcode = '22023'; end if;
  v_cap_all := case p_kind when 'autocomplete' then 1000 else 300 end;
  v_cap_me  := case p_kind when 'autocomplete' then 150 when 'details' then 100 when 'find' then 60 else 40 end;
  perform pg_advisory_xact_lock(hashtext('place_quota:' || v_day || p_kind));
  select coalesce(sum(u.n), 0) into v_all from public.place_usage u where u.day = v_day and u.kind = p_kind;
  select coalesce(max(u.n), 0) into v_mine from public.place_usage u where u.day = v_day and u.kind = p_kind and u.user_id = v_me;
  if v_all >= v_cap_all or v_mine >= v_cap_me then return false; end if;
  insert into public.place_usage (day, user_id, kind, n) values (v_day, v_me, p_kind, 1)
  on conflict (day, user_id, kind) do update set n = public.place_usage.n + 1;
  return true;
end $$;
