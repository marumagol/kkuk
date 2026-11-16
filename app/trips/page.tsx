/*
  S05 여행 : 기본은 지도 (2026-11-15 여행 메뉴 개편, 세계 지도 위 여행 핀 → 누르면 여행 상세)
  2026-11-16 목록 보기 방식은 뺐다. 목록은 지도 아래 다가오는/다녀온 여행 탭 (components/world-trips.tsx)
*/
import { EmptyState } from "@/components/kit";
import { AppShell, MainTabs, MockNote } from "@/components/screen";
import { GateButton, GateCta } from "@/components/gate";
import { Icon } from "@/components/kit";
import { getViewer } from "@/lib/viewer";
import { upcomingOf, pastOf, periodText, placeCount, ddayOf } from "@/lib/mock";
import { loadTrips, loadMapTrips } from "@/lib/trips";
import { WorldTrips } from "@/components/world-trips";

export const metadata = { title: "여행" };

export default async function Trips({ searchParams }: { searchParams: Promise<{ deleted?: string; left?: string }> }) {
  const { deleted, left } = await searchParams;
  const viewer = await getViewer();
  const trips = await loadTrips(viewer);
  const next = upcomingOf(trips);
  const past = pastOf(trips);

  // 보기 방식은 지도 하나 (2026-11-16 마루님 "목록 유형은 필요 없겠다"). 목록은 지도 아래 다가오는/다녀온 여행 탭
  const asMap = next.length + past.length > 0;
  const map = asMap ? await loadMapTrips(viewer, trips) : [];
  const addBtn = (
    <GateButton label="여행 만들기" href="/trips/new"
      className="press flex size-11 items-center justify-center rounded-full bg-surface text-ink">
      <Icon name="plus" size={20} />
    </GateButton>
  );
  const notes = (
    <>
      {left && <p role="status" className="mx-5 mb-3 rounded-field bg-surface px-3 py-2 text-tiny font-semibold text-ink">여행에서 나왔어요</p>}
      {deleted && <p role="status" className="mx-5 mb-3 rounded-field bg-surface px-3 py-2 text-tiny font-semibold text-ink">여행을 삭제했어요. 30일 안에는 설정 &gt; 최근 삭제한 여행에서 되살릴 수 있어요</p>}
    </>
  );

  if (asMap) {
    const rowOf = (t: (typeof trips)[number]) => {
      const done = past.includes(t);
      return { title: t.title, sub: periodText(t), meta: `${t.cities.join(", ")} · 장소 ${placeCount(t)}개`, country: t.country, icon: t.countryIcon, ...(done ? {} : { badge: ddayOf(t).label, badgeTone: ddayOf(t).tone }) };
    };
    return (
      <AppShell bottomGap={false}>
        <div className="flex min-h-dvh flex-col bg-sea">
          <header className="flex items-center justify-between px-5 pb-4 pt-6">
            <h1 className="text-title-xl font-extrabold text-ink">여행</h1>
            {addBtn}
          </header>
          {viewer.kind === "preview" && <MockNote />}
          {notes}
          <WorldTrips trips={map.map((m) => ({ ...m, row: rowOf(trips.find((t) => t.id === m.id)!) }))} />
          <div className="flex-1 bg-surface pb-32" />
        </div>
        <MainTabs active="여행" />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <header className="flex items-center justify-between px-5 pb-3 pt-6">
        <h1 className="text-title-xl font-extrabold text-ink">여행</h1>
        {addBtn}
      </header>
      {viewer.kind === "preview" && <MockNote />}
      {notes}
      <div className="flex flex-col gap-6 px-5 pt-2">
        <EmptyState title="아직 여행이 없어요" desc="다가오는 여행과 다녀온 여행이 여기에 모여요"
          action={<GateCta href="/trips/new">여행 만들기</GateCta>} />
      </div>
      <MainTabs active="여행" />
    </AppShell>
  );
}
