/*
  여행 만들기에서 고르는 나라 (앱 안 고정 목록, 기획 02 확인 필요 항목의 추천안)
  tz : 여행 시간대 기본값. 첫 도시의 나라로 정한다. 시간대가 여러 개인 나라는 많이 가는 곳 기준 (확인 필요)
  - 미국 : 서부(로스앤젤레스), 하와이와 괌, 사이판은 따로 둠
  - 호주 : 시드니, 캐나다 : 밴쿠버, 인도네시아 : 발리
*/
export type Country = { code: string; name: string; tz: string };

export const COUNTRIES: Country[] = [
  { code: "KR", name: "대한민국", tz: "Asia/Seoul" },
  { code: "JP", name: "일본", tz: "Asia/Tokyo" },
  { code: "TW", name: "대만", tz: "Asia/Taipei" },
  { code: "HK", name: "홍콩", tz: "Asia/Hong_Kong" },
  { code: "MO", name: "마카오", tz: "Asia/Macau" },
  { code: "CN", name: "중국", tz: "Asia/Shanghai" },
  { code: "MN", name: "몽골", tz: "Asia/Ulaanbaatar" },
  { code: "TH", name: "태국", tz: "Asia/Bangkok" },
  { code: "VN", name: "베트남", tz: "Asia/Ho_Chi_Minh" },
  { code: "PH", name: "필리핀", tz: "Asia/Manila" },
  { code: "SG", name: "싱가포르", tz: "Asia/Singapore" },
  { code: "MY", name: "말레이시아", tz: "Asia/Kuala_Lumpur" },
  { code: "ID", name: "인도네시아", tz: "Asia/Makassar" },
  { code: "LA", name: "라오스", tz: "Asia/Vientiane" },
  { code: "KH", name: "캄보디아", tz: "Asia/Phnom_Penh" },
  { code: "IN", name: "인도", tz: "Asia/Kolkata" },
  { code: "AE", name: "아랍에미리트", tz: "Asia/Dubai" },
  { code: "TR", name: "튀르키예", tz: "Europe/Istanbul" },
  { code: "GU", name: "괌", tz: "Pacific/Guam" },
  { code: "MP", name: "사이판", tz: "Pacific/Saipan" },
  { code: "US", name: "미국 (하와이 말고)", tz: "America/Los_Angeles" },
  { code: "US-HI", name: "미국 하와이", tz: "Pacific/Honolulu" },
  { code: "CA", name: "캐나다", tz: "America/Vancouver" },
  { code: "AU", name: "호주", tz: "Australia/Sydney" },
  { code: "NZ", name: "뉴질랜드", tz: "Pacific/Auckland" },
  { code: "GB", name: "영국", tz: "Europe/London" },
  { code: "FR", name: "프랑스", tz: "Europe/Paris" },
  { code: "IT", name: "이탈리아", tz: "Europe/Rome" },
  { code: "ES", name: "스페인", tz: "Europe/Madrid" },
  { code: "PT", name: "포르투갈", tz: "Europe/Lisbon" },
  { code: "DE", name: "독일", tz: "Europe/Berlin" },
  { code: "CH", name: "스위스", tz: "Europe/Zurich" },
  { code: "AT", name: "오스트리아", tz: "Europe/Vienna" },
  { code: "CZ", name: "체코", tz: "Europe/Prague" },
  { code: "NL", name: "네덜란드", tz: "Europe/Amsterdam" },
  { code: "GR", name: "그리스", tz: "Europe/Athens" },
  { code: "ETC", name: "그 밖의 나라 (한국 시간 기준)", tz: "Asia/Seoul" },
];

export const countryOf = (code: string) => COUNTRIES.find((c) => c.code === code);
/* DB 에는 ISO 두 글자만 저장 (US-HI → US, ETC → 비움) */
export const isoOf = (code: string) => (code === "ETC" ? null : code.slice(0, 2));
