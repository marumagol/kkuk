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
      return [];
    case "stay": return [
      { key: "booking", label: "예약번호", placeholder: "예 : 1234567890", max: 40 },
      { key: "checkin", label: "체크인", type: "time", half: true },
      { key: "checkout", label: "체크아웃", type: "time", half: true },
      { key: "site", label: "예약한 곳", placeholder: "예 : 아고다", half: true, max: 30 },
      { key: "phone", label: "연락처", placeholder: "예 : +81 11-000-0000", half: true, max: 30 },
    ];
    case "food": return [
      { key: "booking", label: "예약번호", half: true, max: 40 },
      { key: "people", label: "인원", placeholder: "예 : 2", half: true, max: 10, unit: "명" },
      { key: "menu", label: "먹을 메뉴", placeholder: "예 : 징기스칸, 수프카레", max: 60 },
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
  return out;
}

/* 일정 카드에 보이는 한 줄. 예 : "비행기 KE765 · 인천 → 신치토세 · 예약 ABC123" */
export function detailLine(category: string, d?: Details | null): string {
  if (!d) return "";
  const route = d.from || d.to ? `${d.from ?? ""} → ${d.to ?? ""}`.trim() : "";
  const book = d.booking ? `예약 ${d.booking}` : "";
  const parts: string[] = [];
  if (category === "transport") {
    const mode = MODES.find((m) => m.code === d.mode)?.label;
    parts.push([mode, d.code].filter(Boolean).join(" "), route, d.depart && d.arrive ? `${d.depart}~${d.arrive}` : d.depart ? `${d.depart} 출발` : d.arrive ? `${d.arrive} 도착` : "", d.seat ? `좌석 ${d.seat}` : "", book);
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
