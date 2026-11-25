-- 0056 전수 점검 P2 (2026-11-25) : 옛 좌표 도장 함수 삭제, 자주 찾는 외래키 색인
-- 옛 claim_stamp(좌표를 서버로 보내던 방식)는 0046 에서 실행 권한을 회수한 뒤 쓰지 않는다 (위치정보법, 기획/17)
drop function if exists public.claim_stamp(uuid, double precision, double precision, double precision);

-- 카드, 알림, 정산 화면에서 조건으로 찾는 외래키
create index if not exists stamp_grants_trip_id_idx on public.stamp_grants (trip_id);
create index if not exists stamp_grants_city_id_idx on public.stamp_grants (city_id);
create index if not exists stamp_checkins_city_id_idx on public.stamp_checkins (city_id);
create index if not exists stamp_featured_city_id_idx on public.stamp_featured (city_id);
create index if not exists notifications_trip_id_idx on public.notifications (trip_id);
create index if not exists trip_expenses_paid_by_idx on public.trip_expenses (paid_by);
create index if not exists checklist_items_assignee_id_idx on public.checklist_items (assignee_id);
