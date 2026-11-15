/*
  장소의 "예약 필요" → 준비 탭 예약 (2026-11-15 마루님)
  checklist_items.item_id : 이 예약이 어느 장소에서 왔는지. 장소가 완전히 지워지면 같이 지워진다
  같은 여행의 장소만 이을 수 있다 (트리거). 살아 있는 예약은 장소 하나에 하나
*/
alter table public.checklist_items add column item_id uuid references public.itinerary_items(id) on delete cascade;
create unique index checklist_items_item on public.checklist_items (item_id) where item_id is not null and removed_at is null;

create function private.checklist_item_same_trip()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.item_id is not null and not exists (select 1 from public.itinerary_items i where i.id = new.item_id and i.trip_id = new.trip_id) then
    raise exception 'item_other_trip' using errcode = '22023';
  end if;
  return new;
end $$;
create trigger checklist_item_same_trip before insert or update of item_id, trip_id on public.checklist_items
  for each row execute function private.checklist_item_same_trip();
