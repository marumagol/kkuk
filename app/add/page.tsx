/*
  하단 탭 [+] : 장소 추가 바로 가기 (2026-11-14)
  - 여행 중이거나 다가오는 첫 여행이 있으면 그 여행의 장소 추가 (여행 중이면 오늘 일차)
  - 고칠 수 없거나 여행이 없으면 여행 만들기
*/
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/viewer";
import { loadTrips, loadTrip } from "@/lib/trips";
import { upcomingOf, statusOf, todayOf, daysBetween } from "@/lib/mock";

export default async function Add() {
  const viewer = await getViewer();
  if (viewer.kind === "guest") redirect("/login?next=/add");
  const hero = upcomingOf(await loadTrips(viewer))[0];
  if (!hero) redirect("/trips/new");
  if (viewer.kind === "preview") redirect(`/trips/${hero.id}`);
  const r = await loadTrip(viewer, hero.id);
  if (!("role" in r) || r.role === "viewer") redirect("/trips/new");
  const today = todayOf(hero);
  const day = statusOf(hero, today) === "ongoing" ? daysBetween(hero.start, today) + 1 : 1;
  redirect(`/trips/${hero.id}/places/new?day=${day}`);
}
