"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { PREVIEW_COOKIE, safeNext } from "@/lib/viewer";
import { countryOf, isoOf, decimalsOf, ICON_PATH, MAX_COUNTRY_NAME } from "@/lib/countries";
import { AVATAR_PATH } from "@/lib/storage";
import { cleanDetails } from "@/lib/place-fields";
import { autocomplete, details, searchOne, openingHours, type Suggestion, type PlaceDetail } from "@/lib/places";
import { MAX_TRIP_DAYS, MAX_CITIES, MAX_TRIP_TITLE, MAX_PLACE_TITLE, MAX_PLACE_ADDRESS, MAX_PLACE_MEMO, MAX_PLACE_PHOTOS } from "@/lib/rules";

/* 로그아웃 → 둘러보기 (홈) */
export async function signOut() {
  if (supabaseEnv()) {
    const sb = await createClient();
    await sb!.auth.signOut();
  }
  (await cookies()).delete(PREVIEW_COOKIE);
  redirect("/?out=1"); // out : 오프라인용으로 저장한 화면을 지우는 신호 (public/sw.js)
}

/* 미리보기 모드 켜기 : Supabase 연결 전에만 동작 */
export async function startPreview(formData: FormData) {
  if (supabaseEnv()) redirect("/login");
  (await cookies()).set(PREVIEW_COOKIE, "1", { path: "/", httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 7 });
  redirect(safeNext(String(formData.get("next") ?? "/")));
}

/* 표시 이름 저장 (처음 로그인, 마이 > 이름 바꾸기). 1~20자 */
export type NameState = { error?: string };
export async function saveName(_prev: NameState, formData: FormData): Promise<NameState> {
  const name = String(formData.get("name") ?? "").trim();
  const next = safeNext(String(formData.get("next") ?? "/"));
  const len = [...name].length;
  if (len < 1) return { error: "이름을 적어 주세요" };
  if (len > 20) return { error: "이름은 20자까지 쓸 수 있어요" };
  const sb = await createClient();
  if (!sb) return { error: "아직 로그인 서버가 연결되지 않았어요" };
  const { data } = await sb.auth.getUser();
  if (!data.user) redirect(`/login?next=${encodeURIComponent(next)}`);
  const { error } = await sb.from("profiles").upsert({ user_id: data.user.id, display_name: name }, { onConflict: "user_id" });
  if (error) return { error: "저장하지 못했어요. 잠시 뒤 다시 시도해 주세요" };
  revalidatePath("/", "layout");
  redirect(next);
}

/* 여행 만들기 (S06). 여행 + 여행 주인 + 도시를 DB 함수 create_trip 으로 한 번에 저장 */
/* 도시 : country 는 나라 목록 코드. 직접 입력한 나라는 country "ETC" + countryName (+ 올린 아이콘 icon) */
export type TripCity = { name: string; country: string; countryName?: string; icon?: string; placeId?: string; lat?: number; lng?: number };
export type NewTrip = { title: string; start: string; end: string; cities: TripCity[] };
export type CreateTripResult = { error: string } | undefined;

/* 여행 입력 검사 (만들기, 수정 같이). 통과하면 정리된 값, 아니면 오류 문구 */
function checkTrip(input: NewTrip): { error: string } | { title: string; start: string; end: string; cities: TripCity[] } {
  const title = String(input?.title ?? "").trim();
  const cities = (Array.isArray(input?.cities) ? input.cities : [])
    .map((c) => {
      const country = String(c?.country ?? "");
      const custom = country === "ETC";
      return {
        name: String(c?.name ?? "").trim(), country,
        countryName: custom ? String(c?.countryName ?? "").trim() || undefined : undefined,
        icon: custom && c?.icon ? String(c.icon) : undefined,
        // 장소 검색으로 고른 도시 (4단계) : 형식이 맞을 때만, 틀리면 DB 함수가 비운다
        ...(c?.placeId && /^[A-Za-z0-9_-]{10,255}$/.test(String(c.placeId)) && Number.isFinite(c?.lat) && Number.isFinite(c?.lng)
          ? { placeId: String(c.placeId), lat: Number(c.lat), lng: Number(c.lng) } : {}),
      };
    })
    .filter((c) => c.name);
  const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + "T00:00:00Z"));
  const { start, end } = input ?? {};

  if (!cities.length) return { error: "도시를 하나 이상 넣어 주세요" };
  if (cities.length > MAX_CITIES) return { error: `도시는 ${MAX_CITIES}개까지 넣을 수 있어요` };
  if (cities.some((c) => [...c.name].length > 40)) return { error: "도시 이름은 40자까지 쓸 수 있어요" };
  if (cities.some((c) => !countryOf(c.country))) return { error: "도시마다 나라를 골라 주세요" };
  if (cities.some((c) => c.countryName && [...c.countryName].length > MAX_COUNTRY_NAME)) return { error: `나라 이름은 ${MAX_COUNTRY_NAME}자까지 쓸 수 있어요` };
  if (cities.some((c) => c.icon && !ICON_PATH.test(c.icon))) return { error: "아이콘을 다시 올려 주세요" };
  if (!isDate(start) || !isDate(end) || end < start) return { error: "여행 기간을 다시 골라 주세요" };
  if ((Date.parse(end) - Date.parse(start)) / 86400000 + 1 > MAX_TRIP_DAYS) return { error: `여행 기간은 ${MAX_TRIP_DAYS}일까지 정할 수 있어요` };
  if (![...title].length) return { error: "여행 이름을 적어 주세요" };
  if ([...title].length > MAX_TRIP_TITLE) return { error: `여행 이름은 ${MAX_TRIP_TITLE}자까지 쓸 수 있어요` };
  return { title, start, end, cities };
}

/* 직접 입력한 나라 이름과 아이콘은 여행 저장 뒤 도시 줄에 따로 적는다 (DB 함수는 그대로 두기 위해). 실패해도 여행은 저장됨 */
async function saveCustomCountries(sb: NonNullable<Awaited<ReturnType<typeof createClient>>>, tripId: string, uid: string, cities: TripCity[]) {
  await Promise.all(cities.map((c, i) => c.countryName || c.icon
    ? sb.from("trip_cities").update({ country_name: c.countryName ?? null, country_icon: c.icon?.startsWith(uid + "/") ? c.icon : null })
        .eq("trip_id", tripId).eq("sort_order", i)
    : null));
}

export async function createTrip(input: NewTrip): Promise<CreateTripResult> {
  const c = checkTrip(input);
  if ("error" in c) return c;
  const { title, start, end, cities } = c;

  const sb = await createClient();
  if (!sb) return { error: "아직 로그인 서버가 연결되지 않아 저장할 수 없어요" };
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect("/login?next=/trips/new");

  const { data, error } = await sb.rpc("create_trip", {
    p_title: title, p_start_date: start, p_end_date: end,
    p_time_zone: countryOf(cities[0].country)!.tz,
    p_cities: cities.map((c) => ({ name: c.name, country_code: isoOf(c.country), place_id: c.placeId, lat: c.lat, lng: c.lng })),
  });
  if (error || !data) {
    if (error?.message?.includes("profile_required")) redirect("/welcome?next=/trips/new");
    return { error: "저장하지 못했어요. 잠시 뒤 다시 시도해 주세요" };
  }
  await saveCustomCountries(sb, String(data), auth.user.id, cities);
  revalidatePath("/", "layout");
  redirect(`/trips/${data}`);
}

/* 여행 정보 수정 (S09). 이름, 기간, 도시를 DB 함수 update_trip 으로 한 번에. 시간대는 첫 도시의 나라가 바뀔 때만 다시 정함 */
export async function updateTrip(id: string, input: NewTrip & { prevFirstCountry?: string }): Promise<CreateTripResult> {
  const c = checkTrip(input);
  if ("error" in c) return c;
  const sb = await createClient();
  if (!sb) return { error: "아직 로그인 서버가 연결되지 않아 저장할 수 없어요" };
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect(`/login?next=/trips/${id}/edit`);

  const first = c.cities[0].country;
  const { error } = await sb.rpc("update_trip", {
    p_trip: id, p_title: c.title, p_start_date: c.start, p_end_date: c.end,
    p_time_zone: first === input.prevFirstCountry ? null : countryOf(first)!.tz,
    p_cities: c.cities.map((x) => ({ name: x.name, country_code: isoOf(x.country), place_id: x.placeId, lat: x.lat, lng: x.lng })),
  });
  if (error) {
    if (error.message?.includes("forbidden")) return { error: "이 여행을 수정할 권한이 없어요" };
    return { error: "저장하지 못했어요. 잠시 뒤 다시 시도해 주세요" };
  }
  await saveCustomCountries(sb, id, auth.user.id, c.cities);
  revalidatePath("/", "layout");
  redirect(`/trips/${id}?saved=1`);
}

/* 여행 삭제 (S10). 행을 지우지 않고 removed_at. 여행 주인만 (DB 트리거가 한 번 더 막음) */
export async function removeTrip(id: string): Promise<CreateTripResult> {
  const sb = await createClient();
  if (!sb) return { error: "아직 로그인 서버가 연결되지 않아 삭제할 수 없어요" };
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect(`/login?next=/trips/${id}/edit`);
  const { data, error } = await sb.from("trips").update({ removed_at: new Date().toISOString() }).eq("id", id).is("removed_at", null).select("id");
  if (error?.message?.includes("owner_only")) return { error: "여행 삭제는 여행 주인만 할 수 있어요" };
  if (error || !data?.length) return { error: "삭제하지 못했어요. 잠시 뒤 다시 시도해 주세요" };
  revalidatePath("/", "layout");
  redirect("/trips?deleted=1");
}

/* 삭제한 여행 되살리기 (5단계 3번). 여행 주인만, 30일 안에만 (DB 함수 restore_trip) */
export async function restoreTrip(id: string): Promise<{ error?: string }> {
  const sb = await createClient();
  if (!sb) return { error: "아직 로그인 서버가 연결되지 않았어요" };
  const { error } = await sb.rpc("restore_trip", { p_trip: id });
  if (error?.message?.includes("too_old")) return { error: "삭제한 지 30일이 지나 되살릴 수 없어요" };
  if (error?.message?.includes("owner_only")) return { error: "여행 주인만 되살릴 수 있어요" };
  if (error && !error.message?.includes("not_removed")) return { error: "되살리지 못했어요. 잠시 뒤 다시 시도해 주세요" };
  revalidatePath("/", "layout");
  redirect(`/trips/${id}?restored=1`);
}

/* ---------- 장소 (S08) : 추가, 수정, 삭제. 권한은 DB 규칙(RLS)이 막는다 ---------- */
export type PlaceInput = {
  title: string; address: string; category: string; time: string; cost: string; currency: string; memo: string;
  day: number | null; // 0 = 1일차, null = 날짜 미정
  photos?: string[]; // 저장소 place-photos 안 위치 (<여행 id>/<그림 id>.jpg), 순서대로 최대 5장
  place?: { id: string; lat: number; lng: number } | null; // 장소 검색으로 고른 구글 장소 (4단계). null 이면 연결 끊기, 없으면 그대로
  details?: Record<string, string>; // 분류별 맞춤 칸 (0030). 고른 분류의 칸만 저장
  reserve?: boolean; // 예약 필요 → 준비 탭 예약 목록에 (0032). 없으면 그대로
  again?: boolean; // 새 장소 저장 뒤 같은 날로 장소 추가 화면을 다시 연다 (이어서 추가, 2026-11-16)
};
const HOURS_CATEGORIES = ["food", "sight", "shopping"]; // 영업시간을 볼 분류
const CATEGORIES = ["transport", "food", "sight", "shopping", "stay", "memo"]; // memo = 일정 사이 메모 (0031)
const placeCols = (pl: PlaceInput["place"]) => {
  if (pl === undefined) return {};
  const ok = pl && /^[A-Za-z0-9_-]{10,255}$/.test(String(pl.id)) && Number.isFinite(pl.lat) && Number.isFinite(pl.lng)
    && Math.abs(pl.lat) <= 90 && Math.abs(pl.lng) <= 180;
  return ok ? { google_place_id: pl!.id, lat: pl!.lat, lng: pl!.lng, coords_at: new Date().toISOString() } : { google_place_id: null, lat: null, lng: null, coords_at: null };
};

export async function savePlace(tripId: string, placeId: string | null, input: PlaceInput): Promise<CreateTripResult> {
  const title = String(input?.title ?? "").trim();
  const address = String(input?.address ?? "").trim();
  const memo = String(input?.memo ?? "").trim();
  const time = String(input?.time ?? "");
  const currency = String(input?.currency ?? "KRW");
  const costText = String(input?.cost ?? "").replace(/,/g, "").trim();
  const day = input?.day == null ? null : Number(input.day);

  if (![...title].length) return { error: "장소 이름을 적어 주세요" };
  if ([...title].length > MAX_PLACE_TITLE) return { error: `장소 이름은 ${MAX_PLACE_TITLE}자까지 쓸 수 있어요` };
  if ([...address].length > MAX_PLACE_ADDRESS) return { error: `주소는 ${MAX_PLACE_ADDRESS}자까지 쓸 수 있어요` };
  if ([...memo].length > MAX_PLACE_MEMO) return { error: `메모는 ${MAX_PLACE_MEMO}자까지 쓸 수 있어요` };
  if (!CATEGORIES.includes(input?.category)) return { error: "분류를 골라 주세요" };
  if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return { error: "시간을 다시 골라 주세요" };
  if (day != null && (!Number.isInteger(day) || day < 0 || day >= MAX_TRIP_DAYS)) return { error: "날짜를 다시 골라 주세요" };
  if (!/^[A-Z]{3}$/.test(currency)) return { error: "통화를 다시 골라 주세요" };
  const photos = (Array.isArray(input?.photos) ? input.photos : []).map(String);
  if (photos.length > MAX_PLACE_PHOTOS) return { error: `첨부 파일은 ${MAX_PLACE_PHOTOS}개까지 넣을 수 있어요` };
  if (photos.some((x) => !new RegExp(`^${tripId}/[0-9a-f-]{36}\\.(jpg|png|webp|pdf)$`).test(x))) return { error: "첨부 파일을 다시 올려 주세요" };
  const extra = cleanDetails(input.category, input?.details);
  if (!extra) return { error: "맞춤 칸(편명, 예약번호, 시간)을 다시 확인해 주세요" };
  let cost: number | null = null;
  if (costText) {
    const d = decimalsOf(currency);
    if (!new RegExp(`^\\d{1,12}${d ? `(\\.\\d{1,${d}})?` : ""}$`).test(costText)) return { error: d ? `예상 비용은 숫자로, 소수점 ${d}자리까지 적어 주세요` : "예상 비용은 숫자로만 적어 주세요" };
    cost = Math.round(Number(costText) * 10 ** d);
  }

  const sb = await createClient();
  if (!sb) return { error: "아직 로그인 서버가 연결되지 않아 저장할 수 없어요" };
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect(`/login?next=/trips/${tripId}`);

  // 새로 넣거나 날짜를 바꾸면 그 날 맨 뒤로
  const lastOrder = async () => {
    let q = sb.from("itinerary_items").select("sort_order").eq("trip_id", tripId).is("removed_at", null);
    q = day == null ? q.is("day_index", null) : q.eq("day_index", day);
    const { data } = await q.order("sort_order", { ascending: false }).limit(1).maybeSingle();
    return (data?.sort_order ?? -1) + 1;
  };
  // 메모는 장소가 아니라 주소, 비용, 지도 위치를 비운다 (사진은 2026-11-16 부터 남긴다)
  const isMemo = input.category === "memo";
  const row = {
    title, address: isMemo ? null : address || null, memo: memo || null, category: input.category, start_time: time || null,
    estimated_cost: isMemo ? null : cost, cost_currency: isMemo || cost == null ? null : currency, day_index: day, photos, details: extra,
    ...placeCols(isMemo ? null : input?.place),
  };

  // 영업시간 (2026-11-16) : 구글 장소가 새로 이어질 때만 한 번 받는다. 하루 상한(전체, 사람별)을 넘으면 받지 않는다
  const { data: prev } = placeId
    ? await sb.from("itinerary_items").select("day_index, google_place_id, details").eq("trip_id", tripId).eq("id", placeId).is("removed_at", null).maybeSingle()
    : { data: null };
  if (placeId && !prev) return { error: "이 장소를 찾을 수 없어요. 이미 삭제됐을 수 있어요" };
  const gpid = isMemo ? null : input?.place === undefined ? (prev?.google_place_id as string | null | undefined) ?? null : ((row as { google_place_id?: string | null }).google_place_id ?? null);
  const hadHours = (prev?.details as Record<string, string> | null)?._hours;
  if (gpid && HOURS_CATEGORIES.includes(input.category)) {
    if (gpid === prev?.google_place_id && hadHours) extra._hours = hadHours;
    else {
      const h = (await underPlaceQuota(sb, "hours")) ? await openingHours(gpid) : undefined;
      if (h) extra._hours = h;
    }
  }

  if (placeId && prev) {
    const patch = prev.day_index === day ? row : { ...row, sort_order: await lastOrder() };
    const { data, error } = await sb.from("itinerary_items").update(patch).eq("trip_id", tripId).eq("id", placeId).select("id");
    if (error || !data?.length) return { error: "저장하지 못했어요. 수정할 권한이 없거나 잠시 문제가 생겼어요. 잠시 뒤 다시 시도해 주세요" };
  }
  let savedId = placeId;
  if (!placeId) {
    const { data, error } = await sb.from("itinerary_items").insert({ ...row, trip_id: tripId, sort_order: await lastOrder(), created_by: auth.user.id }).select("id").single();
    if (error || !data) return { error: "저장하지 못했어요. 수정할 권한이 없거나 잠시 문제가 생겼어요. 잠시 뒤 다시 시도해 주세요" };
    savedId = data.id as string;
  }
  if (input?.reserve !== undefined && savedId) await syncReservation(sb, auth.user.id, tripId, savedId, !isMemo && !!input.reserve, title, day);
  revalidatePath("/", "layout");
  if (input?.again && !placeId) redirect(`/trips/${tripId}/places/new?day=${day == null ? "none" : day + 1}&added=${Date.now().toString(36)}`);
  redirect(`/trips/${tripId}?${day == null ? "undated=1#undated" : `day=${day + 1}`}`);
}

/* 장소의 "예약 필요" 를 준비 탭 예약과 맞춘다 (0032). 켜면 만들거나 이름, 날짜를 맞추고, 끄면 예약에서 뺀다 */
async function syncReservation(sb: NonNullable<Awaited<ReturnType<typeof createClient>>>, uid: string, tripId: string, itemId: string, on: boolean, title: string, day: number | null) {
  const { data: cur } = await sb.from("checklist_items").select("id").eq("trip_id", tripId).eq("item_id", itemId).is("removed_at", null).maybeSingle();
  if (!on) {
    if (cur) await sb.from("checklist_items").update({ removed_at: new Date().toISOString() }).eq("id", cur.id);
    return;
  }
  let due: string | null = null;
  if (day != null) {
    const { data: t } = await sb.from("trips").select("start_date").eq("id", tripId).maybeSingle();
    if (t?.start_date) { const d = new Date(`${t.start_date}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + day); due = d.toISOString().slice(0, 10); }
  }
  const name = [...title].slice(0, 80).join("").trim();
  if (cur) { await sb.from("checklist_items").update({ due_date: due }).eq("id", cur.id); return; } // 이름은 준비 탭에서 고쳤을 수 있어 날짜만 맞춘다
  const { data: last } = await sb.from("checklist_items").select("sort_order").eq("trip_id", tripId).eq("kind", "reservation").is("removed_at", null).order("sort_order", { ascending: false }).limit(1).maybeSingle();
  await sb.from("checklist_items").insert({ trip_id: tripId, kind: "reservation", title: name, due_date: due, item_id: itemId, sort_order: (last?.sort_order ?? -1) + 1, created_by: uid });
}

/* 일정 목록에서 바로 지우기 (화면 이동 없음). 이어진 예약도 같이 뺀다 */
export async function deletePlace(tripId: string, placeId: string): Promise<CreateTripResult> {
  if (!isUuid(tripId) || !isUuid(placeId)) return { error: "삭제하지 못했어요. 화면을 새로고침한 뒤 다시 시도해 주세요" };
  const sb = await createClient();
  if (!sb) return { error: "아직 로그인 서버가 연결되지 않아 지울 수 없어요" };
  const now = new Date().toISOString();
  const { data, error } = await sb.from("itinerary_items").update({ removed_at: now }).eq("trip_id", tripId).eq("id", placeId).is("removed_at", null).select("id");
  if (error || !data?.length) return { error: "삭제하지 못했어요. 수정할 권한이 없거나 이미 삭제됐을 수 있어요. 화면을 새로고침해 확인해 주세요" };
  await sb.from("checklist_items").update({ removed_at: now }).eq("trip_id", tripId).eq("item_id", placeId).is("removed_at", null);
  revalidatePath(`/trips/${tripId}`);
}

export async function removePlace(tripId: string, placeId: string, day: number | null): Promise<CreateTripResult> {
  const sb = await createClient();
  if (!sb) return { error: "아직 로그인 서버가 연결되지 않아 삭제할 수 없어요" };
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect(`/login?next=/trips/${tripId}`);
  const { data, error } = await sb.from("itinerary_items").update({ removed_at: new Date().toISOString() })
    .eq("trip_id", tripId).eq("id", placeId).is("removed_at", null).select("id");
  if (error || !data?.length) return { error: "삭제하지 못했어요. 잠시 뒤 다시 시도해 주세요" };
  await sb.from("checklist_items").update({ removed_at: new Date().toISOString() }).eq("trip_id", tripId).eq("item_id", placeId).is("removed_at", null);
  revalidatePath("/", "layout");
  redirect(`/trips/${tripId}?removed=1${day == null ? "&undated=1#undated" : `&day=${day + 1}`}`);
}

/* 장소 순서 바꾸기 (S07). 한 날의 장소 id 를 새 순서대로. DB 함수 reorder_items 가 한 번에 저장 */
export async function reorderPlaces(tripId: string, ids: string[]): Promise<CreateTripResult> {
  const uuid = /^[0-9a-f-]{36}$/i;
  if (!uuid.test(tripId) || !Array.isArray(ids) || !ids.length || ids.length > 500 || !ids.every((x) => uuid.test(String(x)))) {
    return { error: "순서를 저장하지 못했어요. 화면을 새로고침한 뒤 다시 시도해 주세요" };
  }
  const sb = await createClient();
  if (!sb) return { error: "아직 로그인 서버가 연결되지 않아 저장할 수 없어요" };
  const { error } = await sb.rpc("reorder_items", { p_trip: tripId, p_ids: ids });
  if (error) return { error: error.message?.includes("forbidden") ? "이 여행을 수정할 권한이 없어요" : "순서를 저장하지 못했어요. 원래 자리로 돌려놨어요" };
  revalidatePath(`/trips/${tripId}`);
}

/* 날짜를 넘어 끌어서 옮기기 (여행 메뉴 개편, migration 0030). 옮길 날(null = 날짜 미정)과 그 날의 새 순서 */
export async function moveItem(tripId: string, itemId: string, day: number | null, ids: string[]): Promise<CreateTripResult> {
  const uuid = /^[0-9a-f-]{36}$/i;
  if (!uuid.test(tripId) || !uuid.test(itemId) || !Array.isArray(ids) || !ids.length || ids.length > 500 || !ids.every((x) => uuid.test(String(x))) || !ids.includes(itemId)
    || (day != null && (!Number.isInteger(day) || day < 0 || day >= MAX_TRIP_DAYS))) {
    return { error: "옮기지 못했어요. 화면을 새로고침한 뒤 다시 시도해 주세요" };
  }
  const sb = await createClient();
  if (!sb) return { error: "아직 로그인 서버가 연결되지 않아 저장할 수 없어요" };
  const { error } = await sb.rpc("move_item", { p_trip: tripId, p_item: itemId, p_day: day, p_ids: ids });
  if (error) return { error: error.message?.includes("forbidden") ? "이 여행을 수정할 권한이 없어요" : "옮기지 못했어요. 원래 자리로 돌려놨어요" };
  revalidatePath(`/trips/${tripId}`);
}

/* 탈퇴 (S13). DB 함수 delete_my_account 가 내 여행과 로그인 정보를 지운다. 끝나면 이 기기에서 로그아웃 */
export async function withdraw(): Promise<CreateTripResult> {
  const sb = await createClient();
  if (!sb) return { error: "아직 로그인 서버가 연결되지 않았어요" };
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect("/login?next=/me/withdraw");
  const { error } = await sb.rpc("delete_my_account");
  if (error) {
    if (error.message?.includes("transfer_required")) return { error: "함께하는 사람이 있는 여행은 먼저 여행 주인을 넘겨 주세요" };
    return { error: "탈퇴하지 못했어요. 잠시 뒤 다시 시도해 주세요" };
  }
  await sb.auth.signOut({ scope: "local" }).catch(() => {});
  revalidatePath("/", "layout");
  redirect("/?bye=1");
}

/* 프로필 사진 바꾸기 (설정). 그림은 브라우저가 avatars/<내 id>/ 에 올리고, 여기서는 위치만 저장. null = 빼기 */
export async function saveAvatar(path: string | null): Promise<CreateTripResult> {
  const sb = await createClient();
  if (!sb) return { error: "아직 로그인 서버가 연결되지 않았어요" };
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect("/login?next=/me");
  if (path && (!AVATAR_PATH.test(path) || !path.startsWith(auth.user.id + "/"))) return { error: "사진을 다시 올려 주세요" };
  const { data: prev } = await sb.from("profiles").select("avatar_url").eq("user_id", auth.user.id).maybeSingle();
  const { error } = await sb.from("profiles").update({ avatar_url: path }).eq("user_id", auth.user.id);
  if (error) return { error: "저장하지 못했어요. 잠시 뒤 다시 시도해 주세요" };
  // 예전 사진 파일은 지운다 (실패해도 화면에는 영향 없음)
  if (prev?.avatar_url && prev.avatar_url !== path && AVATAR_PATH.test(prev.avatar_url)) await sb.storage.from("avatars").remove([prev.avatar_url]);
  revalidatePath("/", "layout");
}

/* ───────── 같이 쓰기 (2단계) : 모두 DB 함수가 권한을 검사한다 ───────── */
const MEMBER_ERRORS: Record<string, string> = {
  forbidden: "여행 주인만 할 수 있어요",
  trip_removed: "삭제된 여행이에요",
  transfer_required: "여행 주인은 먼저 다른 사람에게 주인을 넘겨야 나갈 수 있어요",
  owner_role_fixed: "여행 주인의 권한은 바꿀 수 없어요. 주인 넘기기를 써 주세요",
  owner_cannot_leave: "여행 주인은 내보낼 수 없어요",
  member_not_found: "이미 나간 사람이에요. 새로고침해 주세요",
  invite_not_found: "없는 초대 링크예요",
  invite_revoked: "여행 주인이 끊은 초대 링크예요. 새 링크를 받아 주세요",
  invite_expired: "기간이 지난 초대 링크예요. 새 링크를 받아 주세요",
  trip_full: "함께하는 사람이 가득 찼어요 (최대 10명)",
  profile_required: "이름을 먼저 정해 주세요",
};
function memberError(msg?: string) {
  const key = Object.keys(MEMBER_ERRORS).find((k) => msg?.includes(k));
  return { error: key ? MEMBER_ERRORS[key] : "처리하지 못했어요. 잠시 뒤 다시 시도해 주세요" };
}
async function memberRpc(fn: string, args: Record<string, unknown>, back: string): Promise<{ error: string } | { data: unknown }> {
  const sb = await createClient();
  if (!sb) return { error: "아직 로그인 서버가 연결되지 않았어요" };
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect(`/login?next=${encodeURIComponent(back)}`);
  const { data, error } = await sb.rpc(fn, args);
  if (error) return memberError(error.message);
  return { data };
}
const isUuid = (s: string) => /^[0-9a-f-]{36}$/i.test(s);
const okRole = (r: string) => r === "editor" || r === "viewer";

export async function makeInvite(tripId: string, role: string): Promise<{ error?: string; token?: string }> {
  if (!isUuid(tripId) || !okRole(role)) return { error: "요청을 처리하지 못했어요. 화면을 새로고침한 뒤 다시 시도해 주세요" };
  const r = await memberRpc("create_invite", { p_trip: tripId, p_role: role }, `/trips/${tripId}/members`);
  if ("error" in r) return r;
  revalidatePath(`/trips/${tripId}/members`);
  return { token: String(r.data) };
}
export async function revokeInvite(tripId: string): Promise<CreateTripResult> {
  if (!isUuid(tripId)) return { error: "요청을 처리하지 못했어요. 화면을 새로고침한 뒤 다시 시도해 주세요" };
  const r = await memberRpc("revoke_invite", { p_trip: tripId }, `/trips/${tripId}/members`);
  if ("error" in r) return r;
  revalidatePath(`/trips/${tripId}/members`);
}
export async function changeMemberRole(tripId: string, memberId: string, role: string): Promise<CreateTripResult> {
  if (!isUuid(memberId) || !okRole(role)) return { error: "요청을 처리하지 못했어요. 화면을 새로고침한 뒤 다시 시도해 주세요" };
  const r = await memberRpc("set_member_role", { p_member: memberId, p_role: role }, `/trips/${tripId}/members`);
  if ("error" in r) return r;
  revalidatePath("/", "layout");
}
export async function kickMember(tripId: string, memberId: string): Promise<CreateTripResult> {
  if (!isUuid(memberId)) return { error: "요청을 처리하지 못했어요. 화면을 새로고침한 뒤 다시 시도해 주세요" };
  const r = await memberRpc("remove_member", { p_member: memberId }, `/trips/${tripId}/members`);
  if ("error" in r) return r;
  revalidatePath("/", "layout");
}
export async function giveOwner(tripId: string, memberId: string): Promise<CreateTripResult> {
  if (!isUuid(memberId)) return { error: "요청을 처리하지 못했어요. 화면을 새로고침한 뒤 다시 시도해 주세요" };
  const r = await memberRpc("transfer_owner", { p_member: memberId }, `/trips/${tripId}/members`);
  if ("error" in r) return r;
  revalidatePath("/", "layout");
}
export async function leaveTrip(tripId: string): Promise<CreateTripResult> {
  if (!isUuid(tripId)) return { error: "요청을 처리하지 못했어요. 화면을 새로고침한 뒤 다시 시도해 주세요" };
  const r = await memberRpc("leave_trip", { p_trip: tripId }, `/trips/${tripId}/members`);
  if ("error" in r) return r;
  revalidatePath("/", "layout");
  redirect("/trips?left=1");
}
export async function joinInvite(token: string): Promise<CreateTripResult> {
  if (!/^[0-9a-f]{32}$/.test(token)) return { error: MEMBER_ERRORS.invite_not_found };
  const r = await memberRpc("accept_invite", { p_token: token }, `/invite/${token}`);
  if ("error" in r) {
    if (r.error === MEMBER_ERRORS.profile_required) redirect(`/welcome?next=/invite/${token}`);
    return r;
  }
  revalidatePath("/", "layout");
  redirect(`/trips/${r.data}?joined=1`);
}

/* ───────── 준비 탭 (2단계 6~7) : RLS 가 편집 권한을 검사 ───────── */
async function prepClient(tripId: string) {
  const sb = await createClient();
  if (!sb) return { error: "아직 로그인 서버가 연결되지 않았어요" } as const;
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect(`/login?next=/trips/${tripId}/prep`);
  return { sb, uid: auth.user.id } as const;
}
const PREP_FAIL = { error: "저장하지 못했어요. 수정할 권한이 없거나 잠시 문제가 생겼어요. 잠시 뒤 다시 시도해 주세요" };

export async function addPrepItem(tripId: string, kind: string, title: string, due: string | null): Promise<CreateTripResult> {
  const t = String(title ?? "").trim();
  if (!isUuid(tripId) || (kind !== "item" && kind !== "reservation")) return PREP_FAIL;
  if (![...t].length) return { error: "내용을 적어 주세요" };
  if ([...t].length > 80) return { error: "80자까지 쓸 수 있어요" };
  if (due && !/^\d{4}-\d{2}-\d{2}$/.test(due)) return { error: "날짜를 다시 골라 주세요" };
  const c = await prepClient(tripId); if (!c.sb) return { error: c.error };
  const { data: last } = await c.sb.from("checklist_items").select("sort_order").eq("trip_id", tripId).eq("kind", kind).is("removed_at", null).order("sort_order", { ascending: false }).limit(1).maybeSingle();
  const { error } = await c.sb.from("checklist_items").insert({ trip_id: tripId, kind, title: t, due_date: due || null, sort_order: (last?.sort_order ?? -1) + 1, created_by: c.uid });
  if (error) return PREP_FAIL;
  revalidatePath(`/trips/${tripId}/prep`);
}
/* 챙길 것 기본 목록 한 번에 넣기 (2026-11-16 마루님). 이미 있는 이름은 건너뛴다 */
export async function addPrepDefaults(tripId: string, titles: string[]): Promise<CreateTripResult> {
  if (!isUuid(tripId) || !Array.isArray(titles) || titles.length > 20) return PREP_FAIL;
  const list = [...new Set(titles.map((x) => String(x ?? "").trim()).filter((x) => x && [...x].length <= 80))];
  const c = await prepClient(tripId); if (!c.sb) return { error: c.error };
  const { data: had } = await c.sb.from("checklist_items").select("title, sort_order").eq("trip_id", tripId).eq("kind", "item").is("removed_at", null);
  const names = new Set((had ?? []).map((x) => x.title));
  let order = Math.max(-1, ...(had ?? []).map((x) => x.sort_order ?? -1));
  const rows = list.filter((t) => !names.has(t)).map((t) => ({ trip_id: tripId, kind: "item", title: t, sort_order: ++order, created_by: c.uid }));
  if (rows.length) { const { error } = await c.sb.from("checklist_items").insert(rows); if (error) return PREP_FAIL; }
  revalidatePath(`/trips/${tripId}/prep`);
}
/* 예약 지갑 저장 (0034) : 이름, 날짜, 예약번호, 메모, 첨부 파일. 빠진 파일은 저장소에서도 지운다 */
const BOOKING_FILE = (tripId: string) => new RegExp(`^${tripId}/[0-9a-f-]{36}\\.(jpg|png|webp|pdf)$`);
export async function saveBooking(tripId: string, id: string, input: { title: string; due: string; code: string; note: string; files: string[] }): Promise<CreateTripResult> {
  if (!isUuid(tripId) || !isUuid(id)) return PREP_FAIL;
  const title = String(input?.title ?? "").trim(), code = String(input?.code ?? "").trim(), note = String(input?.note ?? "").trim(), due = String(input?.due ?? "");
  if (![...title].length) return { error: "예약 이름을 적어 주세요" };
  if ([...title].length > 80) return { error: "예약 이름은 80자까지 쓸 수 있어요" };
  if ([...code].length > 60) return { error: "예약번호는 60자까지 쓸 수 있어요" };
  if ([...note].length > 500) return { error: "메모는 500자까지 쓸 수 있어요" };
  if (due && !/^\d{4}-\d{2}-\d{2}$/.test(due)) return { error: "날짜를 다시 골라 주세요" };
  const files = (Array.isArray(input?.files) ? input.files : []).map(String);
  if (files.length > 5) return { error: "파일은 5개까지 넣을 수 있어요" };
  if (files.some((f) => !BOOKING_FILE(tripId).test(f))) return { error: "파일을 다시 올려 주세요" };
  const c = await prepClient(tripId); if (!c.sb) return { error: c.error };
  const { data: prev } = await c.sb.from("checklist_items").select("files").eq("trip_id", tripId).eq("id", id).eq("kind", "reservation").is("removed_at", null).maybeSingle();
  if (!prev) return { error: "이 예약을 찾을 수 없어요. 이미 삭제됐을 수 있어요" };
  const { data, error } = await c.sb.from("checklist_items").update({ title, due_date: due || null, booking_code: code || null, note: note || null, files }).eq("trip_id", tripId).eq("id", id).select("id");
  if (error || !data?.length) return { error: "저장하지 못했어요. 수정할 권한이 없거나 잠시 문제가 생겼어요. 잠시 뒤 다시 시도해 주세요" };
  const gone = ((prev.files ?? []) as string[]).filter((f) => !files.includes(f));
  if (gone.length) await c.sb.storage.from("trip-files").remove(gone);
  revalidatePath(`/trips/${tripId}/prep`);
  redirect(`/trips/${tripId}/prep`);
}
export async function updatePrepItem(tripId: string, id: string, patch: { done?: boolean; assignee?: string | null; remove?: boolean; title?: string; due?: string | null }): Promise<CreateTripResult> {
  if (!isUuid(tripId) || !isUuid(id)) return PREP_FAIL;
  const t = patch.title === undefined ? undefined : String(patch.title).trim();
  if (t !== undefined && ![...t].length) return { error: "내용을 적어 주세요" };
  if (t !== undefined && [...t].length > 80) return { error: "80자까지 쓸 수 있어요" };
  if (patch.due && !/^\d{4}-\d{2}-\d{2}$/.test(patch.due)) return { error: "날짜를 다시 골라 주세요" };
  if (patch.assignee && !isUuid(patch.assignee)) return PREP_FAIL;
  const c = await prepClient(tripId); if (!c.sb) return { error: c.error };
  const row: Record<string, unknown> = {};
  if (patch.done !== undefined) row.done_at = patch.done ? new Date().toISOString() : null;
  if (patch.assignee !== undefined) row.assignee_id = patch.assignee;
  if (patch.remove) row.removed_at = new Date().toISOString();
  if (t !== undefined) row.title = t;
  if (patch.due !== undefined) row.due_date = patch.due || null;
  const { data, error } = await c.sb.from("checklist_items").update(row).eq("trip_id", tripId).eq("id", id).select("id");
  if (error || !data?.length) return PREP_FAIL;
  revalidatePath(`/trips/${tripId}/prep`);
}
export async function saveBudget(tripId: string, currency: string, amount: string): Promise<CreateTripResult> {
  if (!isUuid(tripId) || !/^[A-Z]{3}$/.test(currency)) return PREP_FAIL;
  const text = String(amount ?? "").replace(/,/g, "").trim();
  const d = decimalsOf(currency);
  if (!new RegExp(`^\\d{1,12}${d ? `(\\.\\d{1,${d}})?` : ""}$`).test(text)) return { error: "예산은 숫자로 적어 주세요" };
  const c = await prepClient(tripId); if (!c.sb) return { error: c.error };
  const { error } = await c.sb.from("trip_budgets").upsert({ trip_id: tripId, currency, total: Math.round(Number(text) * 10 ** d), updated_by: c.uid }, { onConflict: "trip_id" });
  if (error) return PREP_FAIL;
  revalidatePath(`/trips/${tripId}/prep`);
}

/* ───────── 경비 (6단계 3번, migration 0026) : 주인과 편집 가능만 (RLS + 트리거가 함께하는 사람인지 검사) ───────── */
export type ExpenseInput = { title: string; amount: string; currency: string; paidBy: string; splitWith: string[] };
export async function saveExpense(tripId: string, id: string | null, input: ExpenseInput): Promise<CreateTripResult> {
  if (!isUuid(tripId) || (id && !isUuid(id))) return PREP_FAIL;
  const title = String(input.title ?? "").trim();
  if (!title || [...title].length > 60) return { error: "내용은 1~60자로 적어 주세요" };
  if (!/^[A-Z]{3}$/.test(input.currency)) return PREP_FAIL;
  const d = decimalsOf(input.currency);
  const text = String(input.amount ?? "").replace(/,/g, "").trim();
  if (!new RegExp(`^\\d{1,12}${d ? `(\\.\\d{1,${d}})?` : ""}$`).test(text) || Number(text) <= 0) return { error: "금액을 숫자로 적어 주세요" };
  if (!isUuid(input.paidBy) || !input.splitWith.length || !input.splitWith.every(isUuid)) return { error: "낸 사람과 나눌 사람을 골라 주세요" };
  const c = await prepClient(tripId); if (!c.sb) return { error: c.error };
  const row = { title, amount: Math.round(Number(text) * 10 ** d), currency: input.currency, paid_by: input.paidBy, split_with: input.splitWith };
  const { error } = id
    ? await c.sb.from("trip_expenses").update(row).eq("trip_id", tripId).eq("id", id)
    : await c.sb.from("trip_expenses").insert({ trip_id: tripId, ...row });
  if (error?.message?.includes("not_member")) return { error: "함께하는 사람만 고를 수 있어요" };
  if (error) return PREP_FAIL;
  revalidatePath(`/trips/${tripId}/expenses`);
}
export async function removeExpense(tripId: string, id: string): Promise<CreateTripResult> {
  if (!isUuid(tripId) || !isUuid(id)) return PREP_FAIL;
  const c = await prepClient(tripId); if (!c.sb) return { error: c.error };
  const { data, error } = await c.sb.from("trip_expenses").update({ removed_at: new Date().toISOString() }).eq("trip_id", tripId).eq("id", id).select("id");
  if (error || !data?.length) return PREP_FAIL;
  revalidatePath(`/trips/${tripId}/expenses`);
}

/* ───────── 여행일기 (2단계) : 내 일기만 쓰고 고친다 (RLS) ───────── */
export type EntryInput = { kind: "day" | "recap"; day: number | null; title: string; body: string; visibility: string; photos: string[] };
export async function saveEntry(tripId: string, input: EntryInput): Promise<CreateTripResult> {
  if (!isUuid(tripId)) return PREP_FAIL;
  const kind = input?.kind === "recap" ? "recap" : "day";
  const day = kind === "day" ? Number(input?.day) : null;
  if (kind === "day" && (!Number.isInteger(day) || day! < 0 || day! >= MAX_TRIP_DAYS)) return { error: "날짜를 다시 골라 주세요" };
  const title = String(input?.title ?? "").trim();
  const body = String(input?.body ?? "").trim();
  const visibility = input?.visibility === "private" || input?.visibility === "public" ? input.visibility : "members";
  const photos = (Array.isArray(input?.photos) ? input.photos : []).map(String);
  if ([...title].length > 60) return { error: "제목은 60자까지 쓸 수 있어요" };
  if ([...body].length > 5000) return { error: "글은 5,000자까지 쓸 수 있어요" };
  if (!title && !body && !photos.length) return { error: "글이나 사진을 하나 이상 넣어 주세요" };
  if (photos.length > 10) return { error: "사진은 10장까지 올릴 수 있어요" };
  if (photos.some((p) => !new RegExp(`^${tripId}/j/[0-9a-f-]{36}\\.jpg$`).test(p))) return { error: "사진을 다시 올려 주세요" };
  const sb = await createClient();
  if (!sb) return { error: "아직 로그인 서버가 연결되지 않았어요" };
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect(`/login?next=/trips/${tripId}/diary`);
  const row = { title: title || null, body, visibility, photos };
  let q = sb.from("journal_entries").select("id").eq("trip_id", tripId).eq("author_id", auth.user.id).eq("kind", kind).is("removed_at", null);
  q = day == null ? q.is("day_index", null) : q.eq("day_index", day);
  const { data: prev } = await q.maybeSingle();
  const { data, error } = prev
    ? await sb.from("journal_entries").update(row).eq("id", prev.id).select("id").single()
    : await sb.from("journal_entries").insert({ ...row, trip_id: tripId, kind, day_index: day, author_id: auth.user.id }).select("id").single();
  if (error || !data) return { error: "저장하지 못했어요. 잠시 뒤 다시 시도해 주세요" };
  revalidatePath("/", "layout");
  redirect(`/diary/${data.id}?saved=1`);
}
export async function removeEntry(id: string): Promise<CreateTripResult> {
  if (!isUuid(id)) return PREP_FAIL;
  const sb = await createClient();
  if (!sb) return { error: "아직 로그인 서버가 연결되지 않았어요" };
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect("/login?next=/diary");
  const { data, error } = await sb.from("journal_entries").update({ removed_at: new Date().toISOString() }).eq("id", id).eq("author_id", auth.user.id).select("id");
  if (error || !data?.length) return { error: "삭제하지 못했어요. 잠시 뒤 다시 시도해 주세요" };
  revalidatePath("/", "layout");
  redirect("/diary?removed=1");
}

/* ───────── 일기 피드 (0022) : 좋아요, 댓글, 링크로 공개하고 공유. 누가 할 수 있는지는 DB(RLS)가 검사한다 ───────── */
const FEED_FAIL = { error: "하지 못했어요. 볼 수 없는 일기이거나 잠시 문제가 생겼어요" };
async function feedClient() {
  const sb = await createClient();
  if (!sb) return null;
  const { data: auth } = await sb.auth.getUser();
  return auth.user ? { sb, uid: auth.user.id } : null;
}
export async function toggleLike(entryId: string, on: boolean): Promise<CreateTripResult> {
  if (!isUuid(entryId)) return FEED_FAIL;
  const c = await feedClient(); if (!c) return { error: "로그인이 필요해요. 로그인한 뒤 다시 시도해 주세요" };
  const { error } = on
    ? await c.sb.from("journal_likes").upsert({ entry_id: entryId, user_id: c.uid }, { onConflict: "entry_id,user_id", ignoreDuplicates: true })
    : await c.sb.from("journal_likes").delete().eq("entry_id", entryId).eq("user_id", c.uid);
  if (error) return FEED_FAIL;
  revalidatePath("/diary", "layout");
}
export async function addComment(entryId: string, text: string, parentId?: string | null): Promise<CreateTripResult> {
  if (!isUuid(entryId) || (parentId && !isUuid(parentId))) return FEED_FAIL;
  const body = String(text ?? "").trim();
  if (!body) return { error: "댓글을 적어 주세요" };
  if ([...body].length > 500) return { error: "댓글은 500자까지 쓸 수 있어요" };
  const c = await feedClient(); if (!c) return { error: "로그인이 필요해요. 로그인한 뒤 다시 시도해 주세요" };
  const { error } = await c.sb.from("journal_comments").insert({ entry_id: entryId, author_id: c.uid, body, parent_id: parentId || null });
  if (error) {
    if (error.message?.includes("comment_limit")) return { error: "이 일기에는 댓글을 더 달 수 없어요" };
    if (error.message?.includes("reply_")) return { error: "답글을 달 수 없는 댓글이에요. 삭제됐을 수 있어요" };
    return FEED_FAIL;
  }
  revalidatePath("/diary", "layout");
}
export async function removeComment(id: string): Promise<CreateTripResult> {
  if (!isUuid(id)) return FEED_FAIL;
  const c = await feedClient(); if (!c) return { error: "로그인이 필요해요. 로그인한 뒤 다시 시도해 주세요" };
  const { data, error } = await c.sb.from("journal_comments").delete().eq("id", id).select("id");
  if (error || !data?.length) return { error: "삭제하지 못했어요. 잠시 뒤 다시 시도해 주세요" };
  revalidatePath("/diary", "layout");
}
/* 내 일기를 링크로 공개로 바꾸고 공유 주소를 돌려준다 (사진은 올릴 때 이미 위치 정보가 지워져 있다) */
export async function publishEntry(id: string): Promise<{ token?: string; error?: string }> {
  if (!isUuid(id)) return FEED_FAIL;
  const c = await feedClient(); if (!c) return { error: "로그인이 필요해요. 로그인한 뒤 다시 시도해 주세요" };
  const { data, error } = await c.sb.from("journal_entries").update({ visibility: "public" }).eq("id", id).eq("author_id", c.uid).is("removed_at", null).select("share_token").maybeSingle();
  if (error || !data?.share_token) return { error: "공개하지 못했어요. 잠시 뒤 다시 시도해 주세요" };
  revalidatePath("/diary", "layout");
  return { token: data.share_token as string };
}

/* ───────── 위치 도장 받기 (3단계 2) : 위치 확인은 DB 함수 claim_stamp 가 한다 ───────── */
export type ClaimResult =
  | { ok: true; status: "new" | "again" | "already"; city: string; country: string; visits: number; byMe: boolean }
  | { ok: false; code: string; error: string };
const STAMP_ERRORS: Record<string, string> = {
  not_member: "이 여행을 함께하는 사람만 도장을 받을 수 있어요",
  trip_removed: "삭제된 여행이에요",
  not_in_dates: "여행 기간에만 도장을 받을 수 있어요",
  low_accuracy: "위치가 정확하지 않아요. 밖에서 잠시 뒤 다시 눌러 주세요",
  bad_location: "위치를 읽지 못했어요. 다시 눌러 주세요",
  no_city: "이 여행의 도시는 아직 도장이 없어요. 목록에 있는 도시만 도장을 받을 수 있어요",
  too_far: "여행 도시에서 멀리 있어요. 도시 안에서 다시 눌러 주세요",
};
export async function claimStamp(tripId: string, lat: number, lng: number, accuracy: number): Promise<ClaimResult> {
  if (!isUuid(tripId) || ![lat, lng, accuracy].every((n) => typeof n === "number" && Number.isFinite(n)))
    return { ok: false, code: "bad_location", error: STAMP_ERRORS.bad_location };
  const sb = await createClient();
  if (!sb) return { ok: false, code: "server", error: "아직 로그인 서버가 연결되지 않았어요" };
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect(`/login?next=/trips/${tripId}`);
  const { data, error } = await sb.rpc("claim_stamp", { p_trip: tripId, p_lat: lat, p_lng: lng, p_accuracy: accuracy });
  if (error) {
    const code = Object.keys(STAMP_ERRORS).find((k) => error.message.includes(k)) ?? "server";
    return { ok: false, code, error: STAMP_ERRORS[code] ?? "도장을 받지 못했어요. 잠시 뒤 다시 눌러 주세요" };
  }
  const r = (Array.isArray(data) ? data[0] : data) as { status: "new" | "again" | "already"; city_name: string; country_code: string; visits: number; verified_by_me: boolean };
  revalidatePath("/stamps"); revalidatePath("/");
  return { ok: true, status: r.status, city: r.city_name, country: r.country_code, visits: r.visits, byMe: r.verified_by_me };
}

/* ───────── 장소 검색 (4단계 2~3) : 로그인한 사람만. 키는 서버에서만 쓴다 ───────── */
/* 구글 호출 전 하루 상한 검사 (migration 0017). 상한을 넘거나 검사를 못 하면 구글을 부르지 않는다 */
async function underPlaceQuota(sb: NonNullable<Awaited<ReturnType<typeof createClient>>>, kind: "autocomplete" | "details" | "hours"): Promise<boolean> {
  const { data, error } = await sb.rpc("take_place_quota", { p_kind: kind });
  return !error && data === true;
}
/*
  위치 없는 장소의 지도 위치를 이름으로 한 번에 찾기 (2026-11-15, 동선 정리용)
  - 이동(공항 → 역 같은 길), 메모는 빼고, 이름 앞 "점심:" 이나 괄호 안 후보는 떼고 찾는다
  - 첫 결과를 그대로 잇는다. 틀리면 장소 수정에서 [연결 끊기]
  - 사람당 하루 상세 횟수(take_place_quota details) 안에서만. 다 쓰면 멈추고 남은 수를 알려 준다
*/
export async function fillTripCoords(tripId: string): Promise<{ error?: string; filled?: number; missed?: number; left?: number; limited?: boolean }> {
  if (!isUuid(tripId)) return { error: "요청을 처리하지 못했어요. 화면을 새로고침한 뒤 다시 시도해 주세요" };
  const sb = await createClient();
  if (!sb) return { error: "아직 로그인 서버가 연결되지 않았어요" };
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return { error: "로그인이 필요해요. 로그인한 뒤 다시 시도해 주세요" };
  const { data: rows } = await sb.from("itinerary_items").select("id, title, category")
    .eq("trip_id", tripId).is("removed_at", null).is("google_place_id", null).not("category", "in", "(transport,memo)")
    .order("day_index", { nullsFirst: false }).order("sort_order").limit(100);
  const list = ((rows ?? []) as { id: string; title: string; category: string }[]).filter((r) => !/→|->/.test(r.title));
  if (!list.length) return { filled: 0, missed: 0, left: 0 };
  const { data: city } = await sb.from("trip_cities").select("*").eq("trip_id", tripId).order("sort_order").limit(1).maybeSingle();
  let bias: { lat: number; lng: number } | null = city?.lat != null ? { lat: city.lat, lng: city.lng } : null;
  if (!bias && city?.country_code) {
    const { data: c } = await sb.from("cities").select("lat, lng").eq("country_code", city.country_code).eq("name", city.name).maybeSingle();
    if (c?.lat != null) bias = { lat: c.lat, lng: c.lng };
  }
  const clean = (t: string) => t.replace(/^(아침|점심|저녁|간식|야식|브런치|카페)\s*[:：]\s*/, "").replace(/\(.*?\)/g, "").split(/\s+\/\s+|\s+또는\s+/)[0].trim();
  let filled = 0, missed = 0, limited = false;
  for (const r of list) {
    if (!(await underPlaceQuota(sb, "details"))) { limited = true; break; }
    const q = clean(r.title) || r.title;
    const hit = await searchOne(city?.name && !q.includes(city.name) ? `${q} ${city.name}` : q, bias);
    if (!hit) { missed++; continue; }
    const { error } = await sb.from("itinerary_items").update({ google_place_id: hit.id, lat: hit.lat, lng: hit.lng, coords_at: new Date().toISOString() })
      .eq("trip_id", tripId).eq("id", r.id).is("google_place_id", null);
    if (error) missed++; else filled++;
  }
  revalidatePath(`/trips/${tripId}`);
  return { filled, missed, left: list.length - filled - missed, limited };
}

/* 동선 정리에서 자리를 바꾼 장소의 시간 (칸의 시간은 그대로 두고 장소만 바꾼다) */
export async function setItemTimes(tripId: string, times: { id: string; time: string | null }[]): Promise<CreateTripResult> {
  if (!isUuid(tripId) || !Array.isArray(times) || times.length > 100 || times.some((t) => !isUuid(t.id) || (t.time !== null && !/^([01]\d|2[0-3]):[0-5]\d$/.test(t.time)))) return { error: "시간을 저장하지 못했어요. 화면을 새로고침한 뒤 다시 시도해 주세요" };
  const sb = await createClient();
  if (!sb) return { error: "아직 로그인 서버가 연결되지 않았어요" };
  for (const t of times) {
    const { error } = await sb.from("itinerary_items").update({ start_time: t.time }).eq("trip_id", tripId).eq("id", t.id);
    if (error) return { error: "시간을 저장하지 못했어요. 수정할 권한이 없거나 잠시 문제가 생겼어요. 잠시 뒤 다시 시도해 주세요" };
  }
  revalidatePath(`/trips/${tripId}`);
}

export type FindResult = Suggestion[] | { limited: true };
export async function findPlaces(input: string, session: string, kind: "place" | "city", bias?: { lat: number; lng: number } | null): Promise<FindResult> {
  const q = String(input ?? "").trim().slice(0, 80);
  if ([...q].length < 2 || !/^[0-9a-f-]{36}$/i.test(session)) return [];
  const sb = await createClient();
  const { data: auth } = sb ? await sb.auth.getUser() : { data: { user: null } };
  if (!auth.user || !sb) return [];
  if (!(await underPlaceQuota(sb, "autocomplete"))) return { limited: true };
  const b = bias && Number.isFinite(bias.lat) && Number.isFinite(bias.lng) ? bias : null;
  return autocomplete(q, session, kind === "city" ? "city" : "place", b);
}
export async function pickPlace(id: string, session: string): Promise<PlaceDetail | null> {
  const sb = await createClient();
  const { data: auth } = sb ? await sb.auth.getUser() : { data: { user: null } };
  if (!auth.user || !sb) return null;
  if (!(await underPlaceQuota(sb, "details"))) return null;
  return details(String(id), /^[0-9a-f-]{36}$/i.test(session) ? session : undefined);
}

/* ───────── 일부 일정만 공유 (4단계 7, migration 0015) ───────── */
const SHARE_ERRORS: Record<string, string> = {
  days_invalid: "공유할 날을 하루 이상 골라 주세요",
  too_many_shares: "공유 링크가 너무 많아요. 안 쓰는 링크를 끊고 다시 만들어 주세요",
  trip_removed: "삭제된 여행이에요",
  forbidden: "편집 가능 권한이 있어야 공유할 수 있어요",
};
/* days 가 null 이면 여행 전체 링크 (0018) */
export async function makeDayShare(tripId: string, days: number[] | null): Promise<{ error?: string; token?: string }> {
  if (!isUuid(tripId)) return { error: "요청을 처리하지 못했어요. 화면을 새로고침한 뒤 다시 시도해 주세요" };
  if (days !== null && (!Array.isArray(days) || !days.length || days.some((d) => !Number.isInteger(d) || d < 0 || d > 59))) return { error: SHARE_ERRORS.days_invalid };
  const sb = await createClient();
  if (!sb) return { error: "아직 로그인 서버가 연결되지 않았어요" };
  const { data, error } = await sb.rpc("create_trip_share", { p_trip: tripId, p_days: days });
  if (error) { const k = Object.keys(SHARE_ERRORS).find((x) => error.message.includes(x)); return { error: k ? SHARE_ERRORS[k] : "링크를 만들지 못했어요. 잠시 뒤 다시 시도해 주세요" }; }
  revalidatePath(`/trips/${tripId}/share`);
  return { token: String(data) };
}
export async function revokeDayShare(tripId: string, token: string): Promise<{ error?: string }> {
  if (!isUuid(tripId) || !/^[0-9a-f]{32}$/.test(token)) return { error: "요청을 처리하지 못했어요. 화면을 새로고침한 뒤 다시 시도해 주세요" };
  const sb = await createClient();
  if (!sb) return { error: "아직 로그인 서버가 연결되지 않았어요" };
  const { error } = await sb.rpc("revoke_trip_share", { p_trip: tripId, p_token: token });
  if (error) return { error: "링크를 끊지 못했어요. 잠시 뒤 다시 시도해 주세요" };
  revalidatePath(`/trips/${tripId}/share`);
  return {};
}

/* 알림 모두 읽음 (4단계 8) : 알림 화면을 열면 부른다 */
export async function readAllNotices(): Promise<void> {
  const sb = await createClient();
  if (!sb) return;
  await sb.rpc("mark_notifications_read");
  revalidatePath("/");
}
