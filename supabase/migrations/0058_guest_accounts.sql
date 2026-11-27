/*
  0058 로그인 없이 써 보기 : 손님 계정 (2026-11-27 마루님, 앱 0.107.0)
  - 손님 = Supabase 익명 로그인 사용자. 역할은 authenticated 와 같고 토큰의 is_anonymous 가 true
  - 손님은 초대 만들기, 초대 받아 들어가기, 일정 공유 링크 만들기를 못 한다 (화면에서도 막고, 여기서 한 번 더)
  - 손님은 장소 검색 하루 상한이 더 낮다 (구글 지도 비용)
  - 30일 동안 접속이 없는 손님 계정은 매일 02:30(한국 시간) 지운다. 손님 여행은 "30일 지난 삭제"로 표시해 03:00 purge 가 사진 파일까지 지운다
  - 카카오/구글로 로그인하면(linkIdentity) 같은 계정이 그대로 일반 계정이 된다 (is_anonymous false)
*/

create or replace function private.is_guest() returns boolean
language sql stable set search_path = ''
as $$ select coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) $$;
revoke all on function private.is_guest() from public, anon;
grant execute on function private.is_guest() to authenticated;

-- 초대 만들기 (0008 + 손님 막기)
create or replace function public.create_invite(p_trip uuid, p_role text) returns text
language plpgsql security definer set search_path = ''
as $$
declare v_token text := replace(gen_random_uuid()::text, '-', '');
begin
  if private.is_guest() then raise exception 'guest_forbidden' using errcode = '42501'; end if;
  perform private.require_owner(p_trip);
  if p_role not in ('editor', 'viewer') then raise exception 'role_invalid' using errcode = '22023'; end if;
  update public.trip_invites set revoked_at = now() where trip_id = p_trip and revoked_at is null;
  insert into public.trip_invites (trip_id, token, role, created_by) values (p_trip, v_token, p_role, (select auth.uid()));
  return v_token;
end $$;

-- 초대 받아 들어가기 (0020 + 손님 막기)
create or replace function public.accept_invite(p_token text) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := (select auth.uid()); v public.trip_invites; v_name text; v_n int;
begin
  if v_uid is null then raise exception 'not_signed_in' using errcode = '28000'; end if;
  if private.is_guest() then raise exception 'guest_forbidden' using errcode = '42501'; end if;
  select p.display_name into v_name from public.profiles p where p.user_id = v_uid and p.deleted_at is null;
  if v_name is null then raise exception 'profile_required' using errcode = '22023'; end if;
  select * into v from public.trip_invites i where i.token = p_token for update;
  if not found then raise exception 'invite_not_found' using errcode = '22023'; end if;
  if private.trip_role(v.trip_id) is not null then return v.trip_id; end if;
  if v.revoked_at is not null then raise exception 'invite_revoked' using errcode = '22023'; end if;
  if v.expires_at < now() then raise exception 'invite_expired' using errcode = '22023'; end if;
  if exists (select 1 from public.trips t where t.id = v.trip_id and t.removed_at is not null) then raise exception 'trip_removed' using errcode = '22023'; end if;
  select count(*) into v_n from public.trip_members m where m.trip_id = v.trip_id and m.removed_at is null;
  if v_n >= private.trip_limit(v.trip_id, 'members') then raise exception 'trip_full' using errcode = '22023'; end if;
  insert into public.trip_members (trip_id, user_id, role, display_name) values (v.trip_id, v_uid, v.role, v_name);
  return v.trip_id;
end $$;

-- 일정 공유 링크 만들기 (0018 + 손님 막기)
create or replace function public.create_trip_share(p_trip uuid, p_days integer[]) returns text
language plpgsql security definer set search_path = ''
as $$
declare v_token text := replace(gen_random_uuid()::text, '-', ''); v_len integer; v_days integer[];
begin
  if (select auth.uid()) is null then raise exception 'not_signed_in' using errcode = '28000'; end if;
  if private.is_guest() then raise exception 'guest_forbidden' using errcode = '42501'; end if;
  if not private.can_edit_trip(p_trip) then raise exception 'forbidden' using errcode = '42501'; end if;
  select t.end_date - t.start_date + 1 into v_len from public.trips t where t.id = p_trip and t.removed_at is null;
  if v_len is null then raise exception 'trip_removed' using errcode = '22023'; end if;
  if p_days is not null then
    select array_agg(distinct d order by d) into v_days from unnest(p_days) d where d is not null;
    if v_days is null or exists (select 1 from unnest(v_days) d where d < 0 or d >= v_len) then
      raise exception 'days_invalid' using errcode = '22023'; end if;
  end if;
  if (select count(*) from public.trip_shares s where s.trip_id = p_trip and s.revoked_at is null) >= 20 then
    raise exception 'too_many_shares' using errcode = '22023'; end if;
  insert into public.trip_shares (trip_id, token, days) values (p_trip, v_token, v_days);
  return v_token;
end $$;

-- 장소 검색 하루 상한 (0048 + 손님은 사람당 상한을 낮게 : 30/20/10/5)
create or replace function public.take_place_quota(p_kind text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_me uuid := (select auth.uid()); v_day date := (now() at time zone 'Asia/Seoul')::date;
  v_all integer; v_mine integer; v_cap_all integer; v_cap_me integer;
begin
  if v_me is null then raise exception 'not_signed_in' using errcode = '28000'; end if;
  if p_kind not in ('autocomplete', 'details', 'hours', 'find') then raise exception 'kind_invalid' using errcode = '22023'; end if;
  v_cap_all := case p_kind when 'autocomplete' then 330 when 'details' then 300 when 'find' then 150 else 30 end;
  v_cap_me := case when private.is_guest()
    then case p_kind when 'autocomplete' then 30 when 'details' then 20 when 'find' then 10 else 5 end
    else case p_kind when 'autocomplete' then 100 when 'details' then 60 when 'find' then 40 else 15 end end;
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

-- 30일 동안 접속이 없는 손님 계정 지우기 (한 번에 500명까지)
-- 접속 = 로그인 세션이 새로 고쳐진 때 (화면을 열면 토큰이 갱신된다)
create or replace function private.purge_guests() returns integer
language plpgsql security definer set search_path = ''
as $$
declare v_ids uuid[]; v_n integer;
begin
  select array_agg(x.id) into v_ids from (
    select u.id from auth.users u
     where u.is_anonymous
       and u.created_at < now() - interval '30 days'
       and coalesce(u.last_sign_in_at, u.created_at) < now() - interval '30 days'
       and not exists (select 1 from auth.sessions s where s.user_id = u.id
                        and greatest(s.created_at, s.updated_at, s.refreshed_at::timestamptz) > now() - interval '30 days')
     order by u.created_at limit 500) x;
  if v_ids is null then return 0; end if;
  update public.trips t set removed_at = now() - interval '31 days'
    from public.trip_members m
   where m.trip_id = t.id and m.role = 'owner' and m.removed_at is null and m.user_id = any(v_ids);
  update public.trip_members set removed_at = now() where user_id = any(v_ids) and removed_at is null;
  delete from auth.users where id = any(v_ids) and is_anonymous;
  get diagnostics v_n = row_count;
  return v_n;
end $$;
revoke all on function private.purge_guests() from public, anon, authenticated;

select cron.schedule('kkuk-purge-guests', '30 17 * * *', $c$ select private.purge_guests() $c$);
