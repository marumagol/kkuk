/* S11 도장 (도감, 2026-11-16 부터 아래 탭바의 도장 탭) : 모은 도장 / 아직 못 받은 도장 (내 여행에 넣은 도시). ?c=도시번호 로 도장 자세히 (3단계 4) */
import Link from "next/link";
import { EmptyState, Stamp, StampFace } from "@/components/kit";
import { AppShell, MainTabs, MockNote } from "@/components/screen";
import { GateCta } from "@/components/gate";
import { getViewer } from "@/lib/viewer";
import { loadStamps } from "@/lib/trips";
import { flagOf, countryOf } from "@/lib/countries";

export const metadata = { title: "도장" };

const dot = (d?: string) => (d ? d.slice(2).replaceAll("-", ".") : undefined);
const tiltOf = (name: string) => ([...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 17) - 8;

export default async function Stamps({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const { c } = await searchParams;
  const viewer = await getViewer();
  const s = await loadStamps(viewer);
  const picked = s.earned.find((x) => String(x.cityId) === c);
  const empty = s.earned.length === 0;

  return (
    <AppShell>
      <header className="relative px-5 pt-4">
        <div className="flex items-center gap-2">
          <h1 className="text-title-xl font-extrabold text-ink">도장</h1>
        </div>
        <p className="mt-1 text-sub text-ink-sub">여행 중에 그 도시에 있으면 도장이 찍혀요</p>
      </header>
      {viewer.kind === "preview" && <MockNote />}
      <div className="flex flex-col gap-6 px-5 pt-5">
        {picked && (
          <section aria-label={`${picked.name} 도장`} className="flex flex-col items-center gap-3 rounded-card bg-surface px-4 py-5 text-center">
            <div className="-rotate-6"><StampFace name={picked.name} country={picked.country} size={120} /></div>
            <div>
              <h2 className="flex items-center justify-center gap-1.5 text-title font-extrabold text-ink">
                {flagOf(picked.country) && <img src={flagOf(picked.country)!} alt="" width={18} height={18} className="rounded-sm" />}
                {picked.name}
              </h2>
              <p className="mt-1 text-sub text-ink-sub">{countryOf(picked.country)?.name ?? ""} · 처음 받은 날 {dot(picked.firstDate)} · {picked.visits}번 방문</p>
            </div>
            <ul className="flex w-full flex-col gap-1.5 text-left">
              {picked.trips.map((t) => (
                <li key={t.id}>
                  <Link href={`/trips/${t.id}`} className="press flex min-h-11 items-center justify-between gap-2 rounded-field bg-bg px-3 py-2 text-sub">
                    <span className="truncate font-semibold text-ink">{t.title}</span>
                    {t.verifiedBy && <span className="flex-none text-tiny text-ink-sub">{t.verifiedBy === "나" ? "내가 인증" : `${t.verifiedBy}님이 인증`}</span>}
                  </Link>
                </li>
              ))}
            </ul>
            <Link href="/stamps" replace className="press flex h-11 items-center px-4 text-sub font-semibold text-ink-sub">닫기</Link>
          </section>
        )}

        {empty ? (
          <EmptyState title="아직 모은 도장이 없어요" desc="여행 기간에 여행 도시에 가면, 여행 화면의 [도장 받기] 로 도장을 받을 수 있어요"
            action={<GateCta href="/trips/new">여행 만들기</GateCta>} />
        ) : (
          <section aria-label="모은 도장" className="flex flex-col gap-3">
            <h2 className="text-body font-bold text-ink">모은 도장 <span className="text-sub font-semibold text-ink-sub">도시 {s.cityCount} · 나라 {s.countryCount}</span></h2>
            <div className="grid grid-cols-3 gap-x-2 gap-y-4 sm:grid-cols-4">
              {s.earned.map((x) => (
                <Link key={`${x.country}:${x.name}`} href={x.cityId ? `/stamps?c=${x.cityId}` : "#"} replace scroll={false}
                  aria-label={`${x.name} 도장, ${x.visits}번 방문`} className="press flex justify-center">
                  <Stamp fluid name={x.name} country={x.country} date={dot(x.firstDate)} tilt={tiltOf(x.name)} />
                </Link>
              ))}
            </div>
          </section>
        )}

        {s.missing.length > 0 && (
          <section aria-label="아직 못 받은 도장" className="flex flex-col gap-3">
            <h2 className="text-body font-bold text-ink">아직 못 받은 도장 <span className="text-sub font-semibold text-ink-sub">내 여행의 도시</span></h2>
            <div className="grid grid-cols-3 gap-x-2 gap-y-4 sm:grid-cols-4">
              {s.missing.map((x) => (
                <div key={`${x.country}:${x.name}`} className="flex justify-center"><Stamp fluid name={x.name} country={x.country} earned={false} /></div>
              ))}
            </div>
          </section>
        )}
      </div>
      <MainTabs active="도장" />
    </AppShell>
  );
}
