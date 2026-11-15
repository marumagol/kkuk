/*
  0027 휴대폰 알림 종류별 끄기 (6단계 4번, 2026-11-15)
  - push_prefs : 사람마다 끈 종류 목록 (joined, items, journal, comment, reply, stamp). 없으면 모두 켬
  - 앱 안 알림(종 아이콘)은 그대로 쌓이고, 휴대폰 푸시만 거른다
  - push_take_pending 다시 만들기 (0024 의 reply 문구 유지)
*/
create table public.push_prefs (
  user_id    uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  off_kinds  text[] not null default '{}' check (off_kinds <@ array['joined', 'items', 'journal', 'comment', 'reply', 'stamp']),
  updated_at timestamptz not null default now()
);
alter table public.push_prefs enable row level security;
revoke all on public.push_prefs from anon;
create policy push_prefs_select on public.push_prefs for select to authenticated using (user_id = (select auth.uid()));
create policy push_prefs_insert on public.push_prefs for insert to authenticated with check (user_id = (select auth.uid()));
create policy push_prefs_update on public.push_prefs for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create or replace function public.push_take_pending() returns table (endpoint text, p256dh text, auth text, title text, body text, url text)
language sql security definer set search_path = ''
as $$
  with taken as (
    update public.notifications n set pushed_at = now()
     where n.pushed_at is null and n.created_at > now() - interval '1 hour'
    returning n.*
  )
  select s.endpoint, s.p256dh, s.auth,
         coalesce(t.title, '꾹'),
         case n.kind
           when 'joined' then n.actor_name || '님이 여행에 함께하기 시작했어요'
           when 'items' then n.actor_name || '님이 장소를 고쳤어요' || coalesce(' (' || n.detail || ')', '')
           when 'journal' then n.actor_name || '님이 일기를 남겼어요' || coalesce(' : ' || n.detail, '')
           when 'comment' then n.actor_name || '님이 내 일기에 댓글을 남겼어요' || coalesce(' : ' || n.detail, '')
           when 'reply' then n.actor_name || '님이 내 댓글에 답글을 남겼어요' || coalesce(' : ' || n.detail, '')
           else n.actor_name || '님 덕분에 ' || coalesce(n.detail, '도시') || ' 도장을 받았어요'
         end,
         '/notifications'
    from taken n
    join public.push_subscriptions s on s.user_id = n.user_id
    left join public.trips t on t.id = n.trip_id
   where not exists (select 1 from public.push_prefs p where p.user_id = n.user_id and n.kind = any (p.off_kinds))
$$;
