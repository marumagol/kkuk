/*
  0010 준비 탭 + 함께하는 사람 얼굴 (2단계 5~7, 2026-11-14)
  - profiles : 같은 여행을 함께하는 사람의 이름과 사진은 서로 볼 수 있다
  - checklist_items : 준비 탭 "챙길 것"(item), "예약"(reservation). 담당자, 날짜(선택), 체크
  - trip_budgets : 여행 예산 (통화별 최소 단위 정수). 여행마다 1개
  - 보기 : 함께하는 사람 모두 / 쓰기 : 여행 주인, 편집 가능
*/
create function private.shares_trip(p_user uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.trip_members me join public.trip_members them on them.trip_id = me.trip_id
    where me.user_id = (select auth.uid()) and me.removed_at is null and them.user_id = p_user and them.removed_at is null)
$$;
revoke all on function private.shares_trip(uuid) from public, anon;
grant execute on function private.shares_trip(uuid) to authenticated;
create policy profiles_select_cotravelers on public.profiles for select to authenticated using (private.shares_trip(user_id));

create table public.checklist_items (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references public.trips(id) on delete cascade,
  kind        text not null check (kind in ('item', 'reservation')),
  title       text not null check (title = btrim(title) and char_length(title) between 1 and 80),
  due_date    date,
  assignee_id uuid references auth.users(id) on delete set null,
  done_at     timestamptz,
  done_by     uuid references auth.users(id) on delete set null,
  sort_order  integer not null default 0,
  created_by  uuid default auth.uid() references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  removed_at  timestamptz
);
create index checklist_items_trip on public.checklist_items (trip_id, kind, sort_order) where removed_at is null;

create function private.checklist_before_update() returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.id := old.id; new.trip_id := old.trip_id; new.created_by := old.created_by; new.created_at := old.created_at;
  new.updated_at := now();
  if new.done_at is distinct from old.done_at then new.done_by := case when new.done_at is null then null else (select auth.uid()) end; end if;
  return new;
end $$;
create trigger checklist_before_update before update on public.checklist_items
  for each row execute function private.checklist_before_update();

create table public.trip_budgets (
  trip_id    uuid primary key references public.trips(id) on delete cascade,
  currency   text not null check (currency ~ '^[A-Z]{3}$'),
  total      bigint not null check (total >= 0 and total <= 999999999999),
  updated_by uuid default auth.uid() references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.checklist_items enable row level security;
alter table public.trip_budgets    enable row level security;
revoke all on public.checklist_items, public.trip_budgets from anon, authenticated;
grant select, insert, update on public.checklist_items to authenticated;
grant select, insert, update on public.trip_budgets to authenticated;

create policy checklist_select on public.checklist_items for select to authenticated using (private.can_view_trip(trip_id));
create policy checklist_insert on public.checklist_items for insert to authenticated
  with check (private.can_edit_trip(trip_id) and created_by = (select auth.uid()));
create policy checklist_update on public.checklist_items for update to authenticated
  using (private.can_edit_trip(trip_id)) with check (private.can_edit_trip(trip_id));

create policy budgets_select on public.trip_budgets for select to authenticated using (private.can_view_trip(trip_id));
create policy budgets_insert on public.trip_budgets for insert to authenticated with check (private.can_edit_trip(trip_id));
create policy budgets_update on public.trip_budgets for update to authenticated
  using (private.can_edit_trip(trip_id)) with check (private.can_edit_trip(trip_id));
