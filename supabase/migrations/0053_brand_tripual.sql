-- 0053 서비스 이름 KKuK → 트립추얼 (2026-11-25 마루님)
-- 휴대폰 알림 기본 제목(여행 제목이 없을 때)과 구글 지도 상한 알림의 보낸 이름만 바꾼다. 나머지 내용은 0049, 0048 그대로.

create or replace function public.push_take_pending()
returns table(endpoint text, p256dh text, auth text, title text, body text, url text)
language sql security definer set search_path to ''
as $function$
  with taken as (
    update public.notifications n set pushed_at = now()
    where n.pushed_at is null and n.created_at > now() - interval '1 hour'
    returning n.*
  )
  select s.endpoint, s.p256dh, s.auth, coalesce(t.title, '트립추얼'),
    case n.kind
      when 'joined' then n.actor_name || '님이 여행에 함께하기 시작했어요'
      when 'items' then n.actor_name || '님이 장소를 고쳤어요' || coalesce(' (' || n.detail || ')', '')
      when 'quota' then coalesce(n.detail, '구글 지도 하루 상한 알림')
      else n.actor_name || '님 덕분에 ' || coalesce(n.detail, '도시') || ' 도장을 받았어요'
    end,
    '/notifications'
  from taken n
  join public.push_subscriptions s on s.user_id = n.user_id
  left join public.trips t on t.id = n.trip_id
  where not exists (select 1 from public.push_prefs p where p.user_id = n.user_id and n.kind = any (p.off_kinds))
$function$;

create or replace function private.quota_alert(p_kind text, p_day date, p_level text, p_used integer, p_cap integer)
returns void language plpgsql security definer set search_path = '' as $$
declare v_ref text := 'quota:' || p_day || ':' || p_kind || ':' || p_level;
  v_name text := case p_kind when 'autocomplete' then '장소 검색' when 'details' then '장소 상세' when 'find' then '위치 찾기' else '영업시간' end;
begin
  if exists (select 1 from public.notifications n where n.kind = 'quota' and n.ref_id = v_ref) then return; end if;
  insert into public.notifications (user_id, trip_id, kind, actor_id, actor_name, ref_id, detail, count)
  select a.user_id, null, 'quota', null, '트립추얼', v_ref,
    left(case p_level when 'full' then '오늘 ' || v_name || ' 하루 상한(' || p_cap || '회)이 다 찼어요. 지금부터 막혀요'
      else '오늘 ' || v_name || ' 하루 상한의 80%를 썼어요 (' || p_used || '/' || p_cap || '회)' end, 80), 1
  from private.quota_admins a;
end $$;
revoke all on function private.quota_alert(text, date, text, integer, integer) from public, anon, authenticated;
