/*
  0057 도장 도시 추가 : 대구, 울산 (2026-11-26 마루님 "대구, 울산 추가해주고")
  - 도장 그림은 lib/stamp-art.ts (대구 계산성당, 울산 고래 꼬리), 인기 도시 칩은 lib/countries.ts
*/
insert into public.cities (country_code, name, lat, lng, radius_km) values
  ('KR', '대구', 35.87, 128.60, 30),
  ('KR', '울산', 35.54, 129.31, 30)
on conflict (country_code, name) do nothing;
