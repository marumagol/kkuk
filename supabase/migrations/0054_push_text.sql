-- 0054 휴대폰 알림 문구를 앱 알림 화면과 맞춘다 (2026-11-25 전수 점검)
-- 장소를 고쳤어요 → 수정했어요, OO 도장을 받았어요 → OO 카드를 받았어요. 나머지는 0053 그대로

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
      when 'items' then n.actor_name || '님이 장소를 수정했어요' || coalesce(' (' || n.detail || ')', '')
      when 'quota' then coalesce(n.detail, '구글 지도 하루 상한 알림')
      else n.actor_name || '님 덕분에 ' || coalesce(n.detail, '도시') || ' 카드를 받았어요'
    end,
    '/notifications'
  from taken n
  join public.push_subscriptions s on s.user_id = n.user_id
  left join public.trips t on t.id = n.trip_id
  where not exists (select 1 from public.push_prefs p where p.user_id = n.user_id and n.kind = any (p.off_kinds))
$function$;
