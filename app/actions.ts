"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { PREVIEW_COOKIE, safeNext } from "@/lib/viewer";
import { countryOf, isoOf, decimalsOf } from "@/lib/countries";
import { MAX_TRIP_DAYS, MAX_CITIES, MAX_TRIP_TITLE, MAX_PLACE_TITLE, MAX_PLACE_ADDRESS, MAX_PLACE_MEMO } from "@/lib/rules";

/* 로그아웃 → 둘러보기 (홈) */
export async function signOut() {
  if (supabaseEnv()) {
    const sb = await createClient();
    await sb!.auth.signOut();
  }
  (await cookies()).delete(PREVIEW_COOKIE);
  redirect("/");
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
export type NewTrip = { title: string; start: string; end: string; cities: { name: string; country: string }[] };
export type CreateTripResult = { error: string } | undefined;

/* 여행 입력 검사 (만들기, 수정 같이). 통과하면 정리된 값, 아니면 오류 문구 */
function checkTrip(input: NewTrip): { error: string } | { title: string; start: string; end: string; cities: { name: string; country: string }[] } {
  const title = String(input?.title ?? "").trim();
  const cities = (Array.isArray(input?.cities) ? input.cities : [])
    .map((c) => ({ name: String(c?.name ?? "").trim(), country: String(c?.country ?? "") }))
    .filter((c) => c.name);
  const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + "T00:00:00Z"));
  const { start, end } = input ?? {};

  if (!cities.length) return { error: "도시를 하나 이상 넣어 주세요" };
  if (cities.length > MAX_CITIES) return { error: `도시는 ${MAX_CITIES}개까지 넣을 수 있어요` };
  if (cities.some((c) => [...c.name].length > 40)) return { error: "도시 이름은 40자까지 쓸 수 있어요" };
  if (cities.some((c) => !countryOf(c.country))) return { error: "도시마다 나라를 골라 주세요" };
  if (!isDate(start) || !isDate(end) || end < start) return { error: "여행 기간을 다시 골라 주세요" };
  if ((Date.parse(end) - Date.parse(start)) / 86400000 + 1 > MAX_TRIP_DAYS) return { error: `여행 기간은 ${MAX_TRIP_DAYS}일까지 정할 수 있어요` };
  if (![...title].length) return { error: "여행 이름을 적어 주세요" };
  if ([...title].length > MAX_TRIP_TITLE) return { error: `여행 이름은 ${MAX_TRIP_TITLE}자까지 쓸 수 있어요` };
  return { title, start, end, cities };
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
    p_cities: cities.map((c) => ({ name: c.name, country_code: isoOf(c.country) })),
  });
  if (error || !data) {
    if (error?.message?.includes("profile_required")) redirect("/welcome?next=/trips/new");
    return { error: "저장하지 못했어요. 잠시 뒤 다시 시도해 주세요" };
  }
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
    p_cities: c.cities.map((x) => ({ name: x.name, country_code: isoOf(x.country) })),
  });
  if (error) {
    if (error.message?.includes("forbidden")) return { error: "이 여행을 고칠 권한이 없어요" };
    return { error: "저장하지 못했어요. 잠시 뒤 다시 시도해 주세요" };
  }
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

/* ---------- 장소 (S08) : 추가, 수정, 삭제. 권한은 DB 규칙(RLS)이 막는다 ---------- */
export type PlaceInput = {
  title: string; address: string; category: string; time: string; cost: string; currency: string; memo: string;
  day: number | null; // 0 = 1일차, null = 날짜 미정
};
const CATEGORIES = ["transport", "food", "sight", "shopping", "stay"];

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
  const row = {
    title, address: address || null, memo: memo || null, category: input.category, start_time: time || null,
    estimated_cost: cost, cost_currency: cost == null ? null : currency, day_index: day,
  };

  if (placeId) {
    const { data: prev } = await sb.from("itinerary_items").select("day_index").eq("trip_id", tripId).eq("id", placeId).is("removed_at", null).maybeSingle();
    if (!prev) return { error: "이 장소를 찾을 수 없어요. 이미 삭제됐을 수 있어요" };
    const patch = prev.day_index === day ? row : { ...row, sort_order: await lastOrder() };
    const { data, error } = await sb.from("itinerary_items").update(patch).eq("trip_id", tripId).eq("id", placeId).select("id");
    if (error || !data?.length) return { error: "저장하지 못했어요. 고칠 권한이 없거나 잠시 문제가 생겼어요" };
  } else {
    const { error } = await sb.from("itinerary_items").insert({ ...row, trip_id: tripId, sort_order: await lastOrder(), created_by: auth.user.id });
    if (error) return { error: "저장하지 못했어요. 고칠 권한이 없거나 잠시 문제가 생겼어요" };
  }
  revalidatePath("/", "layout");
  redirect(`/trips/${tripId}?${day == null ? "undated=1#undated" : `day=${day + 1}`}`);
}

export async function removePlace(tripId: string, placeId: string, day: number | null): Promise<CreateTripResult> {
  const sb = await createClient();
  if (!sb) return { error: "아직 로그인 서버가 연결되지 않아 삭제할 수 없어요" };
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect(`/login?next=/trips/${tripId}`);
  const { data, error } = await sb.from("itinerary_items").update({ removed_at: new Date().toISOString() })
    .eq("trip_id", tripId).eq("id", placeId).is("removed_at", null).select("id");
  if (error || !data?.length) return { error: "삭제하지 못했어요. 잠시 뒤 다시 시도해 주세요" };
  revalidatePath("/", "layout");
  redirect(`/trips/${tripId}?removed=1${day == null ? "&undated=1#undated" : `&day=${day + 1}`}`);
}

/* 장소 순서 바꾸기 (S07). 한 날의 장소 id 를 새 순서대로. DB 함수 reorder_items 가 한 번에 저장 */
export async function reorderPlaces(tripId: string, ids: string[]): Promise<CreateTripResult> {
  const uuid = /^[0-9a-f-]{36}$/i;
  if (!uuid.test(tripId) || !Array.isArray(ids) || !ids.length || ids.length > 500 || !ids.every((x) => uuid.test(String(x)))) {
    return { error: "순서를 저장하지 못했어요" };
  }
  const sb = await createClient();
  if (!sb) return { error: "아직 로그인 서버가 연결되지 않아 저장할 수 없어요" };
  const { error } = await sb.rpc("reorder_items", { p_trip: tripId, p_ids: ids });
  if (error) return { error: error.message?.includes("forbidden") ? "이 여행을 고칠 권한이 없어요" : "순서를 저장하지 못했어요. 원래 자리로 돌려놨어요" };
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
