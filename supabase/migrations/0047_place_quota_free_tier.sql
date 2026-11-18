/*
  구글 지도 무료 사용량 안으로 하루 상한 낮추기 (2026-11-18 마루님 "과도한 api 호출을 지양")
  월 무료 (2026-11 가격표) : 자동완성 10,000 / 장소 상세 Essentials 10,000 (0.91.3 부터 이름 칸 빼서 Essentials)
                           / 영업시간 Enterprise 1,000 / 위치 찾기 Text Search Pro 5,000
  하루 전체 상한 x 30일 이 무료 안에 들어가게 : 자동완성 330, 상세 300, 영업시간 30, 위치 찾기 150
  사람당 하루 : 자동완성 100, 상세 60, 위치 찾기 40, 영업시간 15
*/
create or replace function public.take_place_quota(p_kind text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_me uuid := (select auth.uid()); v_day date := (now() at time zone 'Asia/Seoul')::date;
  v_all integer; v_mine integer; v_cap_all integer; v_cap_me integer;
begin
  if v_me is null then raise exception 'not_signed_in' using errcode = '28000'; end if;
  if p_kind not in ('autocomplete', 'details', 'hours', 'find') then raise exception 'kind_invalid' using errcode = '22023'; end if;
  v_cap_all := case p_kind when 'autocomplete' then 330 when 'details' then 300 when 'find' then 150 else 30 end;
  v_cap_me := case p_kind when 'autocomplete' then 100 when 'details' then 60 when 'find' then 40 else 15 end;
  perform pg_advisory_xact_lock(hashtext('place_quota:' || v_day || p_kind));
  select coalesce(sum(u.n), 0) into v_all from public.place_usage u where u.day = v_day and u.kind = p_kind;
  select coalesce(max(u.n), 0) into v_mine from public.place_usage u where u.day = v_day and u.kind = p_kind and u.user_id = v_me;
  if v_all >= v_cap_all or v_mine >= v_cap_me then return false; end if;
  insert into public.place_usage (day, user_id, kind, n) values (v_day, v_me, p_kind, 1)
    on conflict (day, user_id, kind) do update set n = public.place_usage.n + 1;
  return true;
end $$;
