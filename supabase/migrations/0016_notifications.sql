/*
  0016 앱 안 알림 1차 (4단계 8, 2026-11-15)
  - notifications : 받는 사람별 한 줄. 종류 joined(함께하는 사람 참여) / items(함께하는 사람이 장소를 고침) / journal(새 일기) / stamp(함께한 사람 덕분에 받은 도장)
  - 쓰기는 트리거만 (화면에서 직접 못 씀). 읽기와 읽음 표시는 본인 것만
  - 장소 고침은 같은 사람, 같은 여행이면 읽기 전 3시간 안의 알림 하나로 묶고 횟수(count)를 올린다
  - 휴대폰 푸시는 2차 (홈 화면 추가 + 웹 푸시 키 필요)
*/
create table public.notifications (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  trip_id    uuid not null references public.trips(id) on delete cascade,
  kind       text not null check (kind in ('joined', 'items', 'journal', 'stamp')),
  actor_id   uuid references auth.users(id) on delete set null,
  actor_name text not null default '함께하는 사람',
  ref_id     text,
  detail     text check (char_length(detail) <= 80),
  count      integer not null default 1,
  created_at timestamptz not null default now(),
  read_at    timestamptz
);
comment on table public.notifications is '앱 안 알림 (종 아이콘)';
create index notifications_user on public.notifications (user_id, created_at desc);
alter table public.notifications enable row level security;
revoke all on public.notifications from anon;
revoke insert, update, delete on public.notifications from authenticated;
grant select on public.notifications to authenticated;
create policy notifications_select on public.notifications for select to authenticated using (user_id = (select auth.uid()));

create function public.mark_notifications_read() returns void
language sql security definer set search_path = ''
as $$ update public.notifications set read_at = now() where user_id = (select auth.uid()) and read_at is null $$;
revoke all on function public.mark_notifications_read() from public, anon;
grant execute on function public.mark_notifications_read() to authenticated;

-- 여행 안 사람 이름 (함께하는 사람 목록의 이름 우선)
create function private.member_name(p_trip uuid, p_user uuid) returns text
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select m.display_name from public.trip_members m where m.trip_id = p_trip and m.user_id = p_user order by m.removed_at nulls first limit 1),
    (select p.display_name from public.profiles p where p.user_id = p_user), '함께하는 사람')
$$;

-- 이 여행의 다른 사람들에게 한 줄씩
create function private.notify_members(p_trip uuid, p_actor uuid, p_kind text, p_ref text, p_detail text) returns void
language sql security definer set search_path = ''
as $$
  insert into public.notifications (user_id, trip_id, kind, actor_id, actor_name, ref_id, detail)
  select m.user_id, p_trip, p_kind, p_actor, private.member_name(p_trip, p_actor), p_ref, left(p_detail, 80)
  from public.trip_members m
  where m.trip_id = p_trip and m.removed_at is null and m.user_id is not null and m.user_id is distinct from p_actor
$$;

-- 1. 함께하는 사람 참여
create function private.notify_joined() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.user_id is not null and new.role <> 'owner' and new.removed_at is null
     and (tg_op = 'INSERT' or old.removed_at is not null or old.user_id is null) then
    perform private.notify_members(new.trip_id, new.user_id, 'joined', null, null);
  end if;
  return null;
end $$;
create trigger notify_joined after insert or update of user_id, removed_at on public.trip_members
  for each row execute function private.notify_joined();

-- 2. 장소 고침 (추가, 수정, 순서, 삭제). 3시간 안의 안 읽은 알림이 있으면 묶는다
create function private.notify_items() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare v_actor uuid := (select auth.uid()); v_trip uuid := coalesce(new.trip_id, old.trip_id); v_name text;
begin
  if v_actor is null then return null; end if;
  update public.notifications n set count = n.count + 1, created_at = now(), detail = left(coalesce(new.title, old.title), 80)
   where n.trip_id = v_trip and n.kind = 'items' and n.actor_id = v_actor and n.read_at is null and n.created_at > now() - interval '3 hours';
  v_name := private.member_name(v_trip, v_actor);
  insert into public.notifications (user_id, trip_id, kind, actor_id, actor_name, detail)
  select m.user_id, v_trip, 'items', v_actor, v_name, left(coalesce(new.title, old.title), 80)
  from public.trip_members m
  where m.trip_id = v_trip and m.removed_at is null and m.user_id is not null and m.user_id <> v_actor
    and not exists (select 1 from public.notifications n where n.user_id = m.user_id and n.trip_id = v_trip and n.kind = 'items'
                    and n.actor_id = v_actor and n.read_at is null and n.created_at > now() - interval '3 hours');
  return null;
end $$;
create trigger notify_items after insert or update on public.itinerary_items
  for each row execute function private.notify_items();

-- 3. 새 일기 (함께하는 사람에게 보이게 된 처음 한 번)
create function private.notify_journal() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.visibility <> 'private' and new.removed_at is null
     and not exists (select 1 from public.notifications n where n.kind = 'journal' and n.ref_id = new.id::text) then
    perform private.notify_members(new.trip_id, new.author_id, 'journal', new.id::text,
      coalesce(new.title, case when new.kind = 'recap' then '여행 회고' else (new.day_index + 1) || '일차 일기' end));
  end if;
  return null;
end $$;
create trigger notify_journal after insert or update of visibility, removed_at on public.journal_entries
  for each row execute function private.notify_journal();

-- 4. 함께한 사람이 인증해서 받은 도장
create function private.notify_stamp() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare v_by uuid; v_city text;
begin
  select s.verified_by into v_by from public.stamp_checkins s where s.trip_id = new.trip_id and s.city_id = new.city_id;
  if v_by is null or v_by = new.user_id then return null; end if;
  select c.name into v_city from public.cities c where c.id = new.city_id;
  insert into public.notifications (user_id, trip_id, kind, actor_id, actor_name, ref_id, detail)
  values (new.user_id, new.trip_id, 'stamp', v_by, private.member_name(new.trip_id, v_by), new.city_id::text, v_city);
  return null;
end $$;
create trigger notify_stamp after insert on public.stamp_grants
  for each row execute function private.notify_stamp();

revoke all on function private.member_name(uuid, uuid), private.notify_members(uuid, uuid, text, text, text) from public, anon;
