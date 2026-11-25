/*
  도감 (하단 탭 "도장"). 디자인 가이드 5장 07, 피그마 07 의 아래 패널
  받은 도장은 색, 못 받은 도장은 회색 점선 원 + 이름만 ("?" 쓰지 않음)
  ?state=empty | loading | error 로 상태별 화면을 본다. 데이터는 모두 가짜
*/
import { notFound } from "next/navigation";
import { Button, Card, Stamp, TabBar, EmptyState, Icon } from "@/components/kit";
import { AppShell, BottomDock, SectionTitle, ErrorState, Skel, PhotoThumb, readState } from "@/components/screen";

export const metadata = { title: "도감 | 시안" };

const stats = [
  { n: "47", label: "다녀온 장소", point: true },
  { n: "7", label: "다녀온 도시" },
  { n: "2", label: "나라" },
];
const stamps = [
  { name: "삿포로", date: "26.12.28", earned: true, tilt: -8 },
  { name: "오타루", date: "26.12.29", earned: true, tilt: 5 },
  { name: "노보리베츠", date: "26.12.30", earned: true, tilt: -3 },
  { name: "비에이", date: "26.12.31", earned: true, tilt: 7 },
  { name: "후쿠오카", date: "26.05.03", earned: true, tilt: -6 },
  { name: "교토", date: "25.11.08", earned: true, tilt: 4 },
  { name: "타이베이", date: "25.02.14", earned: true, tilt: -5 },
  { name: "오사카", earned: false },
  { name: "도쿄", earned: false },
  { name: "하코다테", earned: false },
  { name: "오키나와", earned: false },
  { name: "가오슝", earned: false },
];
const recent = [
  { title: "오타루 운하", meta: "12.29, 삿포로 겨울 여행" },
  { title: "Noboribetsu Jigokudani Hell Valley Nature Trail", meta: "12.30, 삿포로 겨울 여행" },
];

function Head() {
  return (
    <header className="px-5 pt-6">
      <h1 className="text-title-xl font-extrabold text-ink">도감</h1>
      <p className="mt-1 text-sub text-ink-sub">다녀온 곳마다 도장이 하나씩 찍혀요</p>
    </header>
  );
}

export default async function CollectionScreen({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  if (process.env.NODE_ENV === "production" && process.env.SHOW_DEV_KIT !== "1") notFound();
  const state = readState((await searchParams).state);
  const earned = stamps.filter((s) => s.earned).length;

  return (
    <AppShell>
      <Head />
      <div className="flex flex-col gap-4 px-5 pt-5">
        {state === "ok" && (
          <>
            <Card className="grid grid-cols-3 gap-2 px-5 py-4">
              {stats.map((s) => (
                <div key={s.label}>
                  <div className={"text-number font-extrabold " + (s.point ? "text-point-text" : "text-ink")}>{s.n}</div>
                  <div className="text-sub text-ink-sub">{s.label}</div>
                </div>
              ))}
            </Card>

            <Card className="flex flex-col gap-4">
              <SectionTitle title="모은 도장" aside={`${earned} / ${stamps.length}`} />
              <ul className="grid grid-cols-4 gap-x-1 gap-y-4">
                {stamps.map((s) => (
                  <li key={s.name} className="flex justify-center">
                    <Stamp fluid name={s.name} date={s.date} earned={s.earned} tilt={s.tilt} />
                  </li>
                ))}
              </ul>
            </Card>

            <section className="flex flex-col gap-2" aria-label="최근 다녀온 장소">
              <SectionTitle title="최근 다녀온 장소" />
              {recent.map((r) => (
                <a key={r.title} href="#" className="press flex min-h-[72px] items-center gap-3 rounded-pin bg-surface px-3 py-3">
                  <PhotoThumb />
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 text-body font-bold leading-snug text-ink">{r.title}</span>
                    <span className="block text-tiny text-ink-sub">{r.meta}</span>
                  </span>
                  <Icon name="right" size={18} className="flex-none text-ink-sub" />
                </a>
              ))}
            </section>
          </>
        )}

        {state === "empty" && (
          <EmptyState title="아직 모은 도장이 없어요" desc="여행을 다녀오면 도시마다 도장이 찍혀요"
            action={<Button full icon="arrow">여행 만들기</Button>} />
        )}

        {state === "loading" && (
          <div aria-busy="true" aria-label="불러오는 중" className="flex flex-col gap-4">
            <Skel className="h-[92px] w-full rounded-card" />
            <div className="rounded-card bg-surface p-4">
              <Skel className="h-5 w-24 rounded-full" />
              <div className="mt-4 grid grid-cols-4 gap-y-4">
                {Array.from({ length: 8 }).map((_, i) => <Skel key={i} className="mx-auto size-[72px] rounded-full" />)}
              </div>
            </div>
          </div>
        )}

        {state === "error" && (
          <ErrorState title="도감을 불러오지 못했어요" desc="인터넷 연결을 확인하고 다시 불러와 주세요" />
        )}
      </div>
      <BottomDock><TabBar active="카드" /></BottomDock>
    </AppShell>
  );
}
