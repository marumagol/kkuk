/*
  분류별 맞춤 칸 (2026-11-15 여행 메뉴 개편, migration 0030 itinerary_items.details)
  - 이동 : 수단(비행기/기차/버스/배/차)을 고르면 그에 맞는 칸. 비행기는 편명, 출발/도착 공항, 출발/도착 시간 (출발 시간 2026-11-16), 좌석, 예약번호
  - 숙소 : 예약번호, 체크인/체크아웃 시간, 예약한 곳, 연락처
  - 식사 : 예약번호, 인원, 먹을 메뉴 / 관광 : 예약·입장권 번호, 운영 시간 / 쇼핑 : 살 것
  저장할 때는 고른 분류(와 수단)의 칸만 남긴다. 공개 공유 링크에는 나가지 않는다
*/
export type Details = Record<string, string>;
export type FieldDef = { key: string; label: string; placeholder?: string; type?: "text" | "time"; half?: boolean; max?: number; unit?: string /* 숫자만 받고 뒤에 단위를 붙인다 (예 : 명) */ };

export const MODES = [
  { code: "flight", label: "비행기" }, { code: "train", label: "기차" }, { code: "bus", label: "버스" },
  { code: "ship", label: "배" }, { code: "car", label: "차" },
] as const;

const COMMON_MOVE: FieldDef[] = [
  { key: "from", label: "출발", placeholder: "예 : 인천", half: true },
  { key: "to", label: "도착", placeholder: "예 : 신치토세", half: true },
  { key: "depart", label: "출발 시간", type: "time", half: true },
  { key: "arrive", label: "도착 시간", type: "time", half: true },
];

/* 이동의 출발/도착 시간은 맞춤 칸 묶음이 아니라 "시간" 자리에 보인다 (2026-11-16 마루님). 출발 시간 = 장소 시간(정렬 기준) */
export const MOVE_TIME_KEYS = ["depart", "arrive"];
/*
  이동의 출발지/도착지는 맞춤 칸 묶음이 아니라 "장소" 카드에서 각각 검색해 고른다 (2026-11-16 마루님 "출발과 도착을 나눠서")
  고르면 이름(from/to)과 함께 위치(from_pos/to_pos = "위도,경도"), 구글 장소 id(from_id/to_id)를 details 에 남긴다. DB 칸은 늘리지 않음
  일정의 지도 위치(itinerary_items.lat/lng)는 출발지(없으면 도착지). 지도에는 도착지 점이 하나 더 찍힌다
*/
export const MOVE_PLACE_KEYS = ["from", "to"];
const POS_RE = /^-?\d{1,2}(\.\d{1,7})?,-?\d{1,3}(\.\d{1,7})?$/;
const PID_RE = /^[A-Za-z0-9_-]{10,255}$/;
export function parsePos(v?: string | null): { lat: number; lng: number } | null {
  if (!v || !POS_RE.test(v)) return null;
  const [lat, lng] = v.split(",").map(Number);
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
}
export const posText = (lat: number, lng: number) => `${lat.toFixed(6)},${lng.toFixed(6)}`;
const MOVE_TIMES: FieldDef[] = [
  { key: "from", label: "출발지", half: true },
  { key: "to", label: "도착지", half: true },
  { key: "depart", label: "출발 시간", type: "time", half: true },
  { key: "arrive", label: "도착 시간", type: "time", half: true },
];

export function fieldsOf(category: string, mode?: string): FieldDef[] {
  switch (category) {
    case "transport":
      if (mode === "flight") return [
        { key: "code", label: "편명", placeholder: "예 : KE765", half: true, max: 20 },
        { key: "seat", label: "좌석", placeholder: "예 : 32A", half: true, max: 20 },
        { key: "from", label: "출발 공항", placeholder: "예 : 인천", half: true },
        { key: "to", label: "도착 공항", placeholder: "예 : 신치토세", half: true },
        { key: "depart", label: "출발 시간", type: "time", half: true },
        { key: "arrive", label: "도착 시간", type: "time", half: true },
        { key: "booking", label: "예약번호", placeholder: "예 : ABC123", max: 40 },
      ];
      if (mode === "train") return [
        { key: "code", label: "열차", placeholder: "예 : 쾌속 에어포트 150호", max: 40 },
        ...COMMON_MOVE, { key: "seat", label: "좌석", placeholder: "예 : 3호차 12A", half: true, max: 20 },
        { key: "booking", label: "예약번호", max: 40 },
      ];
      if (mode) return [...COMMON_MOVE, { key: "booking", label: "예약번호", half: true, max: 40 }];
      return MOVE_TIMES; // 수단을 안 골라도 출발/도착 시간은 남긴다
    case "stay": return [ // 예약한 곳, 연락처를 예약번호 위로 (2026-11-16 마루님)
      { key: "site", label: "예약한 곳", placeholder: "예 : 아고다", half: true, max: 30 },
      { key: "phone", label: "연락처", placeholder: "예 : +81 11-000-0000", half: true, max: 30 },
      { key: "booking", label: "예약번호", placeholder: "예 : 1234567890", max: 40 },
      { key: "checkin", label: "체크인", type: "time", half: true },
      { key: "checkout", label: "체크아웃", type: "time", half: true },
    ];
    case "food": return [ // 먹을 메뉴 → 예약번호, 인원 (2026-11-16 마루님)
      { key: "menu", label: "먹을 메뉴", placeholder: "예 : 징기스칸, 수프카레", max: 60 },
      { key: "booking", label: "예약번호", half: true, max: 40 },
      { key: "people", label: "인원", placeholder: "예 : 2", half: true, max: 10, unit: "명" },
    ];
    case "sight": return [
      { key: "booking", label: "예약/입장권 번호", half: true, max: 40 },
      { key: "hours", label: "운영 시간", placeholder: "예 : 9:00~17:00", half: true, max: 30 },
    ];
    case "shopping": return [{ key: "list", label: "살 것", placeholder: "예 : 로이스 초콜릿, 르타오", max: 100 }];
  }
  return [];
}

/* 저장 전에 고른 분류의 칸만, 길이를 잘라서 남긴다. 잘못된 값이면 null */
export function cleanDetails(category: string, raw: unknown): Details | null {
  const src = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const out: Details = {};
  let mode: string | undefined;
  if (category === "transport" && src.mode != null && src.mode !== "") {
    if (!MODES.some((m) => m.code === src.mode)) return null;
    mode = String(src.mode);
    out.mode = mode;
  }
  for (const f of fieldsOf(category, mode)) {
    const v = String(src[f.key] ?? "").trim();
    if (!v) continue;
    if (f.type === "time" && !/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) return null;
    if ([...v].length > (f.max ?? 60)) return null;
    out[f.key] = v;
  }
  if (category === "transport") {
    for (const k of ["from", "to"]) {
      if (!out[k]) continue; // 이름이 없으면 위치도 버린다
      const pos = String(src[`${k}_pos`] ?? ""), id = String(src[`${k}_id`] ?? "");
      if (parsePos(pos)) { out[`${k}_pos`] = pos; if (PID_RE.test(id)) out[`${k}_id`] = id; }
    }
  }
  return out;
}

/* 일정 카드에 보이는 한 줄. 예 : "비행기 KE765 · 인천 → 신치토세 · 아고다 예약" */
/*
  이동의 보이는 이름 (2026-11-16 마루님 "인천공항이랑 신치토세가 안 나와") : 출발지와 도착지가 있으면 "출발 → 도착".
  이름을 직접 다르게 적은 경우(예 : 공항 리무진 버스 → 스스키노)만 그 이름. 예전 데이터는 다시 저장하지 않아도 된다
*/
export function moveTitle(category: string, title: string, d?: Details | null): { title: string; route: boolean } {
  const from = d?.from?.trim(), to = d?.to?.trim(), t = title.trim();
  if (category !== "transport" || !from || !to) return { title, route: false };
  const auto = `${from} → ${to}`;
  return !t || t === from || t === to || t === auto ? { title: auto, route: true } : { title, route: false };
}

export function detailLine(category: string, d?: Details | null, skipRoute = false): string {
  if (!d) return "";
  const route = !skipRoute && (d.from || d.to) ? `${d.from ?? ""} → ${d.to ?? ""}`.trim() : "";
  const book = d.site ? `${d.site} 예약` : ""; // 목록에는 예약번호 대신 예약한 곳 (2026-11-16 마루님). 없으면 비움
  const parts: string[] = [];
  if (category === "transport") {
    const mode = MODES.find((m) => m.code === d.mode)?.label;
    parts.push([mode, d.code].filter(Boolean).join(" "), route, d.arrive ? `${d.arrive} 도착` : "", /* 출발 시간은 카드 왼쪽 시간으로 보인다 */ d.seat ? `좌석 ${d.seat}` : "", book);
  } else if (category === "stay") {
    parts.push(d.checkin ? `체크인 ${d.checkin}` : "", d.checkout ? `체크아웃 ${d.checkout}` : "", book);
  } else if (category === "food") {
    parts.push(book, d.people ?? "", d.menu ?? "");
  } else if (category === "sight") {
    parts.push(d.hours ?? "", book);
  } else if (category === "shopping") {
    parts.push(d.list ? `살 것 ${d.list}` : "");
  }
  return parts.filter(Boolean).join(" · ");
}

/*
  구글 장소 종류로 분류 고르기 (2026-11-16 마루님 "검색으로 고르면 분류 자동") : 맞는 게 없으면 null (분류는 그대로)
  이동이면 수단도 같이 (공항 = 비행기, 역 = 기차, 버스 터미널 = 버스, 항구 = 배)
*/
export function guessCategory(types?: string[]): { category: string; mode?: string } | null {
  if (!types?.length) return null;
  const has = (re: RegExp) => types.some((t) => re.test(t));
  if (has(/^airport$|^international_airport$/)) return { category: "transport", mode: "flight" };
  if (has(/^(train_station|subway_station|light_rail_station)$/)) return { category: "transport", mode: "train" };
  if (has(/^bus_station$/)) return { category: "transport", mode: "bus" };
  if (has(/^ferry_terminal$/)) return { category: "transport", mode: "ship" };
  if (has(/^transit_station$/)) return { category: "transport" };
  if (has(/^(lodging|hotel|motel|hostel|resort_hotel|guest_house|bed_and_breakfast|inn|campground)$/)) return { category: "stay" };
  if (has(/restaurant$|^(cafe|coffee_shop|bakery|bar|pub|food_court|meal_takeaway|meal_delivery|tea_house|dessert_shop|ice_cream_shop|food)$/)) return { category: "food" };
  if (has(/_store$|^(store|shopping_mall|market|supermarket|department_store|grocery_store)$/)) return { category: "shopping" };
  if (has(/^(tourist_attraction|museum|park|amusement_park|aquarium|zoo|art_gallery|historical_landmark|church|hindu_temple|buddhist_temple|shinto_shrine|place_of_worship|observation_deck|national_park|hiking_area|beach|garden|landmark|cultural_landmark|spa|natural_feature)$/)) return { category: "sight" };
  return null;
}
