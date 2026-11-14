/*
  여행 읽기 (서버 전용). 보는 사람에 따라
  - user    : Supabase DB (RLS 가 내가 함께하는 여행만 보여 준다)
  - preview : lib/mock.ts 가짜 여행 (Supabase 연결 전 화면 확인용)
  - guest   : 없음
  화면은 모두 lib/mock.ts 의 Trip 모양으로 받는다
*/
import { cache } from "react";
import type { Category } from "@/components/kit";
import { createClient } from "@/lib/supabase/server";
import { TRIPS, getTrip, daysBetween, type Trip, type Item } from "@/lib/mock";
import { currencyOf, formatMoney, iconUrl } from "@/lib/countries";
import { avatarUrl } from "@/lib/storage";
import type { Viewer } from "@/lib/viewer";

const CATEGORY: Record<string, Category> = { transport: "이동", food: "식사", sight: "관광", shopping: "쇼핑", stay: "숙소" };

type Row = {
  id: string; title: string; start_date: string; end_date: string; time_zone: string; removed_at: string | null;
  trip_cities: { name: string; sort_order: number; country_code: string | null; country_icon: string | null }[];
  trip_members: { user_id: string | null; display_name: string; role: string; removed_at: string | null; created_at: string }[];
};

const members = (r: Row) =>
  r.trip_members
    .filter((m) => !m.removed_at)
    .sort((a, b) => (a.role === "owner" ? -1 : b.role === "owner" ? 1 : a.created_at.localeCompare(b.created_at)))
    .map((m, i) => ({ initial: [...m.display_name][0] ?? "?", tone: (i % 2 ? "accent" : "point") as "point" | "accent", userId: m.user_id ?? undefined }));

/* 함께하는 사람 얼굴 사진 (0010 부터 서로 볼 수 있음). 실패하면 글자 그대로 */
async function faces(sb: NonNullable<Awaited<ReturnType<typeof createClient>>>, ids: string[]): Promise<Map<string, string>> {
  const m = new Map<string, string>();
  if (!ids.length) return m;
  const { data } = await sb.from("profiles").select("user_id, avatar_url").in("user_id", ids);
  (data ?? []).forEach((p: { user_id: string; avatar_url: string | null }) => { const u = avatarUrl(p.avatar_url); if (u) m.set(p.user_id, u); });
  return m;
}

const firstCity = (r: Row) => [...r.trip_cities].sort((a, b) => a.sort_order - b.sort_order)[0];
const base = (r: Row): Trip => ({
  id: r.id, country: firstCity(r)?.country_code ?? undefined, countryIcon: iconUrl(firstCity(r)?.country_icon) ?? undefined, title: r.title, start: r.start_date, end: r.end_date, timeZone: r.time_zone,
  cities: [...r.trip_cities].sort((a, b) => a.sort_order - b.sort_order).map((c) => c.name),
  members: members(r), days: [], undated: [],
});

const SELECT = "id, title, start_date, end_date, time_zone, removed_at, trip_cities(name, sort_order, country_code, country_icon), trip_members(user_id, display_name, role, removed_at, created_at)";

/* 내 여행 목록 (삭제된 여행 빼고) */
export const loadTrips = cache(async (v: Viewer): Promise<Trip[]> => {
  if (v.kind === "preview") return TRIPS;
  if (v.kind !== "user") return [];
  const sb = (await createClient())!;
  const { data, error } = await sb.from("trips").select(SELECT).is("removed_at", null).order("start_date");
  if (error) throw new Error("trips_load_failed");
  const rows = (data ?? []) as unknown as Row[];
  if (!rows.length) return [];
  // 장소 수만 따로 센다 (trip_id 조건 명시)
  const { data: items } = await sb.from("itinerary_items").select("trip_id").in("trip_id", rows.map((r) => r.id)).is("removed_at", null);
  const count = new Map<string, number>();
  (items ?? []).forEach((i: { trip_id: string }) => count.set(i.trip_id, (count.get(i.trip_id) ?? 0) + 1));
  return rows.map((r) => ({ ...base(r), places: count.get(r.id) ?? 0 }));
});

export type Role = "owner" | "editor" | "viewer";
export type PlaceRow = {
  id: string; day_index: number | null; sort_order: number; title: string; address: string | null; category: string;
  start_time: string | null; estimated_cost: number | null; cost_currency: string | null; memo: string | null; photos: string[]; updated_by?: string | null; updated_at?: string;
};

/* 장소 사진 (비공개 저장소) : 1시간짜리 주소로 바꿔서 보여 준다 */
async function photoUrls(sb: NonNullable<Awaited<ReturnType<typeof createClient>>>, paths: string[]): Promise<Map<string, string>> {
  const m = new Map<string, string>();
  if (!paths.length) return m;
  const { data } = await sb.storage.from("place-photos").createSignedUrls(paths, 3600);
  (data ?? []).forEach((d) => { if (d.path && d.signedUrl) m.set(d.path, d.signedUrl); });
  return m;
}
export type TripResult = { trip: Trip; role: Role } | { missing: "none" | "removed" };

/* 여행 하나와 일자별 장소 */
export const loadTrip = cache(async (v: Viewer, id: string): Promise<TripResult> => {
  if (v.kind === "preview") { const t = getTrip(id); return t ? { trip: t, role: "owner" } : { missing: "none" }; }
  if (v.kind !== "user" || !/^[0-9a-f-]{36}$/i.test(id)) return { missing: "none" };
  const sb = (await createClient())!;
  const { data, error } = await sb.from("trips").select(SELECT).eq("id", id).maybeSingle();
  if (error) throw new Error("trip_load_failed");
  if (!data) return { missing: "none" };
  const r = data as unknown as Row;
  if (r.removed_at) return { missing: "removed" };

  const { data: rows } = await sb.from("itinerary_items")
    .select("id, day_index, sort_order, title, address, category, start_time, estimated_cost, cost_currency, memo, photos, updated_by, updated_at")
    .eq("trip_id", id).is("removed_at", null).order("sort_order");
  // 누가 고쳤는지 : 다른 사람이 24시간 안에 고친 장소에 이름 (2단계)
  const names = new Map(r.trip_members.filter((m) => m.user_id).map((m) => [m.user_id!, m.display_name]));
  const dayAgo = Date.now() - 24 * 3600 * 1000;
  const editorOf = (it: PlaceRow) => it.updated_by && it.updated_by !== v.id && it.updated_at && Date.parse(it.updated_at) > dayAgo ? names.get(it.updated_by) : undefined;
  const trip = base(r);
  const face = await faces(sb, trip.members.flatMap((m) => (m.userId ? [m.userId] : [])));
  trip.members = trip.members.map((m) => ({ ...m, avatar: m.userId ? face.get(m.userId) : undefined }));
  const len = daysBetween(trip.start, trip.end) + 1;
  trip.days = Array.from({ length: len }, () => ({ items: [] as Item[] }));
  const photos = await photoUrls(sb, ((rows ?? []) as PlaceRow[]).flatMap((it) => it.photos ?? []));
  for (const it of (rows ?? []) as PlaceRow[]) {
    const cost = it.estimated_cost != null && it.cost_currency ? `예상 ${formatMoney(it.estimated_cost, it.cost_currency)}` : "";
    const desc = [it.address, cost, it.memo?.split("\n")[0]].filter(Boolean).join(" · ");
    const item: Item = { id: it.id, title: it.title, category: CATEGORY[it.category] ?? "관광", time: it.start_time?.slice(0, 5), desc: desc || undefined, editedBy: editorOf(it), photos: (it.photos ?? []).map((x) => ({ path: x, url: photos.get(x) ?? "" })).filter((x) => x.url) };
    if (it.day_index != null && it.day_index < len) trip.days[it.day_index].items.push(item);
    else trip.undated.push(item);
  }
  const { data: me } = await sb.from("trip_members").select("role").eq("trip_id", id).eq("user_id", v.id).is("removed_at", null).maybeSingle();
  return { trip, role: (me?.role ?? "viewer") as Role };
});

/* 여행 정보 수정 화면용 : 도시의 나라 코드와 일차별 장소 수까지 */
export type TripForEdit = {
  id: string; title: string; start: string; end: string; timeZone: string; role: Role;
  cities: { name: string; country: string; countryName?: string; icon?: string }[];
  dayCounts: number[]; // 일차별 장소 수 (0 = 1일차)
};
export const loadTripForEdit = cache(async (v: Viewer, id: string): Promise<TripForEdit | null> => {
  if (v.kind !== "user" || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const r = await loadTrip(v, id);
  if (!("trip" in r)) return null;
  const sb = (await createClient())!;
  const { data: cities } = await sb.from("trip_cities").select("name, country_code, country_name, country_icon, sort_order").eq("trip_id", id).order("sort_order");
  const t = r.trip;
  return {
    id, title: t.title, start: t.start, end: t.end, timeZone: t.timeZone ?? "Asia/Seoul", role: r.role,
    cities: (cities ?? []).map((c: { name: string; country_code: string | null; country_name: string | null; country_icon: string | null }, i: number) => ({
      name: c.name, countryName: c.country_name ?? undefined, icon: c.country_icon ?? undefined,
      // 화면의 나라 목록 코드로 되돌림 (하와이는 시간대로 구분, 나라 코드 없음 = 그 밖의 나라)
      country: !c.country_code ? "ETC" : c.country_code === "US" && i === 0 && t.timeZone === "Pacific/Honolulu" ? "US-HI" : c.country_code,
    })),
    dayCounts: t.days.map((d) => d.items.length),
  };
});

/* 장소 추가/수정 화면용 : 여행 기본 정보, 기본 통화, (수정이면) 그 장소 */
export type PlaceContext = {
  tripId: string; tripTitle: string; start: string; days: number; role: Role; currency: string; place?: PlaceRow; photos?: { path: string; url: string }[];
};
export const loadPlaceContext = cache(async (v: Viewer, tripId: string, placeId?: string): Promise<PlaceContext | null> => {
  if (v.kind !== "user" || !/^[0-9a-f-]{36}$/i.test(tripId)) return null;
  if (placeId && !/^[0-9a-f-]{36}$/i.test(placeId)) return null;
  const r = await loadTrip(v, tripId);
  if (!("trip" in r)) return null;
  const sb = (await createClient())!;
  const { data: city } = await sb.from("trip_cities").select("country_code").eq("trip_id", tripId).order("sort_order").limit(1).maybeSingle();
  let place: PlaceRow | undefined;
  if (placeId) {
    const { data } = await sb.from("itinerary_items")
      .select("id, day_index, sort_order, title, address, category, start_time, estimated_cost, cost_currency, memo, photos")
      .eq("trip_id", tripId).eq("id", placeId).is("removed_at", null).maybeSingle();
    if (!data) return null;
    place = data as PlaceRow;
  }
  const t = r.trip;
  const photos = placeId ? [...t.days.flatMap((d) => d.items), ...t.undated].find((it) => it.id === placeId)?.photos : undefined;
  return { tripId, tripTitle: t.title, start: t.start, days: t.days.length, role: r.role, currency: currencyOf(city?.country_code), place, photos };
});

/* 함께하는 사람 화면 (2단계) : 목록, 내 권한, (주인이면) 살아 있는 초대 링크 */
export type Member = { id: string; name: string; role: Role; isMe: boolean; avatar?: string; userId?: string };
export type MembersView = {
  tripId: string; tripTitle: string; role: Role; members: Member[];
  invite: { token: string; role: "editor" | "viewer"; expiresAt: string } | null;
};
export const loadMembers = cache(async (v: Viewer, tripId: string): Promise<MembersView | null> => {
  if (v.kind !== "user" || !/^[0-9a-f-]{36}$/i.test(tripId)) return null;
  const r = await loadTrip(v, tripId);
  if (!("trip" in r)) return null;
  const sb = (await createClient())!;
  const { data: rows } = await sb.from("trip_members").select("id, user_id, display_name, role, created_at")
    .eq("trip_id", tripId).is("removed_at", null).order("created_at");
  const order: Record<string, number> = { owner: 0, editor: 1, viewer: 2 };
  const members = ((rows ?? []) as { id: string; user_id: string | null; display_name: string; role: Role }[])
    .map((m) => ({ id: m.id, name: m.display_name, role: m.role, isMe: m.user_id === v.id, userId: m.user_id ?? undefined, avatar: r.trip.members.find((x) => x.userId && x.userId === m.user_id)?.avatar }))
    .sort((a, b) => order[a.role] - order[b.role]);
  let invite: MembersView["invite"] = null;
  if (r.role === "owner") {
    const { data } = await sb.from("trip_invites").select("token, role, expires_at")
      .eq("trip_id", tripId).is("revoked_at", null).gt("expires_at", new Date().toISOString()).maybeSingle();
    if (data) invite = { token: data.token, role: data.role, expiresAt: data.expires_at };
  }
  return { tripId, tripTitle: r.trip.title, role: r.role, members, invite };
});

/* 준비 탭 (2단계 6~7) : 챙길 것, 예약, 예산 */
export type PrepItem = { id: string; kind: "item" | "reservation"; title: string; due: string | null; assignee: string | null; done: boolean };
export type PrepView = {
  tripId: string; tripTitle: string; start: string; end: string; role: Role; currency: string;
  items: PrepItem[]; budget: { currency: string; total: number } | null;
  spent: number; // 예산 통화로 적은 장소 예상 비용 합 (최소 단위)
  people: { userId: string; name: string }[];
};
export const loadPrep = cache(async (v: Viewer, tripId: string): Promise<PrepView | null> => {
  if (v.kind !== "user" || !/^[0-9a-f-]{36}$/i.test(tripId)) return null;
  const r = await loadTrip(v, tripId);
  if (!("trip" in r)) return null;
  const sb = (await createClient())!;
  const [{ data: rows }, { data: budget }, { data: city }, mv] = await Promise.all([
    sb.from("checklist_items").select("id, kind, title, due_date, assignee_id, done_at, sort_order, created_at")
      .eq("trip_id", tripId).is("removed_at", null).order("sort_order").order("created_at"),
    sb.from("trip_budgets").select("currency, total").eq("trip_id", tripId).maybeSingle(),
    sb.from("trip_cities").select("country_code").eq("trip_id", tripId).order("sort_order").limit(1).maybeSingle(),
    loadMembers(v, tripId),
  ]);
  const currency = budget?.currency ?? currencyOf(city?.country_code);
  const { data: costs } = await sb.from("itinerary_items").select("estimated_cost").eq("trip_id", tripId).is("removed_at", null).eq("cost_currency", currency);
  const spent = (costs ?? []).reduce((n: number, c: { estimated_cost: number | null }) => n + (c.estimated_cost ?? 0), 0);
  return {
    tripId, tripTitle: r.trip.title, start: r.trip.start, end: r.trip.end, role: r.role, currency,
    items: ((rows ?? []) as { id: string; kind: "item" | "reservation"; title: string; due_date: string | null; assignee_id: string | null; done_at: string | null }[])
      .map((x) => ({ id: x.id, kind: x.kind, title: x.title, due: x.due_date, assignee: x.assignee_id, done: !!x.done_at })),
    budget: budget ? { currency: budget.currency, total: Number(budget.total) } : null,
    spent,
    people: (mv?.members ?? []).flatMap((m) => (m.userId ? [{ userId: m.userId, name: m.name }] : [])),
  };
});
