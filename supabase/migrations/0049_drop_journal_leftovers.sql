-- 0049 일기 흔적 정리 (2026-11-18 마루님 "정리해")
-- 일기는 0039 에서 표를 지웠고, 남은 알림 종류(journal, comment, reply)와 휴대폰 알림 문구를 뺀다.
-- 해당 알림은 0건 (적용 전 확인). 휴대폰 알림 기본 제목도 브랜드 표기 KKuK 로.

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind = any (array['joined', 'items', 'stamp', 'quota']));

update public.push_prefs
  set off_kinds = array(select k from unnest(off_kinds) k where k not in ('journal', 'comment', 'reply'))
  where off_kinds && array['journal', 'comment', 'reply'];

create or replace function public.push_take_pending()
returns table(endpoint text, p256dh text, auth text, title text, body text, url text)
language sql security definer set search_path to ''
as $function$
  with taken as (
    update public.notifications n set pushed_at = now()
    where n.pushed_at is null and n.created_at > now() - interval '1 hour'
    returning n.*
  )
  select s.endpoint, s.p256dh, s.auth, coalesce(t.title, 'KKuK'),
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
