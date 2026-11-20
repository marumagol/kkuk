/*
  뽑힌 카드 고정 (2026-11-20 마루님) : 도장을 받는 순간 카드 테마를 뽑아 stamp_grants.card_tier 에 저장한다
  - 같은 도시에서 이미 나온 테마는 빼고, 레인보우(6)만 절반 확률. 다 모으면 null (화면은 새 카드 없이 방문 횟수만)
  - 테마 번호 : 4 에메랄드, 2 골드, 3 자수정, 5 오팔, 10 크리스탈, 7 코랄, 8 실버, 11 사파이어, 12 루비, 6 레인보우 (lib/card-tier.ts TIERS 와 같게)
  - 테마를 더할 때는 아래 values 목록에도 추가한다. 이미 받은 카드는 바뀌지 않는다
  - 기존 도장은 그동안 화면이 보여 주던 카드 그대로 채운다
*/
alter table public.stamp_grants add column if not exists card_tier smallint;

create or replace function private.pick_card_tier() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare v_left numeric; v_r numeric; v_pick smallint; rec record;
begin
  if new.card_tier is not null then return new; end if;
  for rec in
    select t.tier, t.w from (values (4, 1.0), (2, 1.0), (3, 1.0), (5, 1.0), (10, 1.0), (7, 1.0), (8, 1.0), (11, 1.0), (12, 1.0), (6, 0.5)) as t(tier, w)
    where t.tier not in (select g.card_tier from public.stamp_grants g where g.user_id = new.user_id and g.city_id = new.city_id and g.card_tier is not null)
  loop
    v_left := coalesce(v_left, 0) + rec.w;
  end loop;
  if v_left is null then return new; end if;
  v_r := random() * v_left;
  for rec in
    select t.tier, t.w from (values (4, 1.0), (2, 1.0), (3, 1.0), (5, 1.0), (10, 1.0), (7, 1.0), (8, 1.0), (11, 1.0), (12, 1.0), (6, 0.5)) as t(tier, w)
    where t.tier not in (select g.card_tier from public.stamp_grants g where g.user_id = new.user_id and g.city_id = new.city_id and g.card_tier is not null)
  loop
    v_pick := rec.tier;
    v_r := v_r - rec.w;
    exit when v_r < 0;
  end loop;
  new.card_tier := v_pick;
  return new;
end $$;
revoke all on function private.pick_card_tier() from public, anon, authenticated;

drop trigger if exists stamp_grants_pick_card on public.stamp_grants;
create trigger stamp_grants_pick_card before insert on public.stamp_grants
  for each row execute function private.pick_card_tier();

-- 기존 도장 채우기 (테스트 계정 23개, 화면에 보이던 카드 그대로)
update public.stamp_grants g set card_tier = v.tier
from (values
('d0dea447-b637-44b2-a318-63ae04426028'::uuid, 1, 3),
('d0dea447-b637-44b2-a318-63ae04426028'::uuid, 3, 2),
('d0dea447-b637-44b2-a318-63ae04426028'::uuid, 4, 5),
('d0dea447-b637-44b2-a318-63ae04426028'::uuid, 9, 10),
('d0dea447-b637-44b2-a318-63ae04426028'::uuid, 11, 8),
('a30e364f-d991-4d26-a9f6-6143eb5ed9d4'::uuid, 11, 10),
('d0dea447-b637-44b2-a318-63ae04426028'::uuid, 12, 11),
('d0dea447-b637-44b2-a318-63ae04426028'::uuid, 13, 6),
('d0dea447-b637-44b2-a318-63ae04426028'::uuid, 14, 4),
('d0dea447-b637-44b2-a318-63ae04426028'::uuid, 15, 12),
('3824dc00-a1ae-456a-9a19-d0bf5e644867'::uuid, 15, 3),
('dc5a885c-4162-4cf0-a8a4-3a54f15b0f98'::uuid, 15, 11),
('6bb53a2d-63d2-49a2-a64c-2dcf053ef789'::uuid, 15, 5),
('9fd41a87-d052-4378-9003-5fd379c5913c'::uuid, 15, 10),
('b54ef3e5-d946-4fd0-8261-854e57f6d64b'::uuid, 15, 4),
('7e882106-8803-48ee-904b-e0df1d19afe4'::uuid, 15, 2),
('28f35224-b68b-403c-bcbe-d1a23651c651'::uuid, 15, 7),
('545e6b73-e509-4cf7-81fe-7b28b662d895'::uuid, 15, 8),
('746737a1-b588-411c-84c0-93df7e678077'::uuid, 15, 6),
('d0dea447-b637-44b2-a318-63ae04426028'::uuid, 16, 10),
('d0dea447-b637-44b2-a318-63ae04426028'::uuid, 17, 7),
('d0dea447-b637-44b2-a318-63ae04426028'::uuid, 22, 12),
('d0dea447-b637-44b2-a318-63ae04426028'::uuid, 24, 12)
) as v(trip_id, city_id, tier)
where g.user_id = '1609d0ba-cbbb-419d-bc23-b558a4c6c4cf' and g.trip_id = v.trip_id and g.city_id = v.city_id and g.card_tier is null;
