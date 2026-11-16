/* 일정 지도로 보기 (4단계 4) : ?day=N 그날 장소를 순서대로 번호 핀 + 선 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/kit";
import { AppShell } from "@/components/screen";
import { TripMap, type MapPoint } from "@/components/trip-map";
import { getViewer } from "@/lib/viewer";
import { loadTrip } from "@/lib/trips";
import { addDays, md, weekday } from "@/lib/mock";

export const metadata = { title: "지도" };

export default async function TripMapPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ day?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const viewer = await getViewer();
  const r = await loadTrip(viewer, id);
  if (!("trip" in r)) notFound();
  const trip = r.trip;
  const len = trip.days.length;
  const asked = Number(sp.day);
  const day = Number.isInteger(asked) && asked >= 1 && asked <= len ? asked : 1;
  const items = trip.days[day - 1]?.items ?? [];
  const points: MapPoint[] = items.flatMap((it) => (it.lat != null && it.lng != null
    ? [{ lat: it.lat, lng: it.lng, title: it.title, sub: [it.time, it.category].filter(Boolean).join(" · "), href: it.id && viewer.kind === "user" ? `/trips/${trip.id}/places/${it.id}` : undefined },
      ...(it.arrive ? [{ lat: it.arrive.lat, lng: it.arrive.lng, title: `${it.arrive.name || "도착"} (도착)`, sub: [it.detail?.match(/(\d\d:\d\d) 도착/)?.[1], "도착"].filter(Boolean).join(" · "), href: it.id && viewer.kind === "user" ? `/trips/${trip.id}/places/${it.id}` : undefined }] : [])] : []));
  const noPin = items.filter((it) => it.lat == null || it.lng == null).length;

  return (
    <AppShell bottomGap={false}>
      <div className="flex items-center gap-2 px-5 pt-4">
        <Link href={`/trips/${trip.id}?day=${day}`} aria-label="일정으로" className="press flex size-11 items-center justify-center rounded-full bg-surface text-ink"><Icon name="back" size={20} /></Link>
        <h1 className="min-w-0 flex-1 truncate text-title font-extrabold text-ink">{trip.title}</h1>
      </div>
      <nav className="mt-3 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none]" aria-label="날짜">
        {Array.from({ length: len }).map((_, i) => {
          const d = addDays(trip.start, i);
          const on = i + 1 === day;
          return (
            <Link key={d} href={`/trips/${trip.id}/map?day=${i + 1}`} replace scroll={false} aria-current={on ? "page" : undefined}
              aria-label={`${i + 1}일차, ${md(d)} ${weekday(d)}요일`}
              className={"press flex h-[60px] w-[52px] flex-none flex-col items-center justify-center rounded-field " + (on ? "bg-btn text-on-btn" : "bg-surface text-ink")}>
              <span className={"text-tiny " + (on ? "" : "text-ink-sub")}>{weekday(d)}</span>
              <span className="text-title font-bold">{Number(d.slice(8))}</span>
            </Link>
          );
        })}
      </nav>
      <div className="flex flex-col gap-3 px-5 pb-10 pt-4">
        {points.length ? <TripMap points={points} /> : (
          <p className="rounded-card bg-surface px-4 py-8 text-center text-sub text-ink-sub">
            {items.length ? "이 날 장소에 지도 위치가 없어요. 장소를 수정할 때 검색해서 고르면 지도에 보여요" : "이 날은 아직 장소가 없어요"}
          </p>
        )}
        {points.length > 0 && noPin > 0 && <p className="text-tiny text-ink-sub">위치가 없는 장소 {noPin}곳은 지도에 안 보여요. 장소를 수정할 때 검색해서 고르면 보여요</p>}
        {points.length > 0 && (
          <ol className="flex flex-col gap-1.5">
            {points.map((p, i) => (
              <li key={i} className="flex min-h-11 items-center gap-3 rounded-field bg-surface px-3 py-2">
                <span className="flex size-6 flex-none items-center justify-center rounded-full bg-point text-tiny font-extrabold text-white">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate text-sub font-semibold text-ink">{p.title}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </AppShell>
  );
}
