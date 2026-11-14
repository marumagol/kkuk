"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { PREVIEW_COOKIE, safeNext } from "@/lib/viewer";
import { countryOf, isoOf, decimalsOf, ICON_PATH, MAX_COUNTRY_NAME } from "@/lib/countries";
import { AVATAR_PATH } from "@/lib/storage";
import { MAX_TRIP_DAYS, MAX_CITIES, MAX_TRIP_TITLE, MAX_PLACE_TITLE, MAX_PLACE_ADDRESS, MAX_PLACE_MEMO, MAX_PLACE_PHOTOS } from "@/lib/rules";

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
/* 도시 : country 는 나라 목록 코드. 직접 입력한 나라는 country "ETC" + countryName (+ 올린 아이콘 icon) */
export type TripCity = { name: string; country: string; countryName?: string; icon?: string };
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
    p_cities: cities.map((c) => ({ name: c.name, country_code: isoOf(c.country) })),
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
    p_cities: c.cities.map((x) => ({ name: x.name, country_code: isoOf(x.country) })),
  });
  if (error) {
    if (error.message?.includes("forbidden")) return { error: "이 여행을 고칠 권한이 없어요" };
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

/* ---------- 장소 (S08) : 추가, 수정, 삭제. 권한은 DB 규칙(RLS)이 막는다 ---------- */
export type PlaceInput = {
  title: string; address: string; category: string; time: string; cost: string; currency: string; memo: string;
  day: number | null; // 0 = 1일차, null = 날짜 미정
  photos?: string[]; // 저장소 place-photos 안 위치 (<여행 id>/<그림 id>.jpg), 순서대로 최대 5장
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
  const photos = (Array.isArray(input?.photos) ? input.photos : []).map(String);
  if (photos.length > MAX_PLACE_PHOTOS) return { error: `사진은 ${MAX_PLACE_PHOTOS}장까지 올릴 수 있어요` };
  if (photos.some((x) => !new RegExp(`^${tripId}/[0-9a-f-]{36}\\.(jpg|png|webp)$`).test(x))) return { error: "사진을 다시 올려 주세요" };
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
    estimated_cost: cost, cost_currency: cost == null ? null : currency, day_index: day, photos,
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
  if (!isUuid(tripId) || !okRole(role)) return { error: "다시 시도해 주세요" };
  const r = await memberRpc("create_invite", { p_trip: tripId, p_role: role }, `/trips/${tripId}/members`);
  if ("error" in r) return r;
  revalidatePath(`/trips/${tripId}/members`);
  return { token: String(r.data) };
}
export async function revokeInvite(tripId: string): Promise<CreateTripResult> {
  if (!isUuid(tripId)) return { error: "다시 시도해 주세요" };
  const r = await memberRpc("revoke_invite", { p_trip: tripId }, `/trips/${tripId}/members`);
  if ("error" in r) return r;
  revalidatePath(`/trips/${tripId}/members`);
}
export async function changeMemberRole(tripId: string, memberId: string, role: string): Promise<CreateTripResult> {
  if (!isUuid(memberId) || !okRole(role)) return { error: "다시 시도해 주세요" };
  const r = await memberRpc("set_member_role", { p_member: memberId, p_role: role }, `/trips/${tripId}/members`);
  if ("error" in r) return r;
  revalidatePath("/", "layout");
}
export async function kickMember(tripId: string, memberId: string): Promise<CreateTripResult> {
  if (!isUuid(memberId)) return { error: "다시 시도해 주세요" };
  const r = await memberRpc("remove_member", { p_member: memberId }, `/trips/${tripId}/members`);
  if ("error" in r) return r;
  revalidatePath("/", "layout");
}
export async function giveOwner(tripId: string, memberId: string): Promise<CreateTripResult> {
  if (!isUuid(memberId)) return { error: "다시 시도해 주세요" };
  const r = await memberRpc("transfer_owner", { p_member: memberId }, `/trips/${tripId}/members`);
  if ("error" in r) return r;
  revalidatePath("/", "layout");
}
export async function leaveTrip(tripId: string): Promise<CreateTripResult> {
  if (!isUuid(tripId)) return { error: "다시 시도해 주세요" };
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
const PREP_FAIL = { error: "저장하지 못했어요. 고칠 권한이 없거나 잠시 문제가 생겼어요" };

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
export async function updatePrepItem(tripId: string, id: string, patch: { done?: boolean; assignee?: string | null; remove?: boolean }): Promise<CreateTripResult> {
  if (!isUuid(tripId) || !isUuid(id)) return PREP_FAIL;
  if (patch.assignee && !isUuid(patch.assignee)) return PREP_FAIL;
  const c = await prepClient(tripId); if (!c.sb) return { error: c.error };
  const row: Record<string, unknown> = {};
  if (patch.done !== undefined) row.done_at = patch.done ? new Date().toISOString() : null;
  if (patch.assignee !== undefined) row.assignee_id = patch.assignee;
  if (patch.remove) row.removed_at = new Date().toISOString();
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

/* ───────── 여행일기 (2단계) : 내 일기만 쓰고 고친다 (RLS) ───────── */
export type EntryInput = { kind: "day" | "recap"; day: number | null; title: string; body: string; visibility: string; photos: string[] };
export async function saveEntry(tripId: string, input: EntryInput): Promise<CreateTripResult> {
  if (!isUuid(tripId)) return PREP_FAIL;
  const kind = input?.kind === "recap" ? "recap" : "day";
  const day = kind === "day" ? Number(input?.day) : null;
  if (kind === "day" && (!Number.isInteger(day) || day! < 0 || day! >= MAX_TRIP_DAYS)) return { error: "날짜를 다시 골라 주세요" };
  const title = String(input?.title ?? "").trim();
  const body = String(input?.body ?? "").trim();
  const visibility = input?.visibility === "private" ? "private" : "members";
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
