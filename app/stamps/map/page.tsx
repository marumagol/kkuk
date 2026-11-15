/* 내 장소 지도 (4단계 5) : 다녀온 여행의 장소를 한 지도에. 도장 탭 안 [지도] 로 들어온다 */
import Link from "next/link";
import { Icon, Stamp } from "@/components/kit";
import { AppShell, MockNote } from "@/components/screen";
import { TripMap, type MapPoint } from "@/components/trip-map";
import { getViewer } from "@/lib/viewer";
import { loadMyPlaces, loadStamps } from "@/lib/trips";

export const metadata = { title: "내 장소 지도" };

export default async function MyPlacesMap() {
  const viewer = await getViewer();
  const [p, s] = await Promise.all([loadMyPlaces(viewer), loadStamps(viewer)]);
  const points: MapPoint[] = p.pins.map((x) => ({
    lat: x.lat, lng: x.lng, title: x.title, sub: x.tripTitle,
    href: viewer.kind === "user" && x.tripId ? `/trips/${x.tripId}/places/${x.id}` : undefined,
  }));
  const stats = [
    { label: "다녀온 장소", n: p.placeCount, hi: true }, { label: "다녀온 도시", n: p.cityCount }, { label: "나라", n: p.countryCount },
  ];
  const all = s.earned.length + s.missing.length;
  const tiltOf = (name: string) => ([...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 17) - 8;

  return (
    <AppShell bottomGap={false}>
      <div className="flex items-center gap-2 px-5 pt-4">
        <Link href="/stamps" aria-label="도장으로" className="press flex size-11 items-center justify-center rounded-full bg-surface text-ink"><Icon name="back" size={20} /></Link>
        <h1 className="min-w-0 flex-1 truncate text-title font-extrabold text-ink">내 장소 지도</h1>
      </div>
      {viewer.kind === "preview" && <MockNote />}
      <div className="px-5 pt-3">
        {points.length ? (
          <TripMap points={points} numbered={false} height={360} />
        ) : (
          <p className="rounded-card bg-surface px-4 py-8 text-center text-sub text-ink-sub">
            {p.tripCount ? "다녀온 여행에 지도 위치가 있는 장소가 아직 없어요. 장소를 검색해서 넣으면 여기에 핀이 꽂혀요" : "여행이 끝나면 다녀온 장소가 여기 지도에 모여요"}
          </p>
        )}
        {points.length > 0 && p.placeCount > points.length && (
          <p className="mt-2 text-tiny text-ink-sub">지도 위치가 없는 장소 {p.placeCount - points.length}곳은 숫자에만 들어가요</p>
        )}
      </div>

      {/* 숫자 줄 + 모은 도장 줄 (참고 화면 "내 핀 지도", 2026-11-15) */}
      <section className="mx-5 mb-8 mt-3 flex flex-col gap-4 rounded-card bg-surface p-5">
        <dl className="grid grid-cols-3 gap-2" aria-label="다녀온 기록">
          {stats.map((x) => (
            <div key={x.label} className="flex flex-col-reverse">
              <dt className="text-tiny text-ink-sub">{x.label}</dt>
              <dd className={"text-number font-extrabold tabular-nums " + (x.hi ? "text-point-text" : "text-ink")}>{x.n}</dd>
            </div>
          ))}
        </dl>
        <div className="border-t border-line pt-4">
          <Link href="/stamps" className="press flex items-center justify-between gap-2">
            <h2 className="text-body font-bold text-ink">모은 도장</h2>
            <span className="flex items-center gap-0.5 text-sub font-semibold text-ink-sub">{s.earned.length} / {all}<Icon name="right" size={16} /></span>
          </Link>
          {all > 0 ? (
            <div className="-mx-5 mt-3 flex gap-1 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
              {s.earned.map((x) => <div key={`e${x.country}:${x.name}`} className="flex-none"><Stamp name={x.name} country={x.country} tilt={tiltOf(x.name)} /></div>)}
              {s.missing.map((x) => <div key={`m${x.country}:${x.name}`} className="flex-none"><Stamp name={x.name} country={x.country} earned={false} /></div>)}
            </div>
          ) : <p className="mt-2 text-sub text-ink-sub">여행 중에 그 도시에 있으면 도장이 찍혀요</p>}
        </div>
      </section>
    </AppShell>
  );
}
