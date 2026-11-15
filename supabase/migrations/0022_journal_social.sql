/*
  0022 일기 피드 : 좋아요, 댓글 (2026-11-15 마루님 결정 "추천대로")
  - 누가 : 그 일기를 볼 수 있는 함께하는 사람(보기만 포함). 나만 보기 글에는 좋아요, 댓글이 없다 (있던 것은 가려지고, 공개 범위를 되돌리면 다시 보인다)
  - 검사는 private.can_react_entry(일기 id) 한 곳 : 지우지 않은 일기 + 나만 보기가 아님 + 삭제 안 된 여행 + 내가 함께하는 사람
  - journal_likes : 사람당 한 번 (누르면 생기고 다시 누르면 지워진다)
  - journal_comments : 500자, 고치기 없음. 지우기는 댓글 쓴 사람과 일기 쓴 사람
  - 링크로 본 사람(로그인 없음) : public_entry 가 좋아요 수만 돌려준다. 댓글은 돌려주지 않는다
  - 알림 : 내 일기에 댓글이 달리면 kind 'comment' (같은 사람의 안 읽은 알림은 하나로 묶음). 좋아요는 알림 없음
*/
create function private.can_react_entry(p_entry uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.journal_entries e join public.trips t on t.id = e.trip_id
    where e.id = p_entry and e.removed_at is null and e.visibility <> 'private' and t.removed_at is null
      and private.can_view_trip(e.trip_id))
$$;
create function private.is_entry_author(p_entry uuid) returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.journal_entries e where e.id = p_entry and e.author_id = (select auth.uid())) $$;
revoke all on function private.can_react_entry(uuid), private.is_entry_author(uuid) from public, anon;
grant execute on function private.can_react_entry(uuid), private.is_entry_author(uuid) to authenticated;

-- 좋아요
create table public.journal_likes (
  entry_id   uuid not null references public.journal_entries(id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (entry_id, user_id)
);
comment on table public.journal_likes is '일기 좋아요 (사람당 한 번)';
create index journal_likes_user on public.journal_likes (user_id);
alter table public.journal_likes enable row level security;
revoke all on public.journal_likes from anon, authenticated;
grant select, insert, delete on public.journal_likes to authenticated;
create policy journal_likes_select on public.journal_likes for select to authenticated using (private.can_react_entry(entry_id));
create policy journal_likes_insert on public.journal_likes for insert to authenticated
  with check (user_id = (select auth.uid()) and private.can_react_entry(entry_id));
create policy journal_likes_delete on public.journal_likes for delete to authenticated using (user_id = (select auth.uid()));

-- 댓글
create table public.journal_comments (
  id         uuid primary key default gen_random_uuid(),
  entry_id   uuid not null references public.journal_entries(id) on delete cascade,
  author_id  uuid not null default auth.uid() references auth.users(id) on delete cascade,
  body       text not null check (body = btrim(body) and char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);
comment on table public.journal_comments is '일기 댓글 (고치기 없음, 지우면 바로 없어진다)';
create index journal_comments_entry on public.journal_comments (entry_id, created_at);
create index journal_comments_author on public.journal_comments (author_id);
alter table public.journal_comments enable row level security;
revoke all on public.journal_comments from anon, authenticated;
grant select, insert, delete on public.journal_comments to authenticated;
create policy journal_comments_select on public.journal_comments for select to authenticated using (private.can_react_entry(entry_id));
create policy journal_comments_insert on public.journal_comments for insert to authenticated
  with check (author_id = (select auth.uid()) and private.can_react_entry(entry_id));
create policy journal_comments_delete on public.journal_comments for delete to authenticated
  using (author_id = (select auth.uid()) or private.is_entry_author(entry_id));

-- 댓글 쓸 때 : 시각은 서버 것으로, 일기 한 편에 300개까지
create function private.comment_before_insert() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  new.created_at := now();
  if (select count(*) from public.journal_comments c where c.entry_id = new.entry_id) >= 300 then
    raise exception 'comment_limit' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger comment_before_insert before insert on public.journal_comments
  for each row execute function private.comment_before_insert();

-- 일기 목록용 숫자 (내가 볼 수 있는 것만 세어진다. RLS 그대로)
create function public.journal_counts(p_ids uuid[])
returns table (entry_id uuid, likes integer, liked boolean, comments integer)
language sql stable set search_path = ''
as $$
  select x.id,
    (select count(*)::int from public.journal_likes l where l.entry_id = x.id),
    exists (select 1 from public.journal_likes l where l.entry_id = x.id and l.user_id = (select auth.uid())),
    (select count(*)::int from public.journal_comments c where c.entry_id = x.id)
  from unnest(p_ids[1:100]) as x(id)
$$;
revoke all on function public.journal_counts(uuid[]) from public, anon;
grant execute on function public.journal_counts(uuid[]) to authenticated;

-- 링크로 공개한 일기 : 좋아요 수를 함께 (댓글은 주지 않는다)
drop function public.public_entry(text);
create function public.public_entry(p_token text)
returns table (kind text, day_index integer, title text, body text, photos text[], updated_at timestamptz,
               author text, trip_title text, start_date date, end_date date, like_count integer)
language sql stable security definer set search_path = ''
as $$
  select e.kind, e.day_index, e.title, e.body, e.photos, e.updated_at,
         coalesce((select m.display_name from public.trip_members m where m.trip_id = e.trip_id and m.user_id = e.author_id order by m.removed_at nulls first limit 1), '여행자'),
         t.title, t.start_date, t.end_date,
         (select count(*)::int from public.journal_likes l where l.entry_id = e.id)
  from public.journal_entries e join public.trips t on t.id = e.trip_id
  where p_token ~ '^[0-9a-f]{32}$' and e.share_token = p_token
    and e.visibility = 'public' and e.removed_at is null and t.removed_at is null
$$;
revoke all on function public.public_entry(text) from public;
grant execute on function public.public_entry(text) to anon, authenticated;

-- 알림 : 내 일기에 달린 댓글
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in ('joined', 'items', 'journal', 'stamp', 'comment'));

create function private.notify_comment() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare v_trip uuid; v_owner uuid;
begin
  select e.trip_id, e.author_id into v_trip, v_owner from public.journal_entries e where e.id = new.entry_id;
  if v_owner is null or v_owner = new.author_id then return null; end if;
  update public.notifications n set count = n.count + 1, created_at = now(), detail = left(new.body, 80)
   where n.user_id = v_owner and n.kind = 'comment' and n.ref_id = new.entry_id::text and n.actor_id = new.author_id and n.read_at is null;
  if not found then
    insert into public.notifications (user_id, trip_id, kind, actor_id, actor_name, ref_id, detail)
    values (v_owner, v_trip, 'comment', new.author_id, private.member_name(v_trip, new.author_id), new.entry_id::text, left(new.body, 80));
  end if;
  return null;
end $$;
create trigger notify_comment after insert on public.journal_comments
  for each row execute function private.notify_comment();
revoke all on function private.comment_before_insert(), private.notify_comment() from public, anon, authenticated;
