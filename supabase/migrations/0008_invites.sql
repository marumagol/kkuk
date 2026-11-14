/*
  0008 같이 쓰기 : 초대 링크와 함께하는 사람 관리 (2단계 0, 2026-11-14)
  - trip_invites : 여행마다 살아 있는 링크는 1개. 새로 만들면 예전 링크는 끊긴다. 7일 뒤 만료
  - 여행 주인만 : 링크 만들기/끊기, 권한 바꾸기, 내보내기, 주인 넘기기
  - 참여 : 링크 + 로그인 + 이름. 여행당 최대 10명 (유료 범위 정할 때 다시, 확인 필요)
  - 나가기 : 편집 가능/보기만은 바로. 주인은 넘긴 뒤
  - 권한 검사는 그대로 private.trip_role() 한 곳
*/
create table public.trip_invites (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references public.trips(id) on delete cascade,
  token       text not null unique check (token ~ '^[0-9a-f]{32}$'),
  role        text not null check (role in ('editor', 'viewer')),
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '7 days',
  revoked_at  timestamptz
);
create unique index trip_invites_one_live on public.trip_invites (trip_id) where revoked_at is null;
alter table public.trip_invites enable row level security;
revoke all on public.trip_invites from anon, authenticated;
grant select on public.trip_invites to authenticated;
-- 링크(토큰)는 여행 주인만 본다
create policy trip_invites_select on public.trip_invites for select to authenticated using (private.is_trip_owner(trip_id));

-- 공통 : 로그인한 사람이 이 여행의 주인이고 여행이 살아 있는지
create function private.require_owner(p_trip uuid) returns void
language plpgsql stable security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is null then raise exception 'not_signed_in' using errcode = '28000'; end if;
  if not private.is_trip_owner(p_trip) then raise exception 'forbidden' using errcode = '42501'; end if;
  if exists (select 1 from public.trips t where t.id = p_trip and t.removed_at is not null) then raise exception 'trip_removed' using errcode = '22023'; end if;
end $$;
revoke all on function private.require_owner(uuid) from public, anon;
grant execute on function private.require_owner(uuid) to authenticated;

-- 링크 만들기 (예전 링크는 끊음). 토큰을 돌려준다
create function public.create_invite(p_trip uuid, p_role text) returns text
language plpgsql security definer set search_path = ''
as $$
declare v_token text := replace(gen_random_uuid()::text, '-', '');
begin
  perform private.require_owner(p_trip);
  if p_role not in ('editor', 'viewer') then raise exception 'role_invalid' using errcode = '22023'; end if;
  update public.trip_invites set revoked_at = now() where trip_id = p_trip and revoked_at is null;
  insert into public.trip_invites (trip_id, token, role, created_by) values (p_trip, v_token, p_role, (select auth.uid()));
  return v_token;
end $$;

-- 링크 끊기
create function public.revoke_invite(p_trip uuid) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.require_owner(p_trip);
  update public.trip_invites set revoked_at = now() where trip_id = p_trip and revoked_at is null;
end $$;

-- 링크 미리 보기 (로그인 전에도). 여행 이름, 기간, 초대한 사람, 권한, 상태만
create function public.invite_preview(p_token text)
returns table (trip_id uuid, title text, start_date date, end_date date, inviter text, role text, status text)
language plpgsql stable security definer set search_path = ''
as $$
declare v public.trip_invites; t public.trips; v_inviter text;
begin
  select * into v from public.trip_invites i where i.token = p_token;
  if not found then return query select null::uuid, null::text, null::date, null::date, null::text, null::text, 'not_found'::text; return; end if;
  select * into t from public.trips x where x.id = v.trip_id;
  select m.display_name into v_inviter from public.trip_members m where m.trip_id = v.trip_id and m.role = 'owner' and m.removed_at is null;
  return query select
    case when (select auth.uid()) is not null and private.trip_role(t.id) is not null then t.id end,
    t.title, t.start_date, t.end_date, v_inviter, v.role,
    case
      when t.removed_at is not null then 'trip_removed'
      when v.revoked_at is not null then 'revoked'
      when v.expires_at < now() then 'expired'
      when (select auth.uid()) is not null and private.trip_role(t.id) is not null then 'joined'
      else 'ok'
    end;
end $$;

-- 참여. 이미 함께하면 그대로 여행 id
create function public.accept_invite(p_token text) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := (select auth.uid()); v public.trip_invites; v_name text; v_n int;
begin
  if v_uid is null then raise exception 'not_signed_in' using errcode = '28000'; end if;
  select p.display_name into v_name from public.profiles p where p.user_id = v_uid and p.deleted_at is null;
  if v_name is null then raise exception 'profile_required' using errcode = '22023'; end if;
  select * into v from public.trip_invites i where i.token = p_token for update;
  if not found then raise exception 'invite_not_found' using errcode = '22023'; end if;
  if private.trip_role(v.trip_id) is not null then return v.trip_id; end if;
  if v.revoked_at is not null then raise exception 'invite_revoked' using errcode = '22023'; end if;
  if v.expires_at < now() then raise exception 'invite_expired' using errcode = '22023'; end if;
  if exists (select 1 from public.trips t where t.id = v.trip_id and t.removed_at is not null) then raise exception 'trip_removed' using errcode = '22023'; end if;
  select count(*) into v_n from public.trip_members m where m.trip_id = v.trip_id and m.removed_at is null;
  if v_n >= 10 then raise exception 'trip_full' using errcode = '22023'; end if;
  insert into public.trip_members (trip_id, user_id, role, display_name) values (v.trip_id, v_uid, v.role, v_name);
  return v.trip_id;
end $$;

-- 권한 바꾸기 (주인 → 다른 사람, editor/viewer)
create function public.set_member_role(p_member uuid, p_role text) returns void
language plpgsql security definer set search_path = ''
as $$
declare m public.trip_members;
begin
  select * into m from public.trip_members x where x.id = p_member and x.removed_at is null;
  if not found then raise exception 'member_not_found' using errcode = '22023'; end if;
  perform private.require_owner(m.trip_id);
  if m.role = 'owner' then raise exception 'owner_role_fixed' using errcode = '22023'; end if;
  if p_role not in ('editor', 'viewer') then raise exception 'role_invalid' using errcode = '22023'; end if;
  update public.trip_members set role = p_role where id = p_member;
end $$;

-- 내보내기 (주인 → 다른 사람)
create function public.remove_member(p_member uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare m public.trip_members;
begin
  select * into m from public.trip_members x where x.id = p_member and x.removed_at is null;
  if not found then raise exception 'member_not_found' using errcode = '22023'; end if;
  perform private.require_owner(m.trip_id);
  if m.role = 'owner' then raise exception 'owner_cannot_leave' using errcode = '22023'; end if;
  update public.trip_members set removed_at = now() where id = p_member;
end $$;

-- 나가기 (나 자신). 주인은 먼저 넘겨야 한다
create function public.leave_trip(p_trip uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare v_role text := private.trip_role(p_trip);
begin
  if v_role is null then raise exception 'forbidden' using errcode = '42501'; end if;
  if v_role = 'owner' then raise exception 'transfer_required' using errcode = '22023'; end if;
  update public.trip_members set removed_at = now() where trip_id = p_trip and user_id = (select auth.uid()) and removed_at is null;
end $$;

-- 여행 주인 넘기기 (나는 편집 가능이 된다)
create function public.transfer_owner(p_member uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare m public.trip_members;
begin
  select * into m from public.trip_members x where x.id = p_member and x.removed_at is null and x.user_id is not null;
  if not found then raise exception 'member_not_found' using errcode = '22023'; end if;
  perform private.require_owner(m.trip_id);
  if m.role = 'owner' then return; end if;
  update public.trip_members set role = 'editor' where trip_id = m.trip_id and role = 'owner' and removed_at is null;
  update public.trip_members set role = 'owner' where id = p_member;
end $$;

revoke all on function public.create_invite(uuid, text), public.revoke_invite(uuid), public.invite_preview(text), public.accept_invite(text),
  public.set_member_role(uuid, text), public.remove_member(uuid), public.leave_trip(uuid), public.transfer_owner(uuid) from public;
grant execute on function public.create_invite(uuid, text), public.revoke_invite(uuid), public.accept_invite(text),
  public.set_member_role(uuid, text), public.remove_member(uuid), public.leave_trip(uuid), public.transfer_owner(uuid) to authenticated;
-- 미리 보기만 로그인 전에도
grant execute on function public.invite_preview(text) to anon, authenticated;
