/*
  S01 홈 : 다가오는 여행, 여행 중인 여행만. 다녀온 여행은 여행 탭에서 (2026-11-14 결정)
  로그인 전은 빈 상태 (예시 여행 없음, 0단계 결정)
*/
import Link from "next/link";
import { EmptyState, StatTile, TicketCard, Pin, PinCard } from "@/components/kit";
import { AppShell, Logo, Avatar, SectionTitle, MainTabs, MockNote, TripRow } from "@/components/screen";
import { GateCta } from "@/components/gate";
import { getViewer, isIn, initialOf } from "@/lib/viewer";
import { upcomingOf, pastOf, statusOf, daysBetween, todayOf, periodText, placeCount } from "@/lib/mock";
import { loadTrips, loadTrip } from "@/lib/trips";

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
  // 여행 중이면 오늘(여행 시간대 기준) 일정을 먼저 보여 준다
  const ongoing = !!hero && statusOf(hero, today) === "ongoing";
  const dayNo = ongoing ? daysBetween(hero.start, today) + 1 : 0;
  const full = ongoing ? await loadTrip(viewer, hero.id) : null;
  const todayItems = full && "trip" in full ? full.trip.days[dayNo - 1]?.items ?? [] : [];
  const canEdit = !!full && "role" in full && full.role !== "viewer" && viewer.kind === "user";
  const left = hero && !ongoing ? daysBetween(today, hero.start) : 0;

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
                {left === 1 ? <>{hero.cities[0]},<br /><span className="text-point-text">내일</span> 떠나요</>
                  : <>{hero.cities[0]}까지<br /><span className="text-point-text">{left}일</span> 남았어요</>}
              </h1>
            )}
            <Link href={`/trips/${hero.id}`} aria-label={`${hero.title} 일정 보기`} className="press block rounded-deep">
              <TicketCard
                dday={statusOf(hero, today) === "ongoing" ? `${daysBetween(hero.start, today) + 1}일차` : `D-${daysBetween(today, hero.start)}`}
                title={hero.title} period={periodText(hero)} stops={hero.cities} pinCount={placeCount(hero)}
                ready={hero.ready} members={hero.members} />
            </Link>
            {ongoing && (
              <section className="flex flex-col gap-3 pt-2" aria-labelledby="today-title">
                <div className="flex items-end justify-between">
                  <h2 id="today-title" className="text-title-lg font-extrabold text-ink">오늘 일정</h2>
                  <Link href={`/trips/${hero.id}?day=${dayNo}`} className="press inline-flex h-11 items-center px-1 text-sub font-semibold text-ink-sub underline underline-offset-4">전체 일정</Link>
                </div>
                {todayItems.length ? (
                  <div>
                    {todayItems.map((it, i) => (
                      <PinCard key={it.id ?? i} index={i + 1} time={it.time ?? ""} category={it.category} title={it.title}
                        desc={it.desc ?? ""} last={i === todayItems.length - 1}
                        href={canEdit && it.id ? `/trips/${hero.id}/places/${it.id}` : undefined} />
                    ))}
                  </div>
                ) : (
                  <EmptyState title="오늘은 아직 장소가 없어요" desc="오늘 갈 곳을 추가해 보세요"
                    action={canEdit ? <GateCta icon="plus" href={`/trips/${hero.id}/places/new?day=${dayNo}`}>장소 추가</GateCta> : undefined} />
                )}
              </section>
            )}
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
            {/* 피그마 01 홈 "모은 도장" : 다녀온 여행의 도시 수 (도장 기능 전까지는 이 숫자로) */}
            <Link href="/stamps" className="press flex flex-1 rounded-card">
              <StatTile label="모은 도장" value={String(new Set(past.flatMap((t) => t.cities)).size)} caption="도시를 다녀왔어요" tone="stamp" icon={<span aria-hidden="true" className="size-5 rounded-full border-2 border-dashed border-point-text" />} />
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
