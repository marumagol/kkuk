/*
  대표 카드 (2026-11-20 마루님 "상세 모달에 대표 카드로 설정, 설정된 카드가 리스트에 노출")
  - 도시마다 내가 고른 카드 테마 번호(tier) 하나. 없으면 화면이 가장 최근 카드를 보여 준다
  - 읽기는 내 것만, 쓰기는 set_stamp_featured 로만 (그 도시 도장을 받은 사람만)
*/
create table public.stamp_featured (
  user_id uuid not null references auth.users(id) on delete cascade,
  city_id integer not null references public.cities(id) on delete cascade,
  tier smallint not null check (tier between 1 and 20),
  updated_at timestamptz not null default now(),
  primary key (user_id, city_id)
);
alter table public.stamp_featured enable row level security;
create policy stamp_featured_select_own on public.stamp_featured for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.stamp_featured from anon;
revoke insert, update, delete on public.stamp_featured from authenticated;

create or replace function public.set_stamp_featured(p_city integer, p_tier integer)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_me uuid := auth.uid();
begin
  if v_me is null then raise exception 'not_signed_in' using errcode = '42501'; end if;
  if p_tier is null or p_tier not between 1 and 20 then raise exception 'bad_tier' using errcode = '22023'; end if;
  if not exists (select 1 from public.stamp_grants g where g.user_id = v_me and g.city_id = p_city) then
    raise exception 'no_stamp' using errcode = '42501';
  end if;
  insert into public.stamp_featured (user_id, city_id, tier) values (v_me, p_city, p_tier)
  on conflict (user_id, city_id) do update set tier = excluded.tier, updated_at = now();
end $$;
revoke all on function public.set_stamp_featured(integer, integer) from public, anon;
grant execute on function public.set_stamp_featured(integer, integer) to authenticated;
