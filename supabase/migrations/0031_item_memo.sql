/*
  일정에 메모 항목 (2026-11-15 마루님 "일정에서 메모로 추가할 수 있도록")
  분류에 memo 를 더한다. 메모는 장소가 아니라 그날 일정 사이에 끼우는 글 (제목 + memo 칸)
*/
alter table public.itinerary_items drop constraint itinerary_items_category_check;
alter table public.itinerary_items add constraint itinerary_items_category_check
  check (category in ('transport', 'food', 'sight', 'shopping', 'stay', 'memo'));
