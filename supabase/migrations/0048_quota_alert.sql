/*
  구글 지도 하루 상한 알림 (2026-11-18 마루님 "상한에 닿을 경우 나한테 알림이 오게")
  - 하루 전체 상한의 80% 에 닿을 때, 그리고 상한에 닿아 처음 막힐 때 운영자에게 앱 알림(+ 푸시를 켜 두었으면 휴대폰 알림)
  - 같은 날 같은 기능은 단계마다 한 번만. 사람당 상한에 막히는 건 알리지 않는다
  - 운영자 목록은 private.quota_admins (저장소에 적지 않고 DB 에서 넣는다)
  - 여행과 상관없는 알림이라 notifications.trip_id 를 비워 둘 수 있게 하고 kind 'quota' 를 더한다
*/
create table if not exists private.quota_admins (user_id uuid primary key references auth.users(id) on delete cascade, created_at timestamptz not null default now());
revoke all on private.quota_admins from public, anon, authenticated;

alter table public.notifications alter column trip_id drop not null;
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in ('joined', 'items', 'journal', 'stamp', 'comment', 'reply', 'quota'));

create or replace function private.quota_alert(p_kind text, p_day date, p_level text, p_used integer, p_cap integer)
returns void language plpgsql security definer set search_path = '' as $$
declare v_ref text := 'quota:' || p_day || ':' || p_kind || ':' || p_level;
  v_name text := case p_kind when 'autocomplete' then '장소 검색' when 'details' then '장소 상세' when 'find' then '위치 찾기' else '영업시간' end;
begin
  if exists (select 1 from public.notifications n where n.kind = 'quota' and n.ref_id = v_ref) then return; end if;
  insert into public.notifications (user_id, trip_id, kind, actor_id, actor_name, ref_id, detail, count)
  select a.user_id, null, 'quota', null, 'KKuK', v_ref,
    left(case p_level when 'full' then '오늘 ' || v_name || ' 하루 상한(' || p_cap || '회)이 다 찼어요. 지금부터 막혀요'
      else '오늘 ' || v_name || ' 하루 상한의 80%를 썼어요 (' || p_used || '/' || p_cap || '회)' end, 80), 1
  from private.quota_admins a;
end $$;
revoke all on function private.quota_alert(text, date, text, integer, integer) from public, anon, authenticated;

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
  if v_all >= v_cap_all then
    begin perform private.quota_alert(p_kind, v_day, 'full', v_all, v_cap_all); exception when others then null; end;
    return false;
  end if;
  if v_mine >= v_cap_me then return false; end if;
  insert into public.place_usage (day, user_id, kind, n) values (v_day, v_me, p_kind, 1)
    on conflict (day, user_id, kind) do update set n = public.place_usage.n + 1;
  if v_all + 1 >= ceil(v_cap_all * 0.8) then
    begin perform private.quota_alert(p_kind, v_day, 'warn', v_all + 1, v_cap_all); exception when others then null; end;
  end if;
  return true;
end $$;

create or replace function public.push_take_pending() returns table (endpoint text, p256dh text, auth text, title text, body text, url text)
language sql security definer set search_path = '' as $$
  with taken as (
    update public.notifications n set pushed_at = now()
    where n.pushed_at is null and n.created_at > now() - interval '1 hour'
    returning n.*
  )
  select s.endpoint, s.p256dh, s.auth, coalesce(t.title, '꾹'),
    case n.kind
      when 'joined' then n.actor_name || '님이 여행에 함께하기 시작했어요'
      when 'items' then n.actor_name || '님이 장소를 고쳤어요' || coalesce(' (' || n.detail || ')', '')
      when 'journal' then n.actor_name || '님이 일기를 남겼어요' || coalesce(' : ' || n.detail, '')
      when 'comment' then n.actor_name || '님이 내 일기에 댓글을 남겼어요' || coalesce(' : ' || n.detail, '')
      when 'reply' then n.actor_name || '님이 내 댓글에 답글을 남겼어요' || coalesce(' : ' || n.detail, '')
      when 'quota' then coalesce(n.detail, '구글 지도 하루 상한 알림')
      else n.actor_name || '님 덕분에 ' || coalesce(n.detail, '도시') || ' 도장을 받았어요'
    end,
    '/notifications'
  from taken n
  join public.push_subscriptions s on s.user_id = n.user_id
  left join public.trips t on t.id = n.trip_id
  where not exists (select 1 from public.push_prefs p where p.user_id = n.user_id and n.kind = any (p.off_kinds))
$$;
revoke all on function public.push_take_pending() from public, anon, authenticated;
grant execute on function public.push_take_pending() to service_role;
