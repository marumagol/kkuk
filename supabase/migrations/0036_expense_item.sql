/*
  0036 경비 ← 장소 가져오기 (2026-11-16 마루님 "장소에 등록한 비용이 경비와 정산에")
  - trip_expenses.item_id : 이 경비를 어느 장소의 예상 비용에서 가져왔는지. 장소가 완전히 지워지면 연결만 끊긴다 (경비는 실제 낸 돈이라 남김)
  - 살아 있는 경비는 장소 하나에 하나 (같은 장소를 두 번 가져오지 않게). 같은 여행의 장소만 이을 수 있다
*/
alter table public.trip_expenses add column item_id uuid references public.itinerary_items(id) on delete set null;
create unique index trip_expenses_item on public.trip_expenses (item_id) where item_id is not null and removed_at is null;

create function private.expense_item_same_trip()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.item_id is not null and not exists (select 1 from public.itinerary_items i where i.id = new.item_id and i.trip_id = new.trip_id) then
    raise exception 'item_other_trip' using errcode = '22023';
  end if;
  return new;
end $$;
create trigger trip_expenses_item_same_trip before insert or update of item_id, trip_id on public.trip_expenses
  for each row execute function private.expense_item_same_trip();
