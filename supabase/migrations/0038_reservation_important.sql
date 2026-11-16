/*
  0038 예약 중요 표시 (2026-11-16 마루님 "예약에서 중요표시 필요")
  - checklist_items.important : 별을 켠 예약은 목록 위에 보인다. 예전 줄은 false
*/
alter table public.checklist_items add column if not exists important boolean not null default false;
