-- 일정 분류에 '기타'(etc) 추가 (2026-11-17 마루님). 필드는 관광과 같고 예약, 비용은 없음
alter table public.itinerary_items drop constraint itinerary_items_category_check;
alter table public.itinerary_items add constraint itinerary_items_category_check
  check (category in ('transport', 'food', 'sight', 'shopping', 'stay', 'memo', 'etc'));
