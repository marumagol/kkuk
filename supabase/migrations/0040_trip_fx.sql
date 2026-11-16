/*
  0040 여행 환율 (2026-11-17 마루님 "여러 나라 경비를 원화 하나로") : 함께하는 사람이 같은 환율로 같은 원화 금액을 보게 여행마다 저장
  - trip_fx : 여행 × 통화(원화 빼고) 한 줄. 1 통화 = krw_per 원. 없으면 앱이 그날 받아 온 환율을 쓴다
  - 보기 : 함께하는 사람 모두 / 고치기·지우기 : 주인과 편집 가능 (trip_budgets 와 같음)
*/
create table public.trip_fx (
  trip_id    uuid not null references public.trips(id) on delete cascade,
  currency   text not null check (currency ~ '^[A-Z]{3}$' and currency <> 'KRW'),
  krw_per    numeric(16,6) not null check (krw_per > 0 and krw_per <= 1000000),
  updated_by uuid default auth.uid() references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (trip_id, currency)
);
alter table public.trip_fx enable row level security;
revoke all on public.trip_fx from anon, authenticated;
grant select, insert, update, delete on public.trip_fx to authenticated;
create policy trip_fx_select on public.trip_fx for select to authenticated using (private.can_view_trip(trip_id));
create policy trip_fx_insert on public.trip_fx for insert to authenticated with check (private.can_edit_trip(trip_id));
create policy trip_fx_update on public.trip_fx for update to authenticated using (private.can_edit_trip(trip_id)) with check (private.can_edit_trip(trip_id));
create policy trip_fx_delete on public.trip_fx for delete to authenticated using (private.can_edit_trip(trip_id));
