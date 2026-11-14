/*
  S01 홈 : 다가오는 여행, 여행 중인 여행만. 다녀온 여행은 여행 탭에서 (2026-11-14 결정)
  로그인 전은 빈 상태 (예시 여행 없음, 0단계 결정)
*/
import Link from "next/link";
import { EmptyState, StatTile, TicketCard, Pin } from "@/components/kit";
import { AppShell, Logo, Avatar, SectionTitle, MainTabs, MockNote, TripRow } from "@/components/screen";
import { GateCta } from "@/components/gate";
import { getViewer, isIn, initialOf } from "@/lib/viewer";
import { upcomingOf, pastOf, statusOf, daysBetween, todayOf, periodText, placeCount } from "@/lib/mock";
import { loadTrips } from "@/lib/trips";

function Header({ loggedIn, initial }: { loggedIn: boolean; initial: string }) {
  return (
    <header className="flex items-center justify-between px-5 pb-2 pt-4">
      <Link href="/" aria-label="홈" className="flex h-11 items-center"><Logo /></Link>
      {loggedIn ? (
        <Link href="/me" aria-label="마이" className="flex size-11 items-center justify-center"><Avatar initial={initial} /></Link>
      ) : (
        <Link href="/login" className="press inline-flex h-11 items-center rounded-full bg-surface px-4 text-sub font-bold text-ink">로그인</Link>
      )}
    </header>
  );
}

export default async function Home() {
  const viewer = await getViewer();
  const loggedIn = isIn(viewer);
  const trips = await loadTrips(viewer);
  const next = upcomingOf(trips);
  const past = pastOf(trips);
  const hero = next[0];
  const today = hero ? todayOf(hero) : "";

  return (
    <AppShell>
      <Header loggedIn={loggedIn} initial={initialOf(viewer)} />
      {viewer.kind === "preview" && <MockNote />}
      <div className="flex flex-col gap-4 px-5 pt-4">
        {hero ? (
          <>
            {statusOf(hero, today) === "ongoing" ? (
              <h1 className="text-title-xl font-extrabold text-ink">
                {hero.cities[0]} 여행<br /><span className="text-point-text">{daysBetween(hero.start, today) + 1}일째</span>예요
              </h1>
            ) : (
              <h1 className="text-title-xl font-extrabold text-ink">
                {hero.cities[0]}까지<br /><span className="text-point-text">{daysBetween(today, hero.start)}일</span> 남았어요
              </h1>
            )}
            <Link href={`/trips/${hero.id}`} aria-label={`${hero.title} 일정 보기`} className="press block rounded-deep">
              <TicketCard
                dday={statusOf(hero, today) === "ongoing" ? `${daysBetween(hero.start, today) + 1}일차` : `D-${daysBetween(today, hero.start)}`}
                title={hero.title} period={periodText(hero)} stops={hero.cities} pinCount={placeCount(hero)}
                ready={hero.ready} members={hero.members} />
            </Link>
          </>
        ) : (
          <>
            <h1 className="text-title-xl font-extrabold text-ink">어디로<br />떠나 볼까요?</h1>
            <EmptyState title={loggedIn ? "다가오는 여행이 없어요" : "아직 여행이 없어요"} desc="도시와 날짜만 정하면 바로 시작할 수 있어요"
              action={<GateCta href="/trips/new">여행 만들기</GateCta>} />
          </>
        )}

        {loggedIn && (
          <div className="flex gap-3">
            <Link href="/trips" className="press flex flex-1 rounded-card">
              <StatTile label="내 장소" value={String(past.reduce((n, t) => n + placeCount(t), 0))} caption="지금까지 다녀온 곳" tone="point" icon={<Pin size={20} />} />
            </Link>
            <Link href="/trips#past" className="press flex flex-1 rounded-card">
              <StatTile label="다녀온 여행" value={String(past.length)} caption="여행 탭에서 다시 보기" tone="accent" icon={<span aria-hidden="true" className="size-5 rounded-full border-2 border-dashed border-accent" />} />
            </Link>
          </div>
        )}

        {next.length > 1 && (
          <section className="flex flex-col gap-2" aria-label="다른 다가오는 여행">
            <SectionTitle title="다른 다가오는 여행" />
            {next.slice(1).map((t) => (
              <TripRow key={t.id} href={`/trips/${t.id}`} title={t.title} sub={periodText(t)} meta={`${t.cities.join(", ")} · 장소 ${placeCount(t)}개`} />
            ))}
          </section>
        )}
      </div>
      <MainTabs active="홈" />
    </AppShell>
  );
}
