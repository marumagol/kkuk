/*
  구글 장소 검색 (4단계 2~3, 서버 전용). 키는 GOOGLE_MAPS_SERVER_KEY (Vercel 에만, 채팅/저장소에 두지 않음)
  - 자동 완성(Places API New autocomplete) → 고르면 상세(id, 이름, 주소, 좌표, 나라)
  - 같은 검색 세션 토큰을 자동 완성과 상세에 같이 넘겨 요금을 한 번으로 묶는다
  - 키가 없으면 검색 기능만 숨기고 직접 입력은 그대로
*/

import { encodeHours } from "@/lib/hours";

const KEY = () => process.env.GOOGLE_MAPS_SERVER_KEY || "";
export const placesEnabled = () => KEY().length > 0;

export type Suggestion = { id: string; main: string; sub: string };
export type PlaceDetail = { id: string; name: string; address: string; lat: number; lng: number; country: string | null; types?: string[] /* 구글 장소 종류 (분류 자동 고르기, 2026-11-16) */ };

/* 구글이 실패하면 null (결과 없음 [] 과 나눠서 화면에 이유를 보여 준다, 2026-11-16) */
export async function autocomplete(input: string, session: string, kind: "place" | "city", bias?: { lat: number; lng: number } | null): Promise<Suggestion[] | null> {
  if (!placesEnabled()) return null;
  const body: Record<string, unknown> = { input, sessionToken: session, languageCode: "ko" };
  if (kind === "city") body.includedPrimaryTypes = ["locality", "administrative_area_level_1", "administrative_area_level_2", "colloquial_area", "sublocality_level_1"];
  if (bias) body.locationBias = { circle: { center: { latitude: bias.lat, longitude: bias.lng }, radius: 50000 } };
  const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
    method: "POST", headers: { "Content-Type": "application/json", "X-Goog-Api-Key": KEY() }, body: JSON.stringify(body), cache: "no-store",
  }).catch((e) => { console.error("[places] autocomplete 연결 실패", String(e).slice(0, 200)); return null; });
  if (!res?.ok) {
    // 원인 확인용 서버 기록 (구글 오류 문구에는 키가 들어 있지 않다)
    if (res) console.error("[places] autocomplete", res.status, (await res.text().catch(() => "")).slice(0, 400));
    return null;
  }
  const j = (await res.json().catch(() => ({}))) as { suggestions?: { placePrediction?: { placeId: string; structuredFormat?: { mainText?: { text: string }; secondaryText?: { text: string } }; text?: { text: string } } }[] };
  return (j.suggestions ?? []).flatMap((s) => {
    const p = s.placePrediction;
    if (!p?.placeId) return [];
    return [{ id: p.placeId, main: p.structuredFormat?.mainText?.text ?? p.text?.text ?? "", sub: p.structuredFormat?.secondaryText?.text ?? "" }];
  }).slice(0, 6);
}

/* 0.91.3 : 이름(displayName)은 묻지 않는다. 이름 칸이 Pro 등급이라 세션 전체가 비싼 등급(월 무료 1,000)으로 잡혔다.
   이름은 검색 목록의 이름을 쓴다 (place-search 가 채움). 빼면 Essentials (월 무료 10,000) */
export async function details(id: string, session?: string): Promise<PlaceDetail | null> {
  if (!placesEnabled() || !/^[A-Za-z0-9_-]{10,255}$/.test(id)) return null;
  const q = new URLSearchParams({ languageCode: "ko", ...(session ? { sessionToken: session } : {}) });
  const res = await fetch(`https://places.googleapis.com/v1/places/${id}?${q}`, {
    headers: { "X-Goog-Api-Key": KEY(), "X-Goog-FieldMask": "id,formattedAddress,location,addressComponents,types,primaryType" }, cache: "no-store",
  }).catch((e) => { console.error("[places] details 연결 실패", String(e).slice(0, 200)); return null; });
  if (!res?.ok) {
    if (res) console.error("[places] details", res.status, (await res.text().catch(() => "")).slice(0, 400));
    return null;
  }
  const j = (await res.json()) as {
    id: string; displayName?: { text: string }; formattedAddress?: string; location?: { latitude: number; longitude: number };
    addressComponents?: { shortText?: string; types?: string[] }[]; types?: string[]; primaryType?: string;
  };
  if (!j.location) return null;
  const country = j.addressComponents?.find((c) => c.types?.includes("country"))?.shortText ?? null;
  return { id: j.id, name: j.displayName?.text ?? "", address: j.formattedAddress ?? "", lat: j.location.latitude, lng: j.location.longitude, country: country && /^[A-Z]{2}$/.test(country) ? country : null,
    types: [...new Set([j.primaryType, ...(j.types ?? [])].filter((t): t is string => !!t))].slice(0, 12) };
}

/*
  영업시간 (2026-11-16 마루님, 영업시간 경고). 장소 저장 때 한 번만 부른다. 하루 상한은 부르는 쪽(savePlace)이 take_api_quota 로 확인
  - 영업시간 형식은 lib/hours.ts. 구글에 영업시간이 없으면 "-" (다시 묻지 않게), 실패하면 undefined (다음 저장 때 다시)
*/
export async function openingHours(id: string): Promise<string | undefined> {
  if (!placesEnabled() || !/^[A-Za-z0-9_-]{10,255}$/.test(id)) return undefined;
  const res = await fetch(`https://places.googleapis.com/v1/places/${id}`, {
    headers: { "X-Goog-Api-Key": KEY(), "X-Goog-FieldMask": "regularOpeningHours" }, cache: "no-store",
  }).catch((e) => { console.error("[places] hours 연결 실패", String(e).slice(0, 200)); return null; });
  if (!res?.ok) { if (res) console.error("[places] hours", res.status, (await res.text().catch(() => "")).slice(0, 300)); return undefined; }
  const j = (await res.json().catch(() => null)) as { regularOpeningHours?: Parameters<typeof encodeHours>[0] } | null;
  if (!j) return undefined;
  return encodeHours(j.regularOpeningHours) ?? "-";
}

/* 이름으로 장소 하나 찾기 (2026-11-15 "위치 찾기") : Text Search 한 번에 좌표까지. 못 찾으면 null */
export async function searchOne(text: string, bias?: { lat: number; lng: number } | null): Promise<PlaceDetail | null> {
  if (!placesEnabled() || [...text].length < 2) return null;
  const body: Record<string, unknown> = { textQuery: text, languageCode: "ko", pageSize: 1 };
  if (bias) body.locationBias = { circle: { center: { latitude: bias.lat, longitude: bias.lng }, radius: 50000 } };
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST", cache: "no-store",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": KEY(), "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location" },
    body: JSON.stringify(body),
  }).catch((e) => { console.error("[places] searchText 연결 실패", String(e).slice(0, 200)); return null; });
  if (!res?.ok) {
    if (res) console.error("[places] searchText", res.status, (await res.text().catch(() => "")).slice(0, 400));
    return null;
  }
  const j = (await res.json()) as { places?: { id: string; displayName?: { text: string }; formattedAddress?: string; location?: { latitude: number; longitude: number } }[] };
  const p = j.places?.[0];
  if (!p?.location || !/^[A-Za-z0-9_-]{10,255}$/.test(p.id)) return null;
  return { id: p.id, name: p.displayName?.text ?? "", address: p.formattedAddress ?? "", lat: p.location.latitude, lng: p.location.longitude, country: null };
}
