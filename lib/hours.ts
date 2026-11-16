/*
  영업시간과 휴무일 경고 (2026-11-16 마루님)
  - 구글 장소의 regularOpeningHours 를 장소 추가, 장소 변경 때 한 번만 받아 itinerary_items.details._hours 에 둔다
  - 형식 : "24h" (늘 열림) 또는 "열린요일-HHMM-닫는요일-HHMM" 을 ; 로 이은 것. 요일은 0 = 일요일 (구글, JS 와 같음)
  - 정기 영업시간만 본다. 공휴일, 임시 휴무는 모른다
*/
type GPoint = { day?: number; hour?: number; minute?: number };
export function encodeHours(h: { periods?: { open?: GPoint; close?: GPoint }[] } | null | undefined): string | null {
  const ps = h?.periods ?? [];
  if (!ps.length) return null;
  if (ps.length === 1 && ps[0].open && !ps[0].close) return "24h";
  const t = (p: GPoint) => `${p.day ?? 0}-${String(p.hour ?? 0).padStart(2, "0")}${String(p.minute ?? 0).padStart(2, "0")}`;
  const out = ps.filter((p) => p.open && p.close).map((p) => `${t(p.open!)}-${t(p.close!)}`);
  return out.length ? out.join(";").slice(0, 400) : null;
}

const WEEK = 7 * 1440;
const minOf = (d: string, hm: string) => Number(d) * 1440 + Number(hm.slice(0, 2)) * 60 + Number(hm.slice(2));
function intervals(hours: string): [number, number][] | null {
  const out: [number, number][] = [];
  for (const p of hours.split(";")) {
    const m = /^([0-6])-(\d{4})-([0-6])-(\d{4})$/.exec(p);
    if (!m) return null;
    const a = minOf(m[1], m[2]); let b = minOf(m[3], m[4]);
    if (b <= a) b += WEEK;
    out.push([a, b]);
  }
  return out;
}

/* date : YYYY-MM-DD, time : HH:MM (없으면 그날 쉬는지만 본다). 문제가 없으면 undefined */
export function hoursWarning(hours: string, date: string, time?: string): string | undefined {
  if (!hours || hours === "24h") return undefined;
  const iv = intervals(hours);
  if (!iv?.length) return undefined;
  const wd = new Date(`${date}T00:00:00Z`).getUTCDay();
  if (!iv.some(([a]) => Math.floor(a / 1440) % 7 === wd)) return "이날은 쉬는 날이에요";
  if (time && /^\d{2}:\d{2}$/.test(time)) {
    const m = wd * 1440 + Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
    if (!iv.some(([a, b]) => (m >= a && m < b) || (m + WEEK >= a && m + WEEK < b))) return "이 시간에는 문을 닫아요";
  }
  return undefined;
}
