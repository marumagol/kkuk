/* 내 장소 지도 (4단계 5) : 다녀온 여행의 장소를 한 지도에. 도장 탭 안 [지도] 로 들어온다 */
import Link from "next/link";
import { Icon } from "@/components/kit";
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
    { label: "장소", n: p.placeCount }, { label: "도시", n: p.cityCount },
    { label: "나라", n: p.countryCount }, { label: "도장", n: s.earned.length },
  ];

  return (
    <AppShell bottomGap={false}>
      <div className="flex items-center gap-2 px-5 pt-4">
        <Link href="/stamps" aria-label="도장으로" className="press flex size-11 items-center justify-center rounded-full bg-surface text-ink"><Icon name="back" size={20} /></Link>
        <h1 className="min-w-0 flex-1 truncate text-title font-extrabold text-ink">내 장소 지도</h1>
      </div>
      {viewer.kind === "preview" && <MockNote />}
      <ul className="mx-5 mt-3 grid grid-cols-4 gap-2" aria-label="다녀온 기록">
        {stats.map((x) => (
          <li key={x.label} className="flex flex-col items-center rounded-card bg-surface py-3">
            <span className="text-title font-extrabold text-ink">{x.n}</span>
            <span className="text-tiny text-ink-sub">{x.label}</span>
          </li>
        ))}
      </ul>
      <div className="px-5 pt-3 pb-8">
        {points.length ? (
          <TripMap points={points} numbered={false} height={440} />
        ) : (
          <p className="rounded-card bg-surface px-4 py-8 text-center text-sub text-ink-sub">
            {p.tripCount ? "다녀온 여행에 지도 위치가 있는 장소가 아직 없어요. 장소를 검색해서 넣으면 여기에 핀이 꽂혀요" : "여행이 끝나면 다녀온 장소가 여기 지도에 모여요"}
          </p>
        )}
        {points.length > 0 && p.placeCount > points.length && (
          <p className="mt-2 text-tiny text-ink-sub">지도 위치가 없는 장소 {p.placeCount - points.length}곳은 숫자에만 들어가요</p>
        )}
      </div>
    </AppShell>
  );
}
