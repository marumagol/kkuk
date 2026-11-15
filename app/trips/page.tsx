/*
  S05 여행 : 기본은 지도 (2026-11-15 여행 메뉴 개편, 세계 지도 위 여행 핀 → 누르면 여행 상세)
  ?view=list 는 목록 (다가오는 여행 / 다녀온 여행 탭, ?tab=past)
*/
import Link from "next/link";
import { EmptyState } from "@/components/kit";
import { AppShell, MainTabs, MockNote, TripRow } from "@/components/screen";
import { GateButton, GateCta } from "@/components/gate";
import { Icon } from "@/components/kit";
import { getViewer } from "@/lib/viewer";
import { upcomingOf, pastOf, periodText, placeCount, yearOf, ddayOf } from "@/lib/mock";
import { loadTrips, loadMapTrips } from "@/lib/trips";
import { WorldTrips } from "@/components/world-trips";

export const metadata = { title: "여행" };

export default async function Trips({ searchParams }: { searchParams: Promise<{ deleted?: string; tab?: string; left?: string; view?: string }> }) {
  const { deleted, tab, left, view } = await searchParams;
  const viewer = await getViewer();
  const trips = await loadTrips(viewer);
  const next = upcomingOf(trips);
  const past = pastOf(trips);
  const showPast = tab === "past";
  const years = [...new Set(past.map((t) => yearOf(t.start)))];

  const asMap = view !== "list" && next.length + past.length > 0;
  const map = asMap ? await loadMapTrips(viewer, trips) : [];
  const toggle = (
    <div className="flex items-center gap-1.5">
      <nav aria-label="보기 방식" className="flex rounded-full bg-surface p-1">
        {[{ k: "map", label: "지도", icon: "globe" as const, href: "/trips" }, { k: "list", label: "목록", icon: "list" as const, href: "/trips?view=list" }].map((x) => (
          <Link key={x.k} href={x.href} replace aria-current={(x.k === "map") === asMap ? "page" : undefined}
            className={"press inline-flex h-9 items-center gap-1 rounded-full px-3 text-tiny font-bold " + ((x.k === "map") === asMap ? "bg-deep text-on-deep" : "text-ink-sub")}>
            <Icon name={x.icon} size={16} />{x.label}
          </Link>
        ))}
      </nav>
      <GateButton label="여행 만들기" href="/trips/new"
        className="press flex size-11 items-center justify-center rounded-full bg-surface text-ink">
        <Icon name="plus" size={20} />
      </GateButton>
    </div>
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
            {toggle}
          </header>
          {viewer.kind === "preview" && <MockNote />}
          <WorldTrips trips={map.map((m) => ({ ...m, row: rowOf(trips.find((t) => t.id === m.id)!) }))} />
          <div className="flex-1 bg-surface pb-32" />
        </div>
        <MainTabs active="여행" />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <header className="flex items-center justify-between px-5 pt-6">
        <h1 className="text-title-xl font-extrabold text-ink">여행</h1>
        {toggle}
      </header>
      {viewer.kind === "preview" && <MockNote />}
      {left && <p role="status" className="mx-5 mt-3 rounded-field bg-surface px-3 py-2 text-tiny font-semibold text-ink">여행에서 나왔어요</p>}
      {deleted && <p role="status" className="mx-5 mt-3 rounded-field bg-surface px-3 py-2 text-tiny font-semibold text-ink">여행을 삭제했어요. 30일 안에는 설정 &gt; 최근 삭제한 여행에서 되살릴 수 있어요</p>}

      <div className="flex flex-col gap-6 px-5 pt-5">
        {next.length + past.length === 0 ? (
          <EmptyState title="아직 여행이 없어요" desc="다가오는 여행과 다녀온 여행이 여기에 모여요"
            action={<GateCta href="/trips/new">여행 만들기</GateCta>} />
        ) : (
          <>
            <nav aria-label="여행 나누기" className="-mb-2 flex border-b border-line">
              {[{ key: "next", label: "다가오는 여행", n: next.length, on: !showPast, href: "/trips?view=list" },
                { key: "past", label: "다녀온 여행", n: past.length, on: showPast, href: "/trips?view=list&tab=past" }].map((x) => (
                <Link key={x.key} href={x.href} replace aria-current={x.on ? "page" : undefined}
                  className={"press -mb-px flex h-12 flex-1 items-center justify-center gap-1 border-b-2 text-body " +
                    (x.on ? "border-ink font-bold text-ink" : "border-transparent font-semibold text-ink-sub")}>
                  {x.label}<span className="text-sub">{x.n}</span>
                </Link>
              ))}
            </nav>

            {!showPast ? (
              <section className="flex flex-col gap-2" aria-label="다가오는 여행">
                {next.length ? next.map((t) => (
                  <TripRow key={t.id} country={t.country} icon={t.countryIcon} href={`/trips/${t.id}`} badge={ddayOf(t).label} badgeTone={ddayOf(t).tone} title={t.title} sub={periodText(t)} meta={`${t.cities.join(", ")} · 장소 ${placeCount(t)}개`} />
                )) : <EmptyState title="다가오는 여행이 없어요" desc="도시와 날짜만 정하면 바로 시작할 수 있어요" action={<GateCta href="/trips/new">여행 만들기</GateCta>} />}
              </section>
            ) : (
              <section className="flex flex-col gap-2" aria-label="다녀온 여행">
                {past.length === 0 && <p className="rounded-pin bg-surface px-4 py-4 text-sub text-ink-sub">아직 다녀온 여행이 없어요</p>}
                {years.map((y) => (
                  <div key={y} className="flex flex-col gap-2">
                    <h3 className="pt-1 text-sub font-bold text-ink-sub">{y}년</h3>
                    {past.filter((t) => yearOf(t.start) === y).map((t) => (
                      <TripRow key={t.id} country={t.country} icon={t.countryIcon} href={`/trips/${t.id}`} title={t.title} sub={periodText(t)} meta={`${t.cities.join(", ")} · 장소 ${placeCount(t)}개`} />
                    ))}
                  </div>
                ))}
              </section>
            )}
          </>
        )}
      </div>
      <MainTabs active="여행" />
    </AppShell>
  );
}
