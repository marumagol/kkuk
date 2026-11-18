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
  { code: "US", name: "미국", tz: "America/Los_Angeles" },
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

/* 나라 기본 통화 (장소의 예상 비용). 없으면 원화 */
const CURRENCY: Record<string, string> = {
  KR: "KRW", JP: "JPY", TW: "TWD", HK: "HKD", MO: "MOP", CN: "CNY", MN: "MNT", TH: "THB", VN: "VND", PH: "PHP",
  SG: "SGD", MY: "MYR", ID: "IDR", LA: "LAK", KH: "USD", IN: "INR", AE: "AED", TR: "TRY", GU: "USD", MP: "USD",
  US: "USD", CA: "CAD", AU: "AUD", NZ: "NZD", GB: "GBP", FR: "EUR", IT: "EUR", ES: "EUR", PT: "EUR", DE: "EUR",
  CH: "CHF", AT: "EUR", CZ: "CZK", NL: "EUR", GR: "EUR",
};
export const currencyOf = (iso?: string | null) => (iso && CURRENCY[iso]) || "KRW";
/* 통화 이름 (칩, 고르기 칸) */
const CUR_NAMES: Record<string, string> = {
  KRW: "원", JPY: "엔", USD: "달러", EUR: "유로", TWD: "대만 달러", CNY: "위안", THB: "바트", VND: "동", HKD: "홍콩 달러", GBP: "파운드",
  MOP: "파타카", MNT: "투그릭", PHP: "페소", SGD: "싱가포르 달러", MYR: "링깃", IDR: "루피아", LAK: "킵", INR: "루피", AED: "디르함", TRY: "리라",
  CAD: "캐나다 달러", AUD: "호주 달러", NZD: "뉴질랜드 달러", CHF: "스위스 프랑", CZK: "코루나",
};
export const curName = (c: string) => CUR_NAMES[c] ?? c;
/*
  통화 고르기 칸에서 고른 뒤 화면이 위로 튀지 않게 (2026-11-17 마루님 제보) : 고르기 전 스크롤 자리(창 + 감싼 스크롤 상자)를 기억했다가
  다시 그린 뒤 되돌리고, 칸의 초점을 뺀다 (휴대폰이 초점 칸으로 다시 스크롤하는 것 막기)
*/
export function keepScroll(el: HTMLElement) {
  const boxes: { box: HTMLElement; top: number }[] = [];
  for (let n = el.parentElement; n; n = n.parentElement) if (n.scrollHeight > n.clientHeight + 1) boxes.push({ box: n, top: n.scrollTop });
  const y = window.scrollY;
  el.blur();
  const back = () => { boxes.forEach(({ box, top }) => { box.scrollTop = top; }); if (Math.abs(window.scrollY - y) > 1) window.scrollTo(0, y); };
  requestAnimationFrame(() => { back(); requestAnimationFrame(back); });
  setTimeout(back, 250);
}
/* [기타] 에서 고를 수 있는 모든 통화 (이름 순) */
export const ALL_CURRENCIES = [...new Set([...Object.keys(CUR_NAMES), ...Object.values(CURRENCY)])].sort((a, b) => curName(a).localeCompare(curName(b), "ko"));
/*
  여행 통화 칩 순서 (2026-11-17 마루님 추천안) : 여행 도시 통화(방문 순서) → 원 → 달러. 지금 값이 목록에 없으면 앞에 넣는다
  화면에는 앞 4개만 칩으로, 나머지는 [기타]
*/
export const currencyOptions = (trip: string[], current?: string) => [...new Set([...(current && ![...trip, "KRW", "USD"].includes(current) ? [current] : []), ...trip, "KRW", "USD"])];
/* 통화별 소수 자리 (엔, 원은 0, 달러는 2). DB 에는 최소 단위 정수로 저장 */
export const decimalsOf = (cur: string) => {
  try { return new Intl.NumberFormat("ko-KR", { style: "currency", currency: cur }).resolvedOptions().maximumFractionDigits ?? 0; }
  catch { return 0; }
};
export const formatMoney = (minor: number, cur: string) => {
  const d = decimalsOf(cur);
  if (cur === "KRW") return `${Math.round(minor).toLocaleString("ko-KR")}원`; // 원화는 "1,000원" (2026-11-17 경비 화면 정리)
  try { return new Intl.NumberFormat("ko-KR", { style: "currency", currency: cur, maximumFractionDigits: d }).format(minor / 10 ** d); }
  catch { return `${minor} ${cur}`; }
};

/*
  나라를 고르면 보여 주는 인기 도시 칩 (여행 만들기, 여행 정보 수정)
  앱 안 고정 목록. 우리가 정한 대표 도시이며 순서는 많이 가는 곳 위주 (확인 필요)
  장소 검색(4단계)이 붙으면 그쪽 데이터로 바꿀 수 있다
*/
export const POPULAR_CITIES: Record<string, string[]> = {
  KR: ["제주", "부산", "강릉", "경주", "여수", "속초", "전주", "서울"],
  JP: ["도쿄", "오사카", "후쿠오카", "삿포로", "교토", "오키나와", "나고야", "오타루"],
  TW: ["타이베이", "가오슝", "타이중", "타이난", "지우펀"],
  HK: ["홍콩"],
  MO: ["마카오"],
  CN: ["상하이", "베이징", "칭다오", "청두", "장자제", "하얼빈"],
  MN: ["울란바토르", "고비 사막", "테를지"],
  TH: ["방콕", "치앙마이", "푸껫", "파타야", "끄라비"],
  VN: ["다낭", "나트랑", "호찌민", "하노이", "푸꾸옥", "호이안", "달랏"],
  PH: ["세부", "보라카이", "마닐라", "보홀"],
  SG: ["싱가포르"],
  MY: ["코타키나발루", "쿠알라룸푸르", "랑카위", "페낭"],
  ID: ["발리", "자카르타", "롬복"],
  LA: ["비엔티안", "루앙프라방", "방비엥"],
  KH: ["시엠레아프", "프놈펜"],
  IN: ["뉴델리", "뭄바이", "아그라", "자이푸르"],
  AE: ["두바이", "아부다비"],
  TR: ["이스탄불", "카파도키아", "안탈리아"],
  GU: ["괌"],
  MP: ["사이판"],
  US: ["뉴욕", "로스앤젤레스", "샌프란시스코", "라스베이거스", "시애틀"],
  "US-HI": ["호놀룰루", "마우이"],
  CA: ["밴쿠버", "토론토", "퀘벡", "밴프"],
  AU: ["시드니", "멜버른", "골드코스트", "브리즈번"],
  NZ: ["오클랜드", "퀸스타운", "크라이스트처치"],
  GB: ["런던", "에든버러", "맨체스터"],
  FR: ["파리", "니스", "리옹", "마르세유"],
  IT: ["로마", "피렌체", "베네치아", "밀라노", "나폴리"],
  ES: ["바르셀로나", "마드리드", "세비야", "그라나다"],
  PT: ["리스본", "포르투"],
  DE: ["뮌헨", "베를린", "프랑크푸르트"],
  CH: ["인터라켄", "취리히", "루체른", "체르마트"],
  AT: ["빈", "잘츠부르크", "할슈타트"],
  CZ: ["프라하", "체스키크룸로프"],
  NL: ["암스테르담"],
  GR: ["아테네", "산토리니"],
};

/* 국기 그림이 있는 나라 (public/flags, country-flag-icons MIT). 인기 나라는 나라 고르기 첫 화면에 보이는 순서 */
export const FLAG_CODES = new Set("KR JP TW HK MO CN MN TH VN PH SG MY ID LA KH IN AE TR GU MP US CA AU NZ GB FR IT ES PT DE CH AT CZ NL GR".split(" "));
export const POPULAR_COUNTRIES = ["JP", "VN", "TH", "TW", "PH", "KR", "US", "GU", "CN", "FR", "IT", "ES"];
export const flagOf = (code?: string | null) => (code && FLAG_CODES.has(code.slice(0, 2)) ? `/flags/${code.slice(0, 2)}.svg` : null);
/* 가로로 긴 국기 (3:2, 도장 상세 창 0.92.5) */
export const flagWideOf = (code?: string | null) => (code && FLAG_CODES.has(code.slice(0, 2)) ? `/flags/3x2/${code.slice(0, 2)}.svg` : null);
/* 직접 입력한 나라에 올린 아이콘 (저장소 country-icons, 공개 읽기) */
export const ICON_PATH = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(png|jpg|webp)$/;
export const iconUrl = (path?: string | null) => {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return path && base && ICON_PATH.test(path) ? `${base}/storage/v1/object/public/country-icons/${path}` : null;
};
export const MAX_COUNTRY_NAME = 20;

/* 나라 대표 좌표 (여행 지도 핀, 2026-11-15). 도시 좌표를 모를 때만 쓴다. 대개 수도나 많이 가는 도시 */
export const COUNTRY_CENTER: Record<string, [number, number]> = {
  KR: [37.57, 126.98], JP: [35.68, 139.69], TW: [25.03, 121.57], HK: [22.32, 114.17], MO: [22.2, 113.55], CN: [39.9, 116.4],
  MN: [47.92, 106.92], TH: [13.76, 100.5], VN: [16.05, 108.2], PH: [14.6, 120.98], SG: [1.35, 103.82], MY: [3.14, 101.69],
  ID: [-8.65, 115.22], LA: [17.97, 102.63], KH: [13.36, 103.86], IN: [28.61, 77.21], AE: [25.2, 55.27], TR: [41.01, 28.98],
  GU: [13.44, 144.79], MP: [15.18, 145.75], US: [34.05, -118.24], CA: [49.28, -123.12], AU: [-33.87, 151.21], NZ: [-36.85, 174.76],
  GB: [51.51, -0.13], FR: [48.86, 2.35], IT: [41.9, 12.5], ES: [41.39, 2.17], PT: [38.72, -9.14], DE: [52.52, 13.4],
  CH: [47.38, 8.54], AT: [48.21, 16.37], CZ: [50.08, 14.44], NL: [52.37, 4.9], GR: [37.98, 23.73],
};
export const countryNameOf = (code?: string | null) => COUNTRIES.find((c) => c.code === code)?.name;
