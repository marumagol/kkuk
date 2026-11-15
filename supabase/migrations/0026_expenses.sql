/*
  0026 경비와 정산 (6단계 3번, 2026-11-15)
  - trip_expenses : 낸 사람, 금액(통화별 최소 단위 정수), 통화, 나눌 사람(user id 배열)
  - 보기는 함께하는 사람 모두, 쓰기와 고치기는 주인과 편집 가능 (일정과 같음). 지우기는 removed_at
  - 낸 사람과 나눌 사람은 적는 순간 이 여행의 함께하는 사람이어야 함 (나중에 나가도 기록은 남음)
  - 정산 계산은 앱(lib/settle.ts)에서. 환율 계산은 하지 않고 통화별로 따로
*/
create table public.trip_expenses (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references public.trips(id) on delete cascade,
  title       text not null check (title = btrim(title) and char_length(title) between 1 and 60),
  amount      bigint not null check (amount > 0 and amount < 1000000000000),
  currency    text not null check (currency ~ '^[A-Z]{3}$'),
  paid_by     uuid not null references auth.users(id) on delete cascade,
  split_with  uuid[] not null check (cardinality(split_with) between 1 and 100),
  spent_on    date,
  created_by  uuid references auth.users(id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  removed_at  timestamptz
);
create index trip_expenses_trip on public.trip_expenses (trip_id, created_at) where removed_at is null;
alter table public.trip_expenses enable row level security;
revoke all on public.trip_expenses from anon;
create policy trip_expenses_select on public.trip_expenses for select to authenticated using (private.can_view_trip(trip_id));
create policy trip_expenses_insert on public.trip_expenses for insert to authenticated with check (private.can_edit_trip(trip_id));
create policy trip_expenses_update on public.trip_expenses for update to authenticated using (private.can_edit_trip(trip_id)) with check (private.can_edit_trip(trip_id));

create function private.expenses_before_write() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    new.id := old.id; new.trip_id := old.trip_id; new.created_by := old.created_by; new.created_at := old.created_at;
    new.updated_at := now();
  else
    new.created_by := (select auth.uid());
  end if;
  new.split_with := array(select distinct x from unnest(new.split_with) x);
  if new.removed_at is null and (
       not exists (select 1 from public.trip_members m where m.trip_id = new.trip_id and m.user_id = new.paid_by and m.removed_at is null)
       or exists (select 1 from unnest(new.split_with) u
                   where not exists (select 1 from public.trip_members m where m.trip_id = new.trip_id and m.user_id = u and m.removed_at is null)))
     and (tg_op = 'INSERT' or new.paid_by is distinct from old.paid_by or new.split_with is distinct from old.split_with) then
    raise exception 'not_member' using errcode = '22023';
  end if;
  return new;
end $$;
create trigger trip_expenses_before_write before insert or update on public.trip_expenses
  for each row execute function private.expenses_before_write();
