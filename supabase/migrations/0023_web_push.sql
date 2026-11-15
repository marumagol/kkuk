/*
  0023 휴대폰 푸시 알림 (5단계 7번, 2026-11-15)
  - push_subscriptions : 기기별 구독 한 줄 (본인 것만 보고, 넣고, 지움)
  - 앱 안 알림(notifications)이 새로 생기면 트리거가 Edge Function "push" 를 부른다 (pg_net)
  - push 함수가 아직 안 보낸 알림(pushed_at 비어 있음)을 가져가 보내고 표시한다. 같은 알림은 한 번만
    (장소 고침 묶음은 처음 한 번만 푸시, 횟수만 올라가는 동안은 다시 안 보냄)
  - 푸시 키(VAPID)는 push 함수가 처음 불릴 때 스스로 만들어 private.push_keys 에 둔다. 아무도 키를 옮겨 적지 않음
  - 아래 public 함수 셋은 service_role(=Edge Function) 만 부를 수 있다
*/
create extension if not exists pg_net with schema extensions;

create table public.push_subscriptions (
  id         bigint generated always as identity primary key,
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  endpoint   text not null unique check (endpoint like 'https://%' and char_length(endpoint) <= 1000),
  p256dh     text not null check (char_length(p256dh) <= 200),
  auth       text not null check (char_length(auth) <= 100),
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon;
create policy push_subs_select on public.push_subscriptions for select to authenticated using (user_id = (select auth.uid()));
create policy push_subs_insert on public.push_subscriptions for insert to authenticated with check (user_id = (select auth.uid()));
create policy push_subs_delete on public.push_subscriptions for delete to authenticated using (user_id = (select auth.uid()));

-- 같은 기기를 다른 계정으로 다시 켜면 주인을 바꾼다 (endpoint 는 기기마다 하나)
create function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text) returns void
language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := (select auth.uid());
begin
  if v_uid is null then raise exception 'not_signed_in' using errcode = '28000'; end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values (v_uid, p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update set user_id = v_uid, p256dh = excluded.p256dh, auth = excluded.auth, created_at = now();
end $$;
revoke all on function public.save_push_subscription(text, text, text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text) to authenticated;

alter table public.notifications add column pushed_at timestamptz;
update public.notifications set pushed_at = created_at;

create table private.push_keys (
  id          boolean primary key default true check (id),
  public_key  text not null,
  private_key text not null
);

-- 키 읽기. 없으면 넘겨준 키를 저장하고 돌려준다 (먼저 저장된 것이 이김)
create function public.push_keys(p_public text default null, p_private text default null) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare k private.push_keys;
begin
  select * into k from private.push_keys;
  if not found and p_public is not null and p_private is not null then
    insert into private.push_keys (public_key, private_key) values (p_public, p_private) on conflict do nothing;
    select * into k from private.push_keys;
  end if;
  if k.public_key is null then return null; end if;
  return jsonb_build_object('public', k.public_key, 'private', k.private_key);
end $$;

-- 아직 안 보낸 알림(1시간 안)을 가져가며 보냄 표시. 받는 사람 기기마다 한 줄
create function public.push_take_pending() returns table (endpoint text, p256dh text, auth text, title text, body text, url text)
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
           else n.actor_name || '님 덕분에 ' || coalesce(n.detail, '도시') || ' 도장을 받았어요'
         end,
         '/notifications'
    from taken n
    join public.push_subscriptions s on s.user_id = n.user_id
    left join public.trips t on t.id = n.trip_id
$$;

create function public.push_drop(p_endpoint text) returns void
language sql security definer set search_path = ''
as $$ delete from public.push_subscriptions where endpoint = p_endpoint $$;

revoke all on function public.push_keys(text, text), public.push_take_pending(), public.push_drop(text) from public, anon, authenticated;
grant execute on function public.push_keys(text, text), public.push_take_pending(), public.push_drop(text) to service_role;

-- 새 알림이 생기면 push 함수를 깨운다 (문장마다 한 번). 실패해도 알림 저장은 그대로
create function private.wake_push() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if exists (select 1 from public.push_subscriptions) then
    begin
      perform net.http_post(url := 'https://ruayolopyrivcscraysf.supabase.co/functions/v1/push',
                            body := '{}'::jsonb, headers := '{"Content-Type":"application/json"}'::jsonb);
    exception when others then null;
    end;
  end if;
  return null;
end $$;
create trigger notifications_wake_push after insert on public.notifications
  for each statement execute function private.wake_push();
