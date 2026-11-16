/*
  0041 통화별 예산 (2026-11-17 마루님 "한번에 가자") : 미리 환전해 간 현지 돈. 적어 두면 경비 탭에서 "엔 ○ 남음"
  - trip_cash : 여행 x 통화(원화 빼고) 한 줄. amount 는 그 통화 최소 단위 정수. 총예산은 trip_budgets(원화)
  - 보기 : 함께하는 사람 모두 / 고치기, 지우기 : 주인과 편집 가능 (trip_fx 와 같음)
  - SQL Editor 붙여넣기에서 깨지지 않게 부등호 묶음과 정규식 기호를 쓰지 않는다
*/
create table if not exists public.trip_cash (
  trip_id    uuid not null references public.trips(id) on delete cascade,
  currency   text not null check (char_length(currency) = 3 and currency = upper(currency) and currency != 'KRW'),
  amount     bigint not null check (amount > 0 and amount <= 999999999999),
  updated_by uuid default auth.uid() references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (trip_id, currency)
);
alter table public.trip_cash enable row level security;
revoke all on public.trip_cash from anon, authenticated;
grant select, insert, update, delete on public.trip_cash to authenticated;
drop policy if exists trip_cash_select on public.trip_cash;
drop policy if exists trip_cash_insert on public.trip_cash;
drop policy if exists trip_cash_update on public.trip_cash;
drop policy if exists trip_cash_delete on public.trip_cash;
create policy trip_cash_select on public.trip_cash for select to authenticated using (private.can_view_trip(trip_id));
create policy trip_cash_insert on public.trip_cash for insert to authenticated with check (private.can_edit_trip(trip_id));
create policy trip_cash_update on public.trip_cash for update to authenticated using (private.can_edit_trip(trip_id)) with check (private.can_edit_trip(trip_id));
create policy trip_cash_delete on public.trip_cash for delete to authenticated using (private.can_edit_trip(trip_id));
