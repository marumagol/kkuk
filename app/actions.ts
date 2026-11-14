"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { PREVIEW_COOKIE, safeNext } from "@/lib/viewer";
import { countryOf, isoOf } from "@/lib/countries";
import { MAX_TRIP_DAYS, MAX_CITIES, MAX_TRIP_TITLE } from "@/lib/rules";

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

export async function createTrip(input: NewTrip): Promise<CreateTripResult> {
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
