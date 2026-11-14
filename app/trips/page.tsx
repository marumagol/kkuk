/* S05 여행 목록 : 다가오는 여행 / 다녀온 여행 (지난 여행은 여기서 본다) */
import { EmptyState } from "@/components/kit";
import { AppShell, SectionTitle, MainTabs, MockNote, TripRow } from "@/components/screen";
import { GateButton, GateCta } from "@/components/gate";
import { Icon } from "@/components/kit";
import { getViewer } from "@/lib/viewer";
import { upcomingOf, pastOf, statusOf, todayOf, periodText, placeCount, daysBetween, yearOf, type Trip } from "@/lib/mock";
import { loadTrips } from "@/lib/trips";

export const metadata = { title: "여행" };

export default async function Trips({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const { deleted } = await searchParams;
  const viewer = await getViewer();
  const trips = await loadTrips(viewer);
  const next = upcomingOf(trips);
  const past = pastOf(trips);
  const years = [...new Set(past.map((t) => yearOf(t.start)))];
  const badge = (t: Trip) => (statusOf(t, todayOf(t)) === "ongoing" ? "여행 중" : `D-${daysBetween(todayOf(t), t.start)}`);

  return (
    <AppShell>
      <header className="flex items-center justify-between px-5 pt-6">
        <h1 className="text-title-xl font-extrabold text-ink">여행</h1>
        <GateButton label="여행 만들기" href="/trips/new"
          className="press flex size-11 items-center justify-center rounded-full bg-surface text-ink">
          <Icon name="plus" size={20} />
        </GateButton>
      </header>
      {viewer.kind === "preview" && <MockNote />}
      {deleted && <p role="status" className="mx-5 mt-3 rounded-field bg-surface px-3 py-2 text-tiny font-semibold text-ink">여행을 삭제했어요</p>}

      <div className="flex flex-col gap-6 px-5 pt-5">
        {next.length + past.length === 0 ? (
          <EmptyState title="아직 여행이 없어요" desc="다가오는 여행과 다녀온 여행이 여기에 모여요"
            action={<GateCta href="/trips/new">여행 만들기</GateCta>} />
        ) : (
          <>
            <section className="flex flex-col gap-2" aria-label="다가오는 여행">
              <SectionTitle title="다가오는 여행" aside={next.length ? `${next.length}개` : undefined} />
              {next.length ? next.map((t) => (
                <TripRow key={t.id} country={t.country} icon={t.countryIcon} href={`/trips/${t.id}`} badge={badge(t)} title={t.title} sub={periodText(t)} meta={`${t.cities.join(", ")} · 장소 ${placeCount(t)}개`} />
              )) : <p className="rounded-pin bg-surface px-4 py-4 text-sub text-ink-sub">다가오는 여행이 없어요</p>}
            </section>

            <section id="past" className="flex scroll-mt-4 flex-col gap-2" aria-label="다녀온 여행">
              <SectionTitle title="다녀온 여행" aside={past.length ? `${past.length}개` : undefined} />
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
          </>
        )}
      </div>
      <MainTabs active="여행" />
    </AppShell>
  );
}
