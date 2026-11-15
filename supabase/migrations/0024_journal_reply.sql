/*
  0024 일기 답글 (2026-11-15 마루님 "답글은 1뎁스까지만")
  - journal_comments.parent_id : 답글이 달린 댓글. 답글에는 다시 답글을 달 수 없다 (한 단계만)
  - 답글은 같은 일기의 댓글에만. 댓글을 지우면 그 아래 답글도 함께 지워진다
  - 알림 : 일기 쓴 사람은 지금처럼 'comment'. 댓글 쓴 사람(일기 쓴 사람이 아니고 내가 아니면)에게 'reply'
  - 푸시 문구(push_take_pending)에 'reply' 추가
*/
alter table public.journal_comments add column parent_id uuid references public.journal_comments(id) on delete cascade;
create index journal_comments_parent on public.journal_comments (parent_id) where parent_id is not null;

create or replace function private.comment_before_insert() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare p public.journal_comments;
begin
  new.created_at := now();
  if new.parent_id is not null then
    select * into p from public.journal_comments c where c.id = new.parent_id;
    if p.id is null or p.entry_id <> new.entry_id then raise exception 'reply_parent' using errcode = 'P0001'; end if;
    if p.parent_id is not null then raise exception 'reply_depth' using errcode = 'P0001'; end if;
  end if;
  if (select count(*) from public.journal_comments c where c.entry_id = new.entry_id) >= 300 then
    raise exception 'comment_limit' using errcode = 'P0001';
  end if;
  return new;
end $$;

-- 답글은 고칠 수 없으니 parent_id 도 바뀌지 않는다 (update 권한 없음)

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in ('joined', 'items', 'journal', 'stamp', 'comment', 'reply'));

create function private.notify_reply() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare v_trip uuid; v_owner uuid; v_parent uuid;
begin
  if new.parent_id is null then return null; end if;
  select e.trip_id, e.author_id into v_trip, v_owner from public.journal_entries e where e.id = new.entry_id;
  select c.author_id into v_parent from public.journal_comments c where c.id = new.parent_id;
  if v_parent is null or v_parent = new.author_id or v_parent = v_owner then return null; end if;
  update public.notifications n set count = n.count + 1, created_at = now(), detail = left(new.body, 80)
   where n.user_id = v_parent and n.kind = 'reply' and n.ref_id = new.entry_id::text and n.actor_id = new.author_id and n.read_at is null;
  if not found then
    insert into public.notifications (user_id, trip_id, kind, actor_id, actor_name, ref_id, detail)
    values (v_parent, v_trip, 'reply', new.author_id, private.member_name(v_trip, new.author_id), new.entry_id::text, left(new.body, 80));
  end if;
  return null;
end $$;
create trigger notify_reply after insert on public.journal_comments
  for each row execute function private.notify_reply();
revoke all on function private.notify_reply() from public, anon, authenticated;

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
$$;
revoke all on function public.push_take_pending() from public, anon, authenticated;
grant execute on function public.push_take_pending() to service_role;
