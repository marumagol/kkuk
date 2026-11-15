/*
  구글 장소 검색 (4단계 2~3, 서버 전용). 키는 GOOGLE_MAPS_SERVER_KEY (Vercel 에만, 채팅/저장소에 두지 않음)
  - 자동 완성(Places API New autocomplete) → 고르면 상세(id, 이름, 주소, 좌표, 나라)
  - 같은 검색 세션 토큰을 자동 완성과 상세에 같이 넘겨 요금을 한 번으로 묶는다
  - 키가 없으면 검색 기능만 숨기고 직접 입력은 그대로
*/

const KEY = () => process.env.GOOGLE_MAPS_SERVER_KEY || "";
export const placesEnabled = () => KEY().length > 0;

export type Suggestion = { id: string; main: string; sub: string };
export type PlaceDetail = { id: string; name: string; address: string; lat: number; lng: number; country: string | null };

export async function autocomplete(input: string, session: string, kind: "place" | "city", bias?: { lat: number; lng: number } | null): Promise<Suggestion[]> {
  if (!placesEnabled()) return [];
  const body: Record<string, unknown> = { input, sessionToken: session, languageCode: "ko" };
  if (kind === "city") body.includedPrimaryTypes = ["locality", "administrative_area_level_1", "administrative_area_level_2", "colloquial_area", "sublocality_level_1"];
  if (bias) body.locationBias = { circle: { center: { latitude: bias.lat, longitude: bias.lng }, radius: 50000 } };
  const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
    method: "POST", headers: { "Content-Type": "application/json", "X-Goog-Api-Key": KEY() }, body: JSON.stringify(body), cache: "no-store",
  }).catch((e) => { console.error("[places] autocomplete 연결 실패", String(e).slice(0, 200)); return null; });
  if (!res?.ok) {
    // 원인 확인용 서버 기록 (구글 오류 문구에는 키가 들어 있지 않다)
    if (res) console.error("[places] autocomplete", res.status, (await res.text().catch(() => "")).slice(0, 400));
    return [];
  }
  const j = (await res.json()) as { suggestions?: { placePrediction?: { placeId: string; structuredFormat?: { mainText?: { text: string }; secondaryText?: { text: string } }; text?: { text: string } } }[] };
  return (j.suggestions ?? []).flatMap((s) => {
    const p = s.placePrediction;
    if (!p?.placeId) return [];
    return [{ id: p.placeId, main: p.structuredFormat?.mainText?.text ?? p.text?.text ?? "", sub: p.structuredFormat?.secondaryText?.text ?? "" }];
  }).slice(0, 6);
}

export async function details(id: string, session?: string): Promise<PlaceDetail | null> {
  if (!placesEnabled() || !/^[A-Za-z0-9_-]{10,255}$/.test(id)) return null;
  const q = new URLSearchParams({ languageCode: "ko", ...(session ? { sessionToken: session } : {}) });
  const res = await fetch(`https://places.googleapis.com/v1/places/${id}?${q}`, {
    headers: { "X-Goog-Api-Key": KEY(), "X-Goog-FieldMask": "id,displayName,formattedAddress,location,addressComponents" }, cache: "no-store",
  }).catch((e) => { console.error("[places] details 연결 실패", String(e).slice(0, 200)); return null; });
  if (!res?.ok) {
    if (res) console.error("[places] details", res.status, (await res.text().catch(() => "")).slice(0, 400));
    return null;
  }
  const j = (await res.json()) as {
    id: string; displayName?: { text: string }; formattedAddress?: string; location?: { latitude: number; longitude: number };
    addressComponents?: { shortText?: string; types?: string[] }[];
  };
  if (!j.location) return null;
  const country = j.addressComponents?.find((c) => c.types?.includes("country"))?.shortText ?? null;
  return { id: j.id, name: j.displayName?.text ?? "", address: j.formattedAddress ?? "", lat: j.location.latitude, lng: j.location.longitude, country: country && /^[A-Z]{2}$/.test(country) ? country : null };
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
