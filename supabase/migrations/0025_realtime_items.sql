/*
  0025 일정 실시간 반영 (6단계 2번, 2026-11-15)
  - 장소(itinerary_items) 바뀜을 Supabase Realtime 으로 보낸다. 받는 쪽은 RLS(볼 수 있는 여행)만 받음
  - 화면은 바뀜 신호만 받고 서버에서 다시 읽는다 (components/live-refresh.tsx)
*/
alter publication supabase_realtime add table public.itinerary_items;
