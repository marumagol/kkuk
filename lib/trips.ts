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
import { placesEnabled, details } from "@/lib/places";
import { detailLine } from "@/lib/place-fields";
import type { Viewer } from "@/lib/viewer";

const CATEGORY: Record<string, Category> = { transport: "이동", food: "식사", sight: "관광", shopping: "쇼핑", stay: "숙소", memo: "메모" };

type Row = {
  id: string; title: string; start_date: string; end_date: string; time_zone: string; removed_at: string | null;
  trip_cities: { name: string; sort_order: number; country_code: string | null; country_icon: string | null }[];
  trip_members: { user_id: string | null; display_name: string; role: string; removed_at: string | null; created_at: string }[];
};

const members = (r: Row) =>
  r.trip_members
    .filter((m) => !m.removed_at)
    .sort((a, b) => (a.role === "owner" ? -1 : b.role === "owner" ? 1 : a.created_at.localeCompare(b.created_at)))
    .map((m, i) => ({ initial: [...m.display_name][0] ?? "?", name: m.display_name, tone: (i % 2 ? "accent" : "point") as "point" | "accent", userId: m.user_id ?? undefined }));

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
  google_place_id?: string | null; lat?: number | null; lng?: number | null;
  details?: Record<string, string> | null; /* 분류별 맞춤 칸 (0030) */
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
  // 여행, 장소, 내 권한은 서로 기다릴 필요가 없어 한꺼번에 묻는다 (성능 : 왕복 5번 → 2번)
  const [{ data, error }, { data: rows, error: itemsError }, { data: me }] = await Promise.all([
    sb.from("trips").select(SELECT).eq("id", id).maybeSingle(),
    sb.from("itinerary_items")
      .select("id, day_index, sort_order, title, address, category, start_time, estimated_cost, cost_currency, memo, photos, updated_by, updated_at, lat, lng, details, google_place_id")
      .eq("trip_id", id).is("removed_at", null).order("sort_order"),
    sb.from("trip_members").select("role").eq("trip_id", id).eq("user_id", v.id).is("removed_at", null).maybeSingle(),
  ]);
  if (error) throw new Error("trip_load_failed");
  if (!data) return { missing: "none" };
  const r = data as unknown as Row;
  if (r.removed_at) return { missing: "removed" };
  // 장소를 못 읽었는데 빈 일정으로 보이면 지워진 줄 안다 → 오류 화면(다시 시도)으로
  if (itemsError) throw new Error("trip_items_load_failed");
  // 누가 고쳤는지 : 다른 사람이 24시간 안에 고친 장소에 이름 (2단계)
  const names = new Map(r.trip_members.filter((m) => m.user_id).map((m) => [m.user_id!, m.display_name]));
  const dayAgo = Date.now() - 24 * 3600 * 1000;
  const editorOf = (it: PlaceRow) => it.updated_by && it.updated_by !== v.id && it.updated_at && Date.parse(it.updated_at) > dayAgo ? names.get(it.updated_by) : undefined;
  const trip = base(r);
  const [face, photos] = await Promise.all([
    faces(sb, trip.members.flatMap((m) => (m.userId ? [m.userId] : []))),
    photoUrls(sb, ((rows ?? []) as PlaceRow[]).flatMap((it) => it.photos ?? [])),
  ]);
  trip.members = trip.members.map((m) => ({ ...m, avatar: m.userId ? face.get(m.userId) : undefined }));
  const len = daysBetween(trip.start, trip.end) + 1;
  trip.days = Array.from({ length: len }, () => ({ items: [] as Item[] }));
  for (const it of (rows ?? []) as PlaceRow[]) {
    const cost = it.estimated_cost != null && it.cost_currency ? `예상 ${formatMoney(it.estimated_cost, it.cost_currency)}` : "";
    const desc = it.category === "memo" ? it.memo ?? "" : [it.address, cost, it.memo?.split("\n")[0]].filter(Boolean).join(" · ");
    const item: Item = { id: it.id, title: it.title, category: CATEGORY[it.category] ?? "관광", detail: detailLine(it.category, it.details) || undefined, time: it.start_time?.slice(0, 5), desc: desc || undefined, editedBy: editorOf(it), addr: it.address || undefined, gpid: it.google_place_id || undefined, ...(it.estimated_cost != null && it.cost_currency ? { cost: it.estimated_cost, cur: it.cost_currency } : {}), hours: it.details?._hours || undefined, ...(it.lat != null && it.lng != null ? { lat: it.lat, lng: it.lng } : {}), photos: (it.photos ?? []).map((x) => ({ path: x, url: photos.get(x) ?? "" })).filter((x) => x.url) };
    if (it.day_index != null && it.day_index < len) trip.days[it.day_index].items.push(item);
    else trip.undated.push(item);
  }
  return { trip, role: (me?.role ?? "viewer") as Role };
});

/* 여행 정보 수정 화면용 : 도시의 나라 코드와 일차별 장소 수까지 */
export type TripForEdit = {
  id: string; title: string; start: string; end: string; timeZone: string; role: Role;
  cities: { name: string; country: string; countryName?: string; icon?: string; placeId?: string; lat?: number; lng?: number }[];
  searchable: boolean;
  dayCounts: number[]; // 일차별 장소 수 (0 = 1일차)
};
export const loadTripForEdit = cache(async (v: Viewer, id: string): Promise<TripForEdit | null> => {
  if (v.kind !== "user" || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const r = await loadTrip(v, id);
  if (!("trip" in r)) return null;
  const sb = (await createClient())!;
  const { data: cities } = await sb.from("trip_cities").select("*").eq("trip_id", id).order("sort_order");
  const t = r.trip;
  return {
    id, title: t.title, start: t.start, end: t.end, timeZone: t.timeZone ?? "Asia/Seoul", role: r.role,
    searchable: placesEnabled(),
    cities: (cities ?? []).map((c: { name: string; country_code: string | null; country_name: string | null; country_icon: string | null; google_place_id?: string | null; lat?: number | null; lng?: number | null }, i: number) => ({
      name: c.name, countryName: c.country_name ?? undefined, icon: c.country_icon ?? undefined,
      ...(c.google_place_id && c.lat != null && c.lng != null ? { placeId: c.google_place_id, lat: c.lat, lng: c.lng } : {}),
      // 화면의 나라 목록 코드로 되돌림 (하와이는 시간대로 구분, 나라 코드 없음 = 그 밖의 나라)
      country: !c.country_code ? "ETC" : c.country_code === "US" && i === 0 && t.timeZone === "Pacific/Honolulu" ? "US-HI" : c.country_code,
    })),
    dayCounts: t.days.map((d) => d.items.length),
  };
});

/* 장소 추가/수정 화면용 : 여행 기본 정보, 기본 통화, (수정이면) 그 장소 */
export type PlaceContext = {
  tripId: string; tripTitle: string; start: string; days: number; role: Role; currency: string; place?: PlaceRow; photos?: { path: string; url: string }[];
  searchable: boolean; bias: { lat: number; lng: number } | null; // 장소 검색 (4단계) : 키가 있을 때만, 첫 도시 근처를 먼저
  reserved: boolean; // 준비 탭 예약에 들어가 있는지 (0032)
  lastTimes: (string | null)[]; // 일차별 가장 늦은 장소 시간 (시간 빠른 고르기, 2026-11-16). 지금 고치는 장소는 뺀다. 마지막 칸 = 날짜 미정
};
export const loadPlaceContext = cache(async (v: Viewer, tripId: string, placeId?: string): Promise<PlaceContext | null> => {
  if (v.kind !== "user" || !/^[0-9a-f-]{36}$/i.test(tripId)) return null;
  if (placeId && !/^[0-9a-f-]{36}$/i.test(placeId)) return null;
  const r = await loadTrip(v, tripId);
  if (!("trip" in r)) return null;
  const sb = (await createClient())!;
  // 첫 도시, 고칠 장소, 예약 연결은 서로 기다리지 않고 한꺼번에 (성능)
  // "*" : 0014(좌표 칸) 적용 전에도 깨지지 않게
  const [{ data: city }, { data: placeRow }, { data: rsv }] = await Promise.all([
    sb.from("trip_cities").select("*").eq("trip_id", tripId).order("sort_order").limit(1).maybeSingle(),
    placeId ? sb.from("itinerary_items").select("*").eq("trip_id", tripId).eq("id", placeId).is("removed_at", null).maybeSingle() : Promise.resolve({ data: null }),
    placeId ? sb.from("checklist_items").select("id").eq("trip_id", tripId).eq("item_id", placeId).is("removed_at", null).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  let bias: { lat: number; lng: number } | null = city?.lat != null ? { lat: city.lat, lng: city.lng } : null;
  if (!bias && city?.country_code) {
    const { data: c } = await sb.from("cities").select("lat, lng").eq("country_code", city.country_code).eq("name", city.name).maybeSingle();
    if (c?.lat != null) bias = { lat: c.lat, lng: c.lng };
  }
  if (placeId && !placeRow) return null;
  const place = (placeRow ?? undefined) as PlaceRow | undefined;
  const t = r.trip;
  const photos = placeId ? [...t.days.flatMap((d) => d.items), ...t.undated].find((it) => it.id === placeId)?.photos : undefined;
  const latest = (items: Item[]) => items.filter((it) => it.id !== placeId && it.time).map((it) => it.time!).sort().pop() ?? null;
  const lastTimes = [...t.days.map((d) => latest(d.items)), latest(t.undated)];
  return { tripId, tripTitle: t.title, start: t.start, days: t.days.length, role: r.role, currency: currencyOf(city?.country_code), place, photos, searchable: placesEnabled(), bias, reserved: !!rsv, lastTimes };
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
  const [{ data: rows }, { data: inv }] = await Promise.all([
    sb.from("trip_members").select("id, user_id, display_name, role, created_at").eq("trip_id", tripId).is("removed_at", null).order("created_at"),
    r.role === "owner"
      ? sb.from("trip_invites").select("token, role, expires_at").eq("trip_id", tripId).is("revoked_at", null).gt("expires_at", new Date().toISOString()).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const order: Record<string, number> = { owner: 0, editor: 1, viewer: 2 };
  const members = ((rows ?? []) as { id: string; user_id: string | null; display_name: string; role: Role }[])
    .map((m) => ({ id: m.id, name: m.display_name, role: m.role, isMe: m.user_id === v.id, userId: m.user_id ?? undefined, avatar: r.trip.members.find((x) => x.userId && x.userId === m.user_id)?.avatar }))
    .sort((a, b) => order[a.role] - order[b.role]);
  const invite: MembersView["invite"] = inv ? { token: inv.token, role: inv.role, expiresAt: inv.expires_at } : null;
  return { tripId, tripTitle: r.trip.title, role: r.role, members, invite };
});

/* 준비 탭 (2단계 6~7) : 챙길 것, 예약, 예산 */
export type PrepItem = { id: string; kind: "item" | "reservation"; title: string; due: string | null; assignee: string | null; done: boolean; itemId: string | null /* 장소에서 온 예약 (0032) */ };
export type PrepView = {
  tripId: string; tripTitle: string; start: string; end: string; role: Role; currency: string;
  items: PrepItem[]; budget: { currency: string; total: number } | null;
  spent: number; // 예산 통화로 적은 장소 예상 비용 합 (최소 단위)
  byCategory: { category: Category; amount: number }[]; // 분류별 예상 비용 (많은 순)
  people: { userId: string; name: string }[];
};
export const loadPrep = cache(async (v: Viewer, tripId: string): Promise<PrepView | null> => {
  if (v.kind !== "user" || !/^[0-9a-f-]{36}$/i.test(tripId)) return null;
  const r = await loadTrip(v, tripId);
  if (!("trip" in r)) return null;
  const sb = (await createClient())!;
  const [{ data: rows }, { data: budget }, { data: city }, mv] = await Promise.all([
    sb.from("checklist_items").select("id, kind, title, due_date, assignee_id, done_at, sort_order, created_at, item_id")
      .eq("trip_id", tripId).is("removed_at", null).order("sort_order").order("created_at"),
    sb.from("trip_budgets").select("currency, total").eq("trip_id", tripId).maybeSingle(),
    sb.from("trip_cities").select("country_code").eq("trip_id", tripId).order("sort_order").limit(1).maybeSingle(),
    loadMembers(v, tripId),
  ]);
  const currency = budget?.currency ?? currencyOf(city?.country_code);
  const { data: costs } = await sb.from("itinerary_items").select("category, estimated_cost").eq("trip_id", tripId).is("removed_at", null).eq("cost_currency", currency);
  const byCat = new Map<Category, number>();
  for (const c of (costs ?? []) as { category: string; estimated_cost: number | null }[]) {
    if (!c.estimated_cost) continue;
    const k = CATEGORY[c.category] ?? "관광";
    byCat.set(k, (byCat.get(k) ?? 0) + c.estimated_cost);
  }
  const byCategory = [...byCat].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);
  const spent = byCategory.reduce((n, c) => n + c.amount, 0);
  return {
    tripId, tripTitle: r.trip.title, start: r.trip.start, end: r.trip.end, role: r.role, currency,
    items: ((rows ?? []) as { id: string; kind: "item" | "reservation"; title: string; due_date: string | null; assignee_id: string | null; done_at: string | null; item_id: string | null }[])
      .map((x) => ({ id: x.id, kind: x.kind, title: x.title, due: x.due_date, assignee: x.assignee_id, done: !!x.done_at, itemId: x.item_id })),
    budget: budget ? { currency: budget.currency, total: Number(budget.total) } : null,
    spent, byCategory,
    people: (mv?.members ?? []).flatMap((m) => (m.userId ? [{ userId: m.userId, name: m.name }] : [])),
  };
});

/* ───────── 여행일기 (2단계 8~10) ───────── */
export type Visibility = "private" | "members" | "public";
export type Entry = {
  id: string; tripId: string; tripTitle: string; tripStart: string; kind: "day" | "recap"; dayIndex: number | null;
  title: string | null; body: string; photos: { path: string; url: string }[]; visibility: Visibility;
  author: string; mine: boolean; updatedAt: string; shareToken: string | null;
  /* 피드 (0022) : 좋아요 수, 내가 눌렀는지, 댓글 수. 나만 보기 글은 모두 0 */
  likes: number; liked: boolean; comments: number;
  /* 피드 디자인 (11.15) : 쓴 사람 얼굴, 최근 댓글 한 줄(피드에서만) */
  avatar: string | null; latest?: { author: string; body: string } | null;
};
type EntryRow = { id: string; trip_id: string; author_id: string; kind: "day" | "recap"; day_index: number | null; title: string | null; body: string; photos: string[]; visibility: Visibility; updated_at: string; share_token: string | null };
const ENTRY_COLS = "id, trip_id, author_id, kind, day_index, title, body, photos, visibility, updated_at, share_token";

async function toEntries(sb: NonNullable<Awaited<ReturnType<typeof createClient>>>, v: Viewer & { kind: "user" }, rows: EntryRow[], allPhotos: boolean): Promise<Entry[]> {
  if (!rows.length) return [];
  const tripIds = [...new Set(rows.map((r) => r.trip_id))];
  const [{ data: trips }, { data: people }] = await Promise.all([
    sb.from("trips").select("id, title, start_date").in("id", tripIds),
    sb.from("trip_members").select("trip_id, user_id, display_name").in("trip_id", tripIds),
  ]);
  const tripOf = new Map((trips ?? []).map((t: { id: string; title: string; start_date: string }) => [t.id, t]));
  const nameOf = new Map((people ?? []).map((p: { trip_id: string; user_id: string | null; display_name: string }) => [`${p.trip_id}:${p.user_id}`, p.display_name]));
  const [urls, { data: counts }, face] = await Promise.all([
    photoUrls(sb, rows.flatMap((r) => (allPhotos ? r.photos : r.photos.slice(0, 1)))),
    sb.rpc("journal_counts", { p_ids: rows.map((r) => r.id) }),
    faces(sb, [...new Set(rows.map((r) => r.author_id))]),
  ]);
  const countOf = new Map(((counts ?? []) as { entry_id: string; likes: number; liked: boolean; comments: number }[]).map((c) => [c.entry_id, c]));
  return rows.filter((r) => tripOf.has(r.trip_id)).map((r) => ({
    id: r.id, tripId: r.trip_id, tripTitle: tripOf.get(r.trip_id)!.title, tripStart: tripOf.get(r.trip_id)!.start_date,
    kind: r.kind, dayIndex: r.day_index, title: r.title, body: r.body, visibility: r.visibility, updatedAt: r.updated_at, shareToken: r.visibility === "public" ? r.share_token : null,
    likes: countOf.get(r.id)?.likes ?? 0, liked: countOf.get(r.id)?.liked ?? false, comments: countOf.get(r.id)?.comments ?? 0,
    photos: r.photos.map((p) => ({ path: p, url: urls.get(p) ?? "" })).filter((p) => p.url),
    author: nameOf.get(`${r.trip_id}:${r.author_id}`) ?? "나간 사람", mine: r.author_id === v.id, avatar: face.get(r.author_id) ?? null,
  }));
}

/* 일기 탭 : 내가 볼 수 있는 일기 최신순 (RLS 가 남의 나만 보기를 걸러 냄) */
export type DiaryFilter = "all" | "mine" | "liked" | "commented";
export const loadDiaryFeed = cache(async (v: Viewer, filter: DiaryFilter = "all"): Promise<Entry[]> => {
  if (v.kind !== "user") return [];
  const sb = (await createClient())!;
  let q = sb.from("journal_entries").select(ENTRY_COLS).is("removed_at", null);
  if (filter === "mine") q = q.eq("author_id", v.id);
  if (filter === "liked" || filter === "commented") {
    /* 내가 좋아요하거나 댓글, 답글을 단 일기 (지금 볼 수 있는 것만) */
    const { data: mine } = filter === "liked"
      ? await sb.from("journal_likes").select("entry_id").eq("user_id", v.id).order("created_at", { ascending: false }).limit(200)
      : await sb.from("journal_comments").select("entry_id").eq("author_id", v.id).order("created_at", { ascending: false }).limit(300);
    const ids = [...new Set(((mine ?? []) as { entry_id: string }[]).map((r) => r.entry_id))].slice(0, 100);
    if (!ids.length) return [];
    q = q.in("id", ids);
  }
  const { data } = await q.order("updated_at", { ascending: false }).limit(30);
  const list = await toEntries(sb, v, (data ?? []) as EntryRow[], true);
  /* 최근 댓글 한 줄 (답글 빼고). RLS 가 나만 보기 글 댓글은 걸러 낸다 */
  const ids = list.filter((e) => e.comments > 0).map((e) => e.id);
  if (!ids.length) return list;
  const { data: cs } = await sb.from("journal_comments").select("entry_id, author_id, body, created_at").in("entry_id", ids).is("parent_id", null).order("created_at", { ascending: false }).limit(200);
  const tripOf = new Map(list.map((e) => [e.id, e.tripId]));
  const { data: people } = await sb.from("trip_members").select("trip_id, user_id, display_name").in("trip_id", [...new Set(list.map((e) => e.tripId))]);
  const nameOf = new Map((people ?? []).map((p: { trip_id: string; user_id: string | null; display_name: string }) => [`${p.trip_id}:${p.user_id}`, p.display_name]));
  const latest = new Map<string, { author: string; body: string }>();
  for (const c of (cs ?? []) as { entry_id: string; author_id: string; body: string }[]) {
    if (latest.has(c.entry_id)) continue;
    latest.set(c.entry_id, { author: c.author_id === v.id ? "나" : nameOf.get(`${tripOf.get(c.entry_id)}:${c.author_id}`) ?? "나간 사람", body: c.body });
  }
  return list.map((e) => ({ ...e, latest: latest.get(e.id) ?? null }));
});

export const loadEntry = cache(async (v: Viewer, id: string): Promise<Entry | null> => {
  if (v.kind !== "user" || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const sb = (await createClient())!;
  const { data } = await sb.from("journal_entries").select(ENTRY_COLS).eq("id", id).is("removed_at", null).maybeSingle();
  return data ? (await toEntries(sb, v, [data as EntryRow], true))[0] ?? null : null;
});

/* 일기 댓글 (0022) : 오래된 것부터. 나만 보기 글은 RLS 가 비워 준다 */
export type EntryComment = { id: string; parentId: string | null; author: string; avatar: string | null; mine: boolean; body: string; at: string };
export const loadComments = cache(async (v: Viewer, entryId: string, tripId: string): Promise<EntryComment[]> => {
  if (v.kind !== "user") return [];
  const sb = (await createClient())!;
  const [{ data }, { data: people }] = await Promise.all([
    sb.from("journal_comments").select("id, parent_id, author_id, body, created_at").eq("entry_id", entryId).order("created_at").limit(300),
    sb.from("trip_members").select("user_id, display_name").eq("trip_id", tripId),
  ]);
  const nameOf = new Map((people ?? []).map((p: { user_id: string | null; display_name: string }) => [p.user_id, p.display_name]));
  const rows = (data ?? []) as { id: string; parent_id: string | null; author_id: string; body: string; created_at: string }[];
  const face = await faces(sb, [...new Set(rows.map((c) => c.author_id))]);
  return rows.map((c) => ({ id: c.id, parentId: c.parent_id, author: nameOf.get(c.author_id) ?? "나간 사람", avatar: face.get(c.author_id) ?? null, mine: c.author_id === v.id, body: c.body, at: c.created_at }));
});

/* 일기 쓰기 화면 : 그 칸(하루 또는 회고)의 내 일기 + 그날 장소 이름 */
export type EntryContext = { tripId: string; tripTitle: string; start: string; days: number; kind: "day" | "recap"; dayIndex: number | null; places: string[]; entry: Entry | null };
export const loadEntryContext = cache(async (v: Viewer, tripId: string, kind: "day" | "recap", dayIndex: number | null): Promise<EntryContext | null> => {
  if (v.kind !== "user" || !/^[0-9a-f-]{36}$/i.test(tripId)) return null;
  const r = await loadTrip(v, tripId);
  if (!("trip" in r)) return null;
  if (kind === "day" && (dayIndex == null || dayIndex < 0 || dayIndex >= r.trip.days.length)) return null;
  const sb = (await createClient())!;
  let q = sb.from("journal_entries").select(ENTRY_COLS).eq("trip_id", tripId).eq("author_id", v.id).eq("kind", kind).is("removed_at", null);
  q = dayIndex == null ? q.is("day_index", null) : q.eq("day_index", dayIndex);
  const { data } = await q.maybeSingle();
  const entry = data ? (await toEntries(sb, v, [data as EntryRow], true))[0] ?? null : null;
  const places = kind === "day" ? r.trip.days[dayIndex!].items.map((i) => i.title) : [];
  return { tripId, tripTitle: r.trip.title, start: r.trip.start, days: r.trip.days.length, kind, dayIndex, places, entry };
});

/* ───────── 도장 (3단계, migration 0012) ───────── */
export type StampCard = {
  cityId: number | null; name: string; country: string; earned: boolean;
  firstDate?: string; visits: number; trips: { id: string; title: string; verifiedBy: string | null }[];
};
export type StampsView = { earned: StampCard[]; missing: StampCard[]; cityCount: number; countryCount: number };

const PREVIEW_STAMPS: StampsView = {
  earned: [
    { cityId: null, name: "삿포로", country: "JP", earned: true, firstDate: "2026-12-28", visits: 1, trips: [] },
    { cityId: null, name: "오타루", country: "JP", earned: true, firstDate: "2026-12-29", visits: 1, trips: [] },
    { cityId: null, name: "교토", country: "JP", earned: true, firstDate: "2025-11-08", visits: 2, trips: [] },
  ],
  missing: [{ cityId: null, name: "도쿄", country: "JP", earned: false, visits: 0, trips: [] }],
  cityCount: 3, countryCount: 1,
};

export const loadStamps = cache(async (v: Viewer): Promise<StampsView> => {
  if (v.kind === "preview") return PREVIEW_STAMPS;
  if (v.kind !== "user") return { earned: [], missing: [], cityCount: 0, countryCount: 0 };
  const sb = (await createClient())!;
  const [{ data: grants }, { data: myCities }, { data: catalog }] = await Promise.all([
    sb.from("stamp_grants").select("trip_id, city_id, granted_at, cities(name, country_code)").eq("user_id", v.id).order("granted_at"),
    sb.from("trip_cities").select("name, country_code, trips!inner(removed_at)").is("trips.removed_at", null),
    sb.from("cities").select("id, name, country_code"),
  ]);
  type G = { trip_id: string; city_id: number; granted_at: string; cities: { name: string; country_code: string } | null };
  const gs = (grants ?? []) as unknown as G[];
  const tripIds = [...new Set(gs.map((g) => g.trip_id))];
  const [{ data: trips }, { data: checks }] = tripIds.length
    ? await Promise.all([
        sb.from("trips").select("id, title").in("id", tripIds),
        sb.from("stamp_checkins").select("trip_id, city_id, verified_by").in("trip_id", tripIds),
      ])
    : [{ data: [] }, { data: [] }];
  const verifierIds = [...new Set((checks ?? []).map((c: { verified_by: string | null }) => c.verified_by).filter(Boolean))] as string[];
  const { data: names } = verifierIds.length ? await sb.from("profiles").select("user_id, display_name").in("user_id", verifierIds) : { data: [] };
  const nameOf = new Map((names ?? []).map((p: { user_id: string; display_name: string }) => [p.user_id, p.display_name]));
  const titleOf = new Map((trips ?? []).map((t: { id: string; title: string }) => [t.id, t.title]));
  const verifier = new Map((checks ?? []).map((c: { trip_id: string; city_id: number; verified_by: string | null }) =>
    [`${c.trip_id}:${c.city_id}`, c.verified_by === v.id ? "나" : c.verified_by ? nameOf.get(c.verified_by) ?? "함께한 사람" : null]));

  const byCity = new Map<number, StampCard>();
  for (const g of gs) {
    if (!g.cities) continue;
    const s = byCity.get(g.city_id) ?? { cityId: g.city_id, name: g.cities.name, country: g.cities.country_code, earned: true, firstDate: g.granted_at.slice(0, 10), visits: 0, trips: [] };
    s.visits += 1;
    s.trips.push({ id: g.trip_id, title: titleOf.get(g.trip_id) ?? "여행", verifiedBy: verifier.get(`${g.trip_id}:${g.city_id}`) ?? null });
    byCity.set(g.city_id, s);
  }
  const earned = [...byCity.values()];
  const have = new Set(earned.map((s) => `${s.country}:${s.name}`));
  const known = new Map((catalog ?? []).map((c: { id: number; name: string; country_code: string }) => [`${c.country_code}:${c.name}`, c.id]));
  const missing: StampCard[] = [];
  for (const c of (myCities ?? []) as { name: string; country_code: string | null }[]) {
    const key = `${c.country_code}:${c.name}`;
    if (!c.country_code || have.has(key) || !known.has(key) || missing.some((m) => `${m.country}:${m.name}` === key)) continue;
    missing.push({ cityId: known.get(key)!, name: c.name, country: c.country_code, earned: false, visits: 0, trips: [] });
  }
  return { earned, missing, cityCount: earned.length, countryCount: new Set(earned.map((s) => s.country)).size };
});

/* ───────── 링크로 공개한 일기 (3단계 7, migration 0013) : 로그인 없이 읽는다 ───────── */
export type PublicEntry = {
  kind: "day" | "recap"; dayIndex: number | null; title: string | null; body: string; photos: string[];
  updatedAt: string; author: string; tripTitle: string; start: string; end: string; likes: number;
};
export const loadPublicEntry = cache(async (token: string): Promise<PublicEntry | null> => {
  if (!/^[0-9a-f]{32}$/.test(token)) return null;
  const sb = await createClient();
  if (!sb) return null;
  const { data } = await sb.rpc("public_entry", { p_token: token });
  const r = (Array.isArray(data) ? data[0] : data) as
    | { kind: "day" | "recap"; day_index: number | null; title: string | null; body: string; photos: string[]; updated_at: string; author: string; trip_title: string; start_date: string; end_date: string; like_count?: number }
    | undefined;
  if (!r) return null;
  const urls = await photoUrls(sb, r.photos);
  return {
    kind: r.kind, dayIndex: r.day_index, title: r.title, body: r.body, photos: r.photos.map((p) => urls.get(p) ?? "").filter(Boolean),
    updatedAt: r.updated_at, author: r.author, tripTitle: r.trip_title, start: r.start_date, end: r.end_date, likes: r.like_count ?? 0,
  };
});

/* 여행 요약 숫자 (3단계 8) : 함께한 날, 장소 수, 남긴 사진(장소 + 내가 볼 수 있는 일기), 이 여행에서 받은 도장 */
export type TripSummary = { days: number; places: number; photos: number; stamps: number };
export const loadTripSummary = cache(async (v: Viewer, trip: Trip): Promise<TripSummary> => {
  const days = daysBetween(trip.start, trip.end) + 1;
  const places = trip.days.reduce((n, d) => n + d.items.length, 0);
  const placePhotos = trip.days.reduce((n, d) => n + d.items.reduce((m, i) => m + (i.photos?.length ?? 0), 0), 0);
  if (v.kind !== "user") return { days, places, photos: placePhotos, stamps: 0 };
  const sb = (await createClient())!;
  const [{ data: entries }, { count }] = await Promise.all([
    sb.from("journal_entries").select("photos").eq("trip_id", trip.id).is("removed_at", null),
    sb.from("stamp_grants").select("city_id", { count: "exact", head: true }).eq("trip_id", trip.id).eq("user_id", v.id),
  ]);
  const diaryPhotos = (entries ?? []).reduce((n: number, e: { photos: string[] }) => n + e.photos.length, 0);
  return { days, places, photos: placePhotos + diaryPhotos, stamps: count ?? 0 };
});

/* ───────── 내 장소 지도 (4단계 5) : 다녀온 여행(끝난 날이 지난 여행)의 장소 중 지도 위치가 있는 것 ───────── */
export type MyPlacePin = { id: string; tripId: string; title: string; tripTitle: string; lat: number; lng: number };
export type MyPlacesView = { pins: MyPlacePin[]; placeCount: number; cityCount: number; countryCount: number; tripCount: number };
const PREVIEW_PLACES: MyPlacesView = {
  pins: [
    { id: "p1", tripId: "", title: "오도리 공원", tripTitle: "삿포로 겨울 여행", lat: 43.0605, lng: 141.3485 },
    { id: "p2", tripId: "", title: "오타루 운하", tripTitle: "삿포로 겨울 여행", lat: 43.1985, lng: 140.9945 },
    { id: "p3", tripId: "", title: "기요미즈데라", tripTitle: "가을 교토", lat: 34.9949, lng: 135.785 },
  ],
  placeCount: 12, cityCount: 3, countryCount: 1, tripCount: 2,
};
export const loadMyPlaces = cache(async (v: Viewer): Promise<MyPlacesView> => {
  if (v.kind === "preview") return PREVIEW_PLACES;
  if (v.kind !== "user") return { pins: [], placeCount: 0, cityCount: 0, countryCount: 0, tripCount: 0 };
  const sb = (await createClient())!;
  const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
  const { data: trips } = await sb.from("trips").select("id, title").is("removed_at", null).lt("end_date", today);
  const ts = (trips ?? []) as { id: string; title: string }[];
  if (!ts.length) return { pins: [], placeCount: 0, cityCount: 0, countryCount: 0, tripCount: 0 };
  const ids = ts.map((t) => t.id);
  const titleOf = new Map(ts.map((t) => [t.id, t.title]));
  const [{ data: items }, { data: cities }] = await Promise.all([
    sb.from("itinerary_items").select("id, trip_id, title, lat, lng").in("trip_id", ids).is("removed_at", null),
    sb.from("trip_cities").select("name, country_code").in("trip_id", ids),
  ]);
  const rows = (items ?? []) as { id: string; trip_id: string; title: string; lat: number | null; lng: number | null }[];
  const cs = (cities ?? []) as { name: string; country_code: string | null }[];
  return {
    pins: rows.flatMap((r) => (r.lat != null && r.lng != null ? [{ id: r.id, tripId: r.trip_id, title: r.title, tripTitle: titleOf.get(r.trip_id) ?? "여행", lat: r.lat, lng: r.lng }] : [])),
    placeCount: rows.length,
    cityCount: new Set(cs.map((c) => `${c.country_code}:${c.name}`)).size,
    countryCount: new Set(cs.map((c) => c.country_code).filter(Boolean)).size,
    tripCount: ts.length,
  };
});

/* ───────── 일부 일정만 공유 (4단계 7, migration 0015) ───────── */
export type DayShare = { token: string; days: number[] | null; createdAt: string };
export const loadDayShares = cache(async (v: Viewer, tripId: string): Promise<DayShare[]> => {
  if (v.kind !== "user") return [];
  const sb = (await createClient())!;
  const { data } = await sb.from("trip_shares").select("token, days, created_at").eq("trip_id", tripId).is("revoked_at", null).order("created_at", { ascending: false });
  return ((data ?? []) as { token: string; days: number[] | null; created_at: string }[]).map((s) => ({ token: s.token, days: s.days, createdAt: s.created_at }));
});
export type SharedItem = { day_index: number | null; title: string; category: string; start_time: string | null; address: string | null; lat: number | null; lng: number | null };
export type PublicShare = { title: string; start_date: string; end_date: string; whole?: boolean; days: number[]; items: (Omit<SharedItem, "category"> & { category: Category })[] };
export const loadPublicShare = cache(async (token: string): Promise<PublicShare | null> => {
  if (!/^[0-9a-f]{32}$/.test(token)) return null;
  const sb = await createClient();
  if (!sb) return null;
  const { data } = await sb.rpc("public_trip_share", { p_token: token });
  const p = data as PublicShare | null;
  if (!p) return null;
  return { ...p, items: p.items.map((i) => ({ ...i, category: CATEGORY[i.category] ?? "관광" })) };
});

/* ───────── 앱 안 알림 (4단계 8, migration 0016) ───────── */
export type Notice = { id: number; tripId: string; tripTitle: string; kind: "joined" | "items" | "journal" | "stamp" | "comment" | "reply"; actor: string; refId: string | null; detail: string | null; count: number; at: string; read: boolean };
const PREVIEW_NOTICES: Notice[] = [
  { id: 1, tripId: "", tripTitle: "삿포로 겨울 여행", kind: "items", actor: "민지", refId: null, detail: "오타루 운하", count: 3, at: new Date(Date.now() - 20 * 60e3).toISOString(), read: false },
  { id: 2, tripId: "", tripTitle: "삿포로 겨울 여행", kind: "joined", actor: "준호", refId: null, detail: null, count: 1, at: new Date(Date.now() - 26 * 3600e3).toISOString(), read: true },
];
export const loadUnreadCount = cache(async (v: Viewer): Promise<number> => {
  if (v.kind === "preview") return 1;
  if (v.kind !== "user") return 0;
  const sb = (await createClient())!;
  const { count, error } = await sb.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null);
  return error ? 0 : count ?? 0; // 0016 적용 전에는 표가 없어 0
});
export const loadNotices = cache(async (v: Viewer): Promise<Notice[]> => {
  if (v.kind === "preview") return PREVIEW_NOTICES;
  if (v.kind !== "user") return [];
  const sb = (await createClient())!;
  const { data, error } = await sb.from("notifications").select("id, trip_id, kind, actor_name, ref_id, detail, count, created_at, read_at, trips(title)").order("created_at", { ascending: false }).limit(50);
  if (error) return [];
  type R = { id: number; trip_id: string; kind: Notice["kind"]; actor_name: string; ref_id: string | null; detail: string | null; count: number; created_at: string; read_at: string | null; trips: { title: string } | null };
  return ((data ?? []) as unknown as R[]).map((r) => ({ id: r.id, tripId: r.trip_id, tripTitle: r.trips?.title ?? "여행", kind: r.kind, actor: r.actor_name, refId: r.ref_id, detail: r.detail, count: r.count, at: r.created_at, read: !!r.read_at }));
});

/* 최근 삭제한 여행 (5단계 3번) : 내가 주인이고 30일 안에 지운 여행. 되살리기는 restore_trip (0019) */
export type RemovedTrip = { id: string; title: string; start: string; end: string; cities: string[]; removedAt: string; daysLeft: number };
export async function loadRemovedTrips(v: Viewer): Promise<RemovedTrip[]> {
  if (v.kind !== "user") return [];
  const sb = (await createClient())!;
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const { data } = await sb.from("trips").select(SELECT).gte("removed_at", since).order("removed_at", { ascending: false });
  return ((data ?? []) as unknown as Row[])
    .filter((r) => r.trip_members.some((m) => m.user_id === v.id && m.role === "owner" && !m.removed_at))
    .map((r) => ({
      id: r.id, title: r.title, start: r.start_date, end: r.end_date,
      cities: [...r.trip_cities].sort((a, b) => a.sort_order - b.sort_order).map((c) => c.name),
      removedAt: r.removed_at!,
      daysLeft: Math.max(1, Math.ceil((new Date(r.removed_at!).getTime() + 30 * 86400000 - Date.now()) / 86400000)),
    }));
}

/* 여행 열기 기록 (5단계 5번, 지표용). 하루 한 줄만 남고, 실패해도 화면에는 영향 없음.
   화면을 다 보낸 뒤(after) 부르도록 로그인 연결을 먼저 만들어 함수로 돌려준다 */
export async function tripOpenLogger(v: Viewer, tripId: string): Promise<(() => Promise<void>) | null> {
  if (v.kind !== "user") return null;
  const sb = await createClient();
  if (!sb) return null;
  return async () => { try { await sb.rpc("log_trip_open", { p_trip: tripId }); } catch { /* 무시 */ } };
}

/* 좌표 다시 받기 (6단계 6번, migration 0029) : 30일 지나 비운 좌표를 장소 id 로 한 번에 5곳까지 다시 채운다.
   화면을 보낸 뒤 after() 로 돌고, 채워지면 실시간 반영으로 지도에 다시 나온다 */
export async function coordsRefiller(v: Viewer, tripId: string): Promise<(() => Promise<void>) | null> {
  if (v.kind !== "user" || !placesEnabled()) return null;
  const sb = await createClient();
  if (!sb) return null;
  return async () => {
    try {
      const [{ data: items }, { data: cities }] = await Promise.all([
        sb.from("itinerary_items").select("id, google_place_id").eq("trip_id", tripId).not("google_place_id", "is", null).is("lat", null).limit(5),
        sb.from("trip_cities").select("id, google_place_id").eq("trip_id", tripId).not("google_place_id", "is", null).is("lat", null).limit(5),
      ]);
      const todo = [
        ...(cities ?? []).map((r) => ({ kind: "city", id: r.id as string, place: r.google_place_id as string })),
        ...(items ?? []).map((r) => ({ kind: "item", id: r.id as string, place: r.google_place_id as string })),
      ].slice(0, 5);
      for (const t of todo) {
        const { data: ok } = await sb.rpc("take_place_quota", { p_kind: "details" });
        if (ok !== true) return; // 하루 상한이면 다음에
        const d = await details(t.place);
        if (d) await sb.rpc("refill_coords", { p_kind: t.kind, p_id: t.id, p_place: t.place, p_lat: d.lat, p_lng: d.lng });
      }
    } catch { /* 무시 : 다음에 열 때 다시 */ }
  };
}

/* 여행 한 권 (5단계 6번) : 이 여행에서 내가 볼 수 있는 일기 전부 + 이 여행에서 받은 내 도장 */
export type TripBook = { entries: Entry[]; stamps: { name: string; country: string; date: string }[] };
export const loadTripBook = cache(async (v: Viewer, tripId: string): Promise<TripBook> => {
  if (v.kind !== "user") return { entries: [], stamps: [] };
  const sb = (await createClient())!;
  const [{ data: rows }, { data: grants }] = await Promise.all([
    sb.from("journal_entries").select(ENTRY_COLS).eq("trip_id", tripId).is("removed_at", null).order("day_index", { nullsFirst: false }).order("updated_at"),
    sb.from("stamp_grants").select("granted_at, cities(name, country_code)").eq("trip_id", tripId).eq("user_id", v.id).order("granted_at"),
  ]);
  const entries = await toEntries(sb, v, (rows ?? []) as EntryRow[], true);
  type G = { granted_at: string; cities: { name: string; country_code: string } | null };
  const stamps = ((grants ?? []) as unknown as G[]).filter((g) => g.cities).map((g) => ({ name: g.cities!.name, country: g.cities!.country_code, date: g.granted_at.slice(0, 10) }));
  return { entries, stamps };
});

/* 경비와 정산 (6단계 3번, migration 0026) */
export type Expense = { id: string; title: string; amount: number; currency: string; paidBy: string; splitWith: string[]; spentOn: string | null };
export type ExpensesView = {
  tripId: string; tripTitle: string; start: string; end: string; role: Role; currency: string; me: string;
  expenses: Expense[];
  people: { userId: string; name: string; active: boolean }[]; // 나간 사람도 이름은 남김
};
export const loadExpenses = cache(async (v: Viewer, tripId: string): Promise<ExpensesView | null> => {
  if (v.kind !== "user" || !/^[0-9a-f-]{36}$/i.test(tripId)) return null;
  const r = await loadTrip(v, tripId);
  if (!("trip" in r)) return null;
  const sb = (await createClient())!;
  const [{ data: rows }, { data: members }, { data: city }] = await Promise.all([
    sb.from("trip_expenses").select("id, title, amount, currency, paid_by, split_with, spent_on").eq("trip_id", tripId).is("removed_at", null).order("created_at", { ascending: false }),
    sb.from("trip_members").select("user_id, display_name, removed_at, created_at").eq("trip_id", tripId).order("created_at"),
    sb.from("trip_cities").select("country_code").eq("trip_id", tripId).order("sort_order").limit(1).maybeSingle(),
  ]);
  const people = new Map<string, { userId: string; name: string; active: boolean }>();
  for (const m of (members ?? []) as { user_id: string | null; display_name: string; removed_at: string | null }[]) {
    if (!m.user_id) continue;
    const prev = people.get(m.user_id);
    if (!prev || !m.removed_at) people.set(m.user_id, { userId: m.user_id, name: m.display_name, active: !m.removed_at });
  }
  return {
    tripId, tripTitle: r.trip.title, start: r.trip.start, end: r.trip.end, role: r.role, currency: currencyOf(city?.country_code), me: v.id,
    expenses: ((rows ?? []) as { id: string; title: string; amount: number; currency: string; paid_by: string; split_with: string[]; spent_on: string | null }[])
      .map((e) => ({ id: e.id, title: e.title, amount: Number(e.amount), currency: e.currency, paidBy: e.paid_by, splitWith: e.split_with, spentOn: e.spent_on })),
    people: [...people.values()],
  };
});

/* ───────── 여행 지도 (2026-11-15 여행 메뉴 개편) : 여행마다 도시 핀. 좌표는 도시 검색 좌표 → 인기 도시 목록 → 나라 대표 좌표 순 ───────── */
export type MapCity = { name: string; country: string | null; countryName: string; lat: number; lng: number };
export type MapTrip = { id: string; title: string; start: string; end: string; status: "upcoming" | "ongoing" | "past"; cities: MapCity[]; allCities: number; countries: string[] };
const PREVIEW_COORDS: Record<string, [number, number]> = {
  삿포로: [43.06, 141.35], 오타루: [43.19, 141.0], 노보리베츠: [42.41, 141.1], 비에이: [43.59, 142.47],
  후쿠오카: [33.59, 130.4], 다자이후: [33.51, 130.53], 교토: [35.01, 135.77], 타이베이: [25.03, 121.57],
};
export const loadMapTrips = cache(async (v: Viewer, trips: Trip[]): Promise<MapTrip[]> => {
  const { COUNTRY_CENTER, countryNameOf } = await import("@/lib/countries");
  const statusOfTrip = (t: Trip) => { const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10); return today < t.start ? "upcoming" : today > t.end ? "past" : "ongoing"; };
  if (v.kind === "preview") {
    return trips.map((t) => ({
      id: t.id, title: t.title, start: t.start, end: t.end, status: statusOfTrip(t), allCities: t.cities.length, countries: [t.country ?? "JP"],
      cities: t.cities.flatMap((n) => PREVIEW_COORDS[n] ? [{ name: n, country: t.country ?? "JP", countryName: countryNameOf(t.country) ?? "", lat: PREVIEW_COORDS[n][0], lng: PREVIEW_COORDS[n][1] }] : []),
    }));
  }
  if (v.kind !== "user" || !trips.length) return [];
  const sb = (await createClient())!;
  const { data } = await sb.from("trip_cities").select("*").in("trip_id", trips.map((t) => t.id)).order("sort_order");
  type C = { trip_id: string; name: string; country_code: string | null; country_name: string | null; lat: number | null; lng: number | null };
  const rows = (data ?? []) as C[];
  const need = [...new Set(rows.filter((c) => c.lat == null && c.country_code).map((c) => c.name))];
  const { data: cat } = need.length ? await sb.from("cities").select("name, country_code, lat, lng").in("name", need) : { data: [] };
  const catOf = new Map(((cat ?? []) as { name: string; country_code: string; lat: number; lng: number }[]).map((c) => [`${c.country_code}:${c.name}`, [c.lat, c.lng] as [number, number]]));
  return trips.map((t) => {
    const cs = rows.filter((c) => c.trip_id === t.id);
    const cities: MapCity[] = [];
    for (const c of cs) {
      const at: [number, number] | undefined = c.lat != null && c.lng != null ? [c.lat, c.lng] : catOf.get(`${c.country_code}:${c.name}`) ?? (c.country_code ? COUNTRY_CENTER[c.country_code] : undefined);
      if (at) cities.push({ name: c.name, country: c.country_code, countryName: c.country_name ?? countryNameOf(c.country_code) ?? "", lat: at[0], lng: at[1] });
    }
    return { id: t.id, title: t.title, start: t.start, end: t.end, status: statusOfTrip(t), cities, allCities: cs.length,
      countries: [...new Set(cs.map((c) => (c.country_code === "ETC" ? c.country_name ?? "ETC" : c.country_code ?? "")).filter(Boolean))] };
  });
});
