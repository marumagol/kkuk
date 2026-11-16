/*
  01 홈 (디자인 가이드 5장, 피그마 01). 데이터는 모두 가짜
  ?state=empty | loading | error 로 상태별 화면을 본다
*/
import { notFound } from "next/navigation";
import { Button, Card, Chip, StatTile, TicketCard, TabBar, EmptyState, Pin } from "@/components/kit";
import { AppShell, BottomDock, Logo, Avatar, RoundButton, SectionTitle, ErrorState, Skel, readState } from "@/components/screen";

export const metadata = { title: "홈 | 시안" };

const trip = {
  city: "삿포로", days: 45, dday: "D-45", title: "삿포로 겨울 여행",
  period: "12.28 (월) ~ 1.4 (월), 7박 8일",
  stops: ["삿포로", "오타루", "노보리베츠", "비에이"], pinCount: 23, ready: 68,
  members: [{ initial: "도", tone: "point" as const }, { initial: "윤", tone: "accent" as const }],
};
const todos = [
  { title: "오타루 오르골당 본관 운영 시간 확인", chip: "12월 중순", tone: "warn" as const },
  { title: "라 브릭 삿포로 점심 예약", chip: "예약 전", tone: "soft" as const },
];

function StampMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="8" fill="none" stroke="var(--accent)" strokeWidth="1.75" strokeDasharray="3 2.4" />
    </svg>
  );
}

function Header() {
  return (
    <header className="flex items-center justify-between px-5 pb-2 pt-4">
      <Logo />
      <div className="flex items-center gap-2">
        <RoundButton icon="bell" label="알림" />
        <Avatar initial="도" />
      </div>
    </header>
  );
}

export default async function HomeScreen({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  if (process.env.NODE_ENV === "production" && process.env.SHOW_DEV_KIT !== "1") notFound();
  const state = readState((await searchParams).state);

  return (
    <AppShell>
      <Header />
      <div className="flex flex-col gap-4 px-5 pt-3">
        {state === "ok" && (
          <>
            <h1 className="text-title-xl font-extrabold text-ink">
              {trip.city}까지 <span className="text-point-text">{trip.days}일</span> 남았어요
            </h1>
            <TicketCard dday={trip.dday} title={trip.title} period={trip.period} stops={trip.stops}
              pinCount={trip.pinCount} ready={trip.ready} members={trip.members} />
            <div className="flex gap-3">
              <StatTile label="내 장소" value="24" caption="지금까지 다녀온 곳" tone="point" icon={<Pin size={20} />} />
              <StatTile label="모은 도장" value="3" caption="도시를 다녀왔어요" tone="accent" icon={<StampMark />} />
            </div>
            <Card className="flex flex-col gap-3">
              <SectionTitle title="챙길 일" aside={`${todos.length}개 남음`} asideTone="point" />
              <ul className="flex flex-col">
                {todos.map((t) => (
                  <li key={t.title} className="flex min-h-11 items-center justify-between gap-3">
                    <span className="min-w-0 text-body text-ink">{t.title}</span>
                    <Chip tone={t.tone}>{t.chip}</Chip>
                  </li>
                ))}
              </ul>
            </Card>
          </>
        )}

        {state === "empty" && (
          <>
            <h1 className="text-title-xl font-extrabold text-ink">어디로 떠나 볼까요?</h1>
            <EmptyState title="아직 여행이 없어요" desc="도시와 날짜만 정하면 바로 시작할 수 있어요"
              action={<Button full icon="arrow">여행 만들기</Button>} />
          </>
        )}

        {state === "loading" && (
          <div aria-busy="true" aria-label="불러오는 중" className="flex flex-col gap-4">
            <Skel className="h-9 w-40 rounded-full" />
            <Skel className="h-9 w-52 rounded-full" />
            <Skel className="h-[300px] w-full rounded-deep" />
            <div className="flex gap-3">
              <Skel className="h-[112px] flex-1 rounded-card" />
              <Skel className="h-[112px] flex-1 rounded-card" />
            </div>
          </div>
        )}

        {state === "error" && (
          <>
            <h1 className="text-title-xl font-extrabold text-ink">내 여행</h1>
            <ErrorState title="여행을 불러오지 못했어요" desc="인터넷 연결을 확인하고 다시 불러와 주세요" />
          </>
        )}
      </div>
      <BottomDock><TabBar active="홈" /></BottomDock>
    </AppShell>
  );
}
