/*
  0012 위치 도장 (3단계 0~1, 2026-11-14). 규칙은 CLAUDE.md 7장
  - cities : 도장을 줄 수 있는 도시 목록과 중심 좌표 (앱 lib/countries.ts 인기 도시와 같은 이름). 여행 도시는 (나라 코드, 이름) 이 같으면 이어짐
    직접 입력한 이름도 목록과 똑같으면 도장 대상. 목록에 없으면 도장 없음 (4단계 장소 검색 뒤)
  - radius_km : 기본 30km. 섬이나 넓은 지역만 크게 (확인 필요)
  - stamp_checkins : 여행 × 도시 한 번의 인증 (누가, 언제). stamp_grants : 사람 × 여행 × 도시 도장. 방문 횟수 = 그 도시 도장을 받은 여행 수
  - 받기는 claim_stamp() 로만 : 여행 기간(여행 시간대 날짜) 안, 그 여행 도시 반경 안, 위치 정확도 5km 이하. 한 명이 인증하면 그때 함께하는 사람 모두 받음
    나중에 들어온 사람은 다음 인증 때 같이 받음. 나간 사람 도장은 남김
  - collectible_rules : 지급 조건 숫자를 표로 (운영에서 바꿀 수 있게)
*/
create table public.cities (
  id           integer generated always as identity primary key,
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  name         text not null,
  lat          double precision not null check (lat between -90 and 90),
  lng          double precision not null check (lng between -180 and 180),
  radius_km    integer not null default 30 check (radius_km between 1 and 500),
  unique (country_code, name)
);
alter table public.cities enable row level security;
revoke all on public.cities from anon, authenticated;
grant select on public.cities to anon, authenticated;
create policy cities_read on public.cities for select to anon, authenticated using (true);

insert into public.cities (country_code, name, lat, lng, radius_km) values
  ('KR', '제주', 33.38, 126.55, 40),
  ('KR', '부산', 35.18, 129.08, 30),
  ('KR', '강릉', 37.75, 128.88, 30),
  ('KR', '경주', 35.86, 129.22, 30),
  ('KR', '여수', 34.76, 127.66, 30),
  ('KR', '속초', 38.21, 128.59, 30),
  ('KR', '전주', 35.82, 127.15, 30),
  ('KR', '서울', 37.57, 126.98, 30),
  ('JP', '도쿄', 35.68, 139.76, 30),
  ('JP', '오사카', 34.69, 135.50, 30),
  ('JP', '후쿠오카', 33.59, 130.40, 30),
  ('JP', '삿포로', 43.06, 141.35, 30),
  ('JP', '교토', 35.01, 135.77, 30),
  ('JP', '오키나와', 26.33, 127.80, 60),
  ('JP', '나고야', 35.18, 136.91, 30),
  ('JP', '오타루', 43.19, 141.00, 30),
  ('TW', '타이베이', 25.03, 121.57, 30),
  ('TW', '가오슝', 22.63, 120.30, 30),
  ('TW', '타이중', 24.15, 120.67, 30),
  ('TW', '타이난', 22.99, 120.21, 30),
  ('TW', '지우펀', 25.11, 121.84, 30),
  ('HK', '홍콩', 22.32, 114.17, 30),
  ('MO', '마카오', 22.19, 113.54, 30),
  ('CN', '상하이', 31.23, 121.47, 30),
  ('CN', '베이징', 39.90, 116.41, 30),
  ('CN', '칭다오', 36.07, 120.38, 30),
  ('CN', '청두', 30.57, 104.07, 30),
  ('CN', '장자제', 29.12, 110.48, 30),
  ('CN', '하얼빈', 45.80, 126.53, 30),
  ('MN', '울란바토르', 47.92, 106.92, 30),
  ('MN', '고비 사막', 43.50, 104.00, 250),
  ('MN', '테를지', 47.98, 107.45, 30),
  ('TH', '방콕', 13.76, 100.50, 30),
  ('TH', '치앙마이', 18.79, 98.99, 30),
  ('TH', '푸껫', 7.88, 98.39, 30),
  ('TH', '파타야', 12.93, 100.88, 30),
  ('TH', '끄라비', 8.09, 98.91, 30),
  ('VN', '다낭', 16.05, 108.22, 30),
  ('VN', '나트랑', 12.24, 109.19, 30),
  ('VN', '호찌민', 10.78, 106.70, 30),
  ('VN', '하노이', 21.03, 105.85, 30),
  ('VN', '푸꾸옥', 10.29, 103.98, 30),
  ('VN', '호이안', 15.88, 108.33, 30),
  ('VN', '달랏', 11.94, 108.46, 30),
  ('PH', '세부', 10.32, 123.89, 30),
  ('PH', '보라카이', 11.97, 121.92, 30),
  ('PH', '마닐라', 14.60, 120.98, 30),
  ('PH', '보홀', 9.85, 124.14, 30),
  ('SG', '싱가포르', 1.35, 103.82, 30),
  ('MY', '코타키나발루', 5.98, 116.07, 30),
  ('MY', '쿠알라룸푸르', 3.14, 101.69, 30),
  ('MY', '랑카위', 6.35, 99.80, 30),
  ('MY', '페낭', 5.41, 100.33, 30),
  ('ID', '발리', -8.41, 115.19, 60),
  ('ID', '자카르타', -6.21, 106.85, 30),
  ('ID', '롬복', -8.65, 116.32, 50),
  ('LA', '비엔티안', 17.97, 102.63, 30),
  ('LA', '루앙프라방', 19.89, 102.13, 30),
  ('LA', '방비엥', 18.92, 102.45, 30),
  ('KH', '시엠레아프', 13.36, 103.86, 30),
  ('KH', '프놈펜', 11.56, 104.92, 30),
  ('IN', '뉴델리', 28.61, 77.21, 30),
  ('IN', '뭄바이', 19.08, 72.88, 30),
  ('IN', '아그라', 27.18, 78.01, 30),
  ('IN', '자이푸르', 26.91, 75.79, 30),
  ('AE', '두바이', 25.20, 55.27, 30),
  ('AE', '아부다비', 24.45, 54.38, 30),
  ('TR', '이스탄불', 41.01, 28.98, 30),
  ('TR', '카파도키아', 38.64, 34.83, 30),
  ('TR', '안탈리아', 36.90, 30.71, 30),
  ('GU', '괌', 13.44, 144.79, 30),
  ('MP', '사이판', 15.18, 145.75, 30),
  ('US', '뉴욕', 40.71, -74.01, 30),
  ('US', '로스앤젤레스', 34.05, -118.24, 30),
  ('US', '샌프란시스코', 37.77, -122.42, 30),
  ('US', '라스베이거스', 36.17, -115.14, 30),
  ('US', '시애틀', 47.61, -122.33, 30),
  ('US', '호놀룰루', 21.31, -157.86, 30),
  ('US', '마우이', 20.80, -156.33, 40),
  ('CA', '밴쿠버', 49.28, -123.12, 30),
  ('CA', '토론토', 43.65, -79.38, 30),
  ('CA', '퀘벡', 46.81, -71.21, 30),
  ('CA', '밴프', 51.18, -115.57, 30),
  ('AU', '시드니', -33.87, 151.21, 30),
  ('AU', '멜버른', -37.81, 144.96, 30),
  ('AU', '골드코스트', -28.02, 153.40, 30),
  ('AU', '브리즈번', -27.47, 153.03, 30),
  ('NZ', '오클랜드', -36.85, 174.76, 30),
  ('NZ', '퀸스타운', -45.03, 168.66, 30),
  ('NZ', '크라이스트처치', -43.53, 172.64, 30),
  ('GB', '런던', 51.51, -0.13, 30),
  ('GB', '에든버러', 55.95, -3.19, 30),
  ('GB', '맨체스터', 53.48, -2.24, 30),
  ('FR', '파리', 48.86, 2.35, 30),
  ('FR', '니스', 43.70, 7.27, 30),
  ('FR', '리옹', 45.76, 4.84, 30),
  ('FR', '마르세유', 43.30, 5.37, 30),
  ('IT', '로마', 41.90, 12.50, 30),
  ('IT', '피렌체', 43.77, 11.26, 30),
  ('IT', '베네치아', 45.44, 12.32, 30),
  ('IT', '밀라노', 45.46, 9.19, 30),
  ('IT', '나폴리', 40.85, 14.27, 30),
  ('ES', '바르셀로나', 41.39, 2.17, 30),
  ('ES', '마드리드', 40.42, -3.70, 30),
  ('ES', '세비야', 37.39, -5.98, 30),
  ('ES', '그라나다', 37.18, -3.60, 30),
  ('PT', '리스본', 38.72, -9.14, 30),
  ('PT', '포르투', 41.16, -8.63, 30),
  ('DE', '뮌헨', 48.14, 11.58, 30),
  ('DE', '베를린', 52.52, 13.40, 30),
  ('DE', '프랑크푸르트', 50.11, 8.68, 30),
  ('CH', '인터라켄', 46.69, 7.86, 30),
  ('CH', '취리히', 47.38, 8.54, 30),
  ('CH', '루체른', 47.05, 8.31, 30),
  ('CH', '체르마트', 46.02, 7.75, 30),
  ('AT', '빈', 48.21, 16.37, 30),
  ('AT', '잘츠부르크', 47.81, 13.04, 30),
  ('AT', '할슈타트', 47.56, 13.65, 30),
  ('CZ', '프라하', 50.08, 14.44, 30),
  ('CZ', '체스키크룸로프', 48.81, 14.32, 30),
  ('NL', '암스테르담', 52.37, 4.90, 30),
  ('GR', '아테네', 37.98, 23.73, 30),
  ('GR', '산토리니', 36.39, 25.46, 30);

create table public.collectible_rules (
  key    text primary key,
  params jsonb not null,
  note   text
);
alter table public.collectible_rules enable row level security;
revoke all on public.collectible_rules from anon, authenticated;
insert into public.collectible_rules (key, params, note) values
  ('stamp_location', '{"max_accuracy_m": 5000}', '위치 도장 : 위치 정확도가 이 값(m)보다 나쁘면 거절. 반경은 cities.radius_km');

create table public.stamp_checkins (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references public.trips(id) on delete cascade,
  city_id     integer not null references public.cities(id),
  verified_by uuid default auth.uid() references auth.users(id) on delete set null,
  local_date  date not null,
  created_at  timestamptz not null default now(),
  unique (trip_id, city_id)
);
create table public.stamp_grants (
  user_id    uuid not null references auth.users(id) on delete cascade,
  trip_id    uuid not null references public.trips(id) on delete cascade,
  city_id    integer not null references public.cities(id),
  granted_at timestamptz not null default now(),
  primary key (user_id, trip_id, city_id)
);
create index stamp_grants_user on public.stamp_grants (user_id, city_id);

alter table public.stamp_checkins enable row level security;
alter table public.stamp_grants enable row level security;
revoke all on public.stamp_checkins, public.stamp_grants from anon, authenticated;
grant select on public.stamp_checkins, public.stamp_grants to authenticated;
create policy stamp_checkins_read on public.stamp_checkins for select to authenticated using (private.can_view_trip(trip_id));
create policy stamp_grants_read on public.stamp_grants for select to authenticated using (user_id = (select auth.uid()));

-- 두 점 사이 거리 (km, 지구 반지름 6371)
create function private.km_between(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns double precision language sql immutable set search_path = '' as $$
  select 2 * 6371 * asin(least(1, sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2))))
$$;

/*
  결과 status : new(새로 받음) / again(이 도시 다른 여행에 이어 또 받음, visits 증가) / already(이 여행에서 이미 받음)
  거절은 오류 : not_member, trip_removed, not_in_dates, low_accuracy, bad_location, no_city(여행 도시 중 도장 목록에 있는 곳 없음), too_far
*/
create function public.claim_stamp(p_trip uuid, p_lat double precision, p_lng double precision, p_accuracy double precision)
returns table (status text, city_id integer, city_name text, country_code text, visits integer, verified_by_me boolean)
language plpgsql security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  v_me uuid := auth.uid(); v_trip public.trips; v_today date; v_max double precision;
  v_city record; v_check public.stamp_checkins; v_new boolean; v_visits integer;
begin
  if v_me is null or not private.can_view_trip(p_trip) then raise exception 'not_member' using errcode = '42501'; end if;
  select * into v_trip from public.trips t where t.id = p_trip;
  if v_trip.removed_at is not null then raise exception 'trip_removed' using errcode = '22023'; end if;
  v_today := (now() at time zone v_trip.time_zone)::date;
  if v_today < v_trip.start_date or v_today > v_trip.end_date then raise exception 'not_in_dates' using errcode = '22023'; end if;
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'bad_location' using errcode = '22023'; end if;
  select coalesce((r.params ->> 'max_accuracy_m')::double precision, 5000) into v_max from public.collectible_rules r where r.key = 'stamp_location';
  if p_accuracy is null or p_accuracy > coalesce(v_max, 5000) then raise exception 'low_accuracy' using errcode = '22023'; end if;

  select c.id, c.name, c.country_code, c.radius_km, private.km_between(p_lat, p_lng, c.lat, c.lng) as dist into v_city
  from public.trip_cities tc join public.cities c on c.country_code = tc.country_code and c.name = tc.name
  where tc.trip_id = p_trip
  order by private.km_between(p_lat, p_lng, c.lat, c.lng) / c.radius_km limit 1;
  if v_city is null or v_city.id is null then raise exception 'no_city' using errcode = '22023'; end if;
  if v_city.dist > v_city.radius_km then raise exception 'too_far' using errcode = '22023'; end if;

  insert into public.stamp_checkins (trip_id, city_id, verified_by, local_date) values (p_trip, v_city.id, v_me, v_today)
  on conflict (trip_id, city_id) do nothing;
  select * into v_check from public.stamp_checkins s where s.trip_id = p_trip and s.city_id = v_city.id;

  v_new := not exists (select 1 from public.stamp_grants g where g.user_id = v_me and g.trip_id = p_trip and g.city_id = v_city.id);
  insert into public.stamp_grants (user_id, trip_id, city_id)
  select m.user_id, p_trip, v_city.id from public.trip_members m
  where m.trip_id = p_trip and m.removed_at is null and m.user_id is not null
  on conflict do nothing;

  select count(*)::int into v_visits from public.stamp_grants g where g.user_id = v_me and g.city_id = v_city.id;
  return query select case when not v_new then 'already' when v_visits > 1 then 'again' else 'new' end,
    v_city.id, v_city.name, v_city.country_code, v_visits, v_check.verified_by = v_me;
end $$;
revoke all on function public.claim_stamp(uuid, double precision, double precision, double precision) from public, anon;
grant execute on function public.claim_stamp(uuid, double precision, double precision, double precision) to authenticated;
revoke all on function private.km_between(double precision, double precision, double precision, double precision) from public, anon;
