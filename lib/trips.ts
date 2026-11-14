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
import type { Viewer } from "@/lib/viewer";

const CATEGORY: Record<string, Category> = { transport: "이동", food: "식사", sight: "관광", shopping: "쇼핑", stay: "숙소" };

type Row = {
  id: string; title: string; start_date: string; end_date: string; time_zone: string; removed_at: string | null;
  trip_cities: { name: string; sort_order: number }[];
  trip_members: { display_name: string; role: string; removed_at: string | null; created_at: string }[];
};

const members = (r: Row) =>
  r.trip_members
    .filter((m) => !m.removed_at)
    .sort((a, b) => (a.role === "owner" ? -1 : b.role === "owner" ? 1 : a.created_at.localeCompare(b.created_at)))
    .map((m, i) => ({ initial: [...m.display_name][0] ?? "?", tone: (i % 2 ? "accent" : "point") as "point" | "accent" }));

const base = (r: Row): Trip => ({
  id: r.id, title: r.title, start: r.start_date, end: r.end_date, timeZone: r.time_zone,
  cities: [...r.trip_cities].sort((a, b) => a.sort_order - b.sort_order).map((c) => c.name),
  members: members(r), days: [], undated: [],
});

const SELECT = "id, title, start_date, end_date, time_zone, removed_at, trip_cities(name, sort_order), trip_members(display_name, role, removed_at, created_at)";

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

export type TripResult = { trip: Trip } | { missing: "none" | "removed" };

/* 여행 하나와 일자별 장소 */
export const loadTrip = cache(async (v: Viewer, id: string): Promise<TripResult> => {
  if (v.kind === "preview") { const t = getTrip(id); return t ? { trip: t } : { missing: "none" }; }
  if (v.kind !== "user" || !/^[0-9a-f-]{36}$/i.test(id)) return { missing: "none" };
  const sb = (await createClient())!;
  const { data, error } = await sb.from("trips").select(SELECT).eq("id", id).maybeSingle();
  if (error) throw new Error("trip_load_failed");
  if (!data) return { missing: "none" };
  const r = data as unknown as Row;
  if (r.removed_at) return { missing: "removed" };

  const { data: rows } = await sb.from("itinerary_items")
    .select("id, day_index, sort_order, title, category, start_time, memo")
    .eq("trip_id", id).is("removed_at", null).order("sort_order");
  const trip = base(r);
  const len = daysBetween(trip.start, trip.end) + 1;
  trip.days = Array.from({ length: len }, () => ({ items: [] as Item[] }));
  for (const it of (rows ?? []) as { day_index: number | null; title: string; category: string; start_time: string | null; memo: string | null }[]) {
    const item: Item = { title: it.title, category: CATEGORY[it.category] ?? "관광", time: it.start_time?.slice(0, 5), desc: it.memo ?? undefined };
    if (it.day_index != null && it.day_index < len) trip.days[it.day_index].items.push(item);
    else trip.undated.push(item);
  }
  return { trip };
});
