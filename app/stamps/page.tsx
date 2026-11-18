/*
  S11 도장 (도감, 2026-11-16 부터 아래 탭바의 도장 탭, 0.57.0 수집 화면으로 개편)
  - 맨 위 : 모은 도장 수, 다음 목표까지 남은 수, 다음에 열릴 도장
  - 곧 열릴 도장 : 실루엣 대신 봉인 카드. 도장 모양은 받기 전까지 보여 주지 않는다
  - 목표 배지 : 첫 도장, 도장 5개 등. 못 이룬 것은 물음표
  - 모은 도장 : 나라별로 묶고, 7일 안에 받은 도장은 NEW
  ?c=도시번호 로 도장 메달 창을 바로 연다 (3단계 4, 2026-11-17 메달 창으로)
*/
import Link from "next/link";
import { SealedButton, EarnedStamp } from "@/components/stamp-cards";
import { AppShell, MainTabs, MockNote } from "@/components/screen";
import { GateCta } from "@/components/gate";
import { getViewer } from "@/lib/viewer";
import { loadStamps, type StampCard } from "@/lib/trips";
import { flagOf, countryOf } from "@/lib/countries";
import { addDays, daysBetween, md, todayKST } from "@/lib/mock";
import { GOALS, type Goal } from "@/lib/stamp-goals";
import { StampTester } from "@/components/stamp-tester";
import { GoalBadges } from "@/components/goal-badges";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "도장" };



function status(x: StampCard, today: string) {
  const n = x.next;
  if (!n) return { tone: "past" as const, badge: "", line: "다시 가면 열려요" };
  if (n.start <= today && today <= n.end) return { tone: "now" as const, badge: "지금", line: "지금 받을 수 있어요" };
  if (n.start > today) {
    const d = daysBetween(today, n.start);
    return { tone: "soon" as const, badge: `D-${d}`, line: `${md(n.start)}에 열려요` };
  }
  return { tone: "past" as const, badge: "", line: "다시 가면 열려요" };
}

/* 봉인 카드 : 도장 그림은 숨기고, 도시 이름과 열리는 때만 */
function SealedCard({ x, today }: { x: StampCard; today: string }) {
  const s = status(x, today);
  const body = (
    <div className={`relative flex h-full flex-col items-center gap-2 overflow-hidden rounded-card px-2 pb-3 pt-4 text-center ${s.tone === "past" ? "bg-surface" : "bg-deep text-on-deep"}`}>
      {s.badge && (
        <span className={`absolute right-2 top-2 rounded-full px-1.5 py-0.5 text-[11px] font-extrabold leading-none ${s.tone === "now" ? "bg-point text-white" : "bg-on-deep/15 text-on-deep"}`}>{s.badge}</span>
      )}
      <span className={`relative flex size-16 items-center justify-center rounded-full border-2 border-dashed ${s.tone === "past" ? "border-line-strong" : "border-point"}`}>
        <span className={`text-[28px] font-extrabold ${s.tone === "past" ? "text-ink-sub" : "text-point"}`}>?</span>
        {s.tone !== "past" && <>
          <span className="absolute -right-1 top-1 size-1.5 rounded-full bg-point" />
          <span className="absolute -left-0.5 bottom-2 size-1 rounded-full bg-on-deep/60" />
        </>}
      </span>
      <span className={`flex items-center gap-1 text-sub font-bold ${s.tone === "past" ? "text-ink" : ""}`}>
        {flagOf(x.country) && <img src={flagOf(x.country)!} alt="" width={14} height={14} className="rounded-sm" />}
        {x.name}
      </span>
      <span className={`text-[11px] leading-tight ${s.tone === "past" ? "text-ink-sub" : s.tone === "now" ? "font-bold text-point" : "text-on-deep-sub"}`}>{s.line}</span>
    </div>
  );
  // 누르면 여행으로 넘어가지 않고 받는 방법 안내 (2026-11-17 마루님)
  return <SealedButton x={x} tone={s.tone} label={s.line}>{body}</SealedButton>;
}

export default async function Stamps({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const { c } = await searchParams;
  const viewer = await getViewer();
  const s = await loadStamps(viewer);
  const today = todayKST();
  const picked = s.earned.find((x) => String(x.cityId) === c);
  const count = s.earned.length;
  const value = (g: Goal) => (g.of === "stamp" ? count : s.countryCount);
  const goal = GOALS.find((g) => value(g) < g.need);
  const prevNeed = goal ? Math.max(0, ...GOALS.filter((g) => g.of === goal.of && g.need < goal.need).map((g) => g.need)) : 0;
  const pct = goal ? Math.round(((value(goal) - prevNeed) / (goal.need - prevNeed)) * 100) : 100;
  const upcoming = s.missing.find((x) => status(x, today).tone !== "past");
  const newSince = addDays(today, -7);
  // 도장 테스트 칸 : DB 테스터 목록에 있는 계정만 (2026-11-18 마루님)
  let tester = false;
  if (viewer.kind === "user") { const sb = await createClient(); const { data } = sb ? await sb.rpc("am_stamp_tester") : { data: false }; tester = data === true; }

  /* 나라별 묶음 (많이 모은 나라 먼저) */
  const groups = [...s.earned.reduce((m, x) => m.set(x.country, [...(m.get(x.country) ?? []), x]), new Map<string, StampCard[]>())]
    .sort((a, b) => b[1].length - a[1].length);

  return (
    <AppShell>
      <header className="relative px-5 pt-4">
        <h1 className="text-title-xl font-extrabold text-ink">도장</h1>
      </header>
      {viewer.kind === "preview" && <MockNote />}
      <div className="flex flex-col gap-7 px-5 pb-6 pt-4">
        {tester && <StampTester />}
        {/* 수집 현황 */}
        <section aria-label="수집 현황" className="relative overflow-hidden rounded-deep bg-deep px-5 pb-5 pt-5 text-on-deep">
          <p className="text-tiny font-semibold text-on-deep-sub">모은 도장 카드</p>
          <p className="mt-1 flex items-end gap-1.5">
            <span className="text-[44px] font-extrabold leading-none tracking-tight">{count}</span>
            <span className="pb-1 text-body font-bold">개</span>
            {count > 0 && <span className="pb-1.5 pl-2 text-tiny text-on-deep-sub">나라 {s.countryCount}곳, 도시 {s.cityCount}곳</span>}
          </p>
          {goal ? (
            <div className="mt-4">
              <div className="flex items-center justify-between text-tiny">
                <span className="font-semibold">다음 목표 <b className="text-point">{goal.label}</b></span>
                <span className="text-on-deep-sub">{goal.need - value(goal)}{goal.of === "stamp" ? "개" : "곳"} 남았어요</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-on-deep/15">
                <div className="h-full rounded-full bg-point" style={{ width: `${Math.max(pct, 4)}%` }} />
              </div>
            </div>
          ) : <p className="mt-4 text-tiny font-semibold text-point">모든 목표를 이뤘어요</p>}
          {upcoming?.next && (
            <Link href={`/trips/${upcoming.next.tripId}`} className="press mt-4 flex min-h-11 items-center justify-between gap-2 rounded-field bg-on-deep/10 px-3 py-2">
              <span className="flex min-w-0 items-center gap-2 text-sub">
                <span className="flex size-7 flex-none items-center justify-center rounded-full border border-dashed border-point text-tiny font-extrabold text-point">?</span>
                <span className="truncate">다음에 열릴 도장 <b>{upcoming.name}</b></span>
              </span>
              <span className="flex-none text-tiny font-bold text-point">{status(upcoming, today).badge === "지금" ? "지금 받기" : status(upcoming, today).badge}</span>
            </Link>
          )}
        </section>

        {/* 곧 열릴 도장 */}
        {s.missing.length > 0 && (
          <section aria-labelledby="sealed" className="flex flex-col gap-3">
            <div>
              <h2 id="sealed" className="text-body font-bold text-ink">아직 열지 않은 도장 <span className="text-point">{s.missing.length}</span></h2>
              <p className="mt-0.5 text-tiny text-ink-sub">어떤 도장일지는 그 도시에 가야 알 수 있어요</p>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {s.missing.map((x) => <SealedCard key={`${x.country}:${x.name}`} x={x} today={today} />)}
            </div>
          </section>
        )}

        {/* 목표 배지 */}
        <section aria-labelledby="goals" className="flex flex-col gap-3">
          <h2 id="goals" className="text-body font-bold text-ink">목표 배지 <span className="text-sub font-semibold text-ink-sub">{GOALS.filter((g) => value(g) >= g.need).length}/{GOALS.length}</span></h2>
          <GoalBadges stamps={count} countries={s.countryCount} />
        </section>

        {/* 모은 도장 */}
        {count === 0 ? (
          <section aria-labelledby="howto" className="flex flex-col gap-3 rounded-card bg-surface px-4 py-5">
            <h2 id="howto" className="text-body font-bold text-ink">첫 도장 받는 법</h2>
            <ol className="flex flex-col gap-2.5">
              {["여행을 만들고 도시를 넣어요", "여행 기간에 그 도시에 가요", "여행 화면에서 [도장 받기] 를 눌러요"].map((t, i) => (
                <li key={t} className="flex items-center gap-2.5 text-sub text-ink">
                  <span className="flex size-6 flex-none items-center justify-center rounded-full bg-point text-tiny font-extrabold text-white">{i + 1}</span>{t}
                </li>
              ))}
            </ol>
            {s.missing.length === 0 && <div className="pt-1"><GateCta href="/trips/new">여행 만들기</GateCta></div>}
          </section>
        ) : (
          <section aria-labelledby="earned" className="flex flex-col gap-5">
            <h2 id="earned" className="text-body font-bold text-ink">도장 카드</h2>
            {groups.map(([code, list]) => (
              <div key={code} className="flex flex-col gap-3">
                <h3 className="flex items-center gap-1.5 text-sub font-bold text-ink">
                  {flagOf(code) && <img src={flagOf(code)!} alt="" width={16} height={16} className="rounded-sm" />}
                  {countryOf(code)?.name ?? code}
                  <span className="font-semibold text-ink-sub">{list.length}</span>
                </h3>
                <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
                  {list.map((x) => (
                    <EarnedStamp key={`${x.country}:${x.name}`} x={x} isNew={!!x.firstDate && x.firstDate >= newSince} startOpen={picked === x} />
                  ))}
                </div>
              </div>
            ))}
          </section>
        )}
      </div>
      <MainTabs active="도장" />
    </AppShell>
  );
}
