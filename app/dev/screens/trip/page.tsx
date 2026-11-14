/*
  03 여행 상세 : 일정 (타임라인). 디자인 가이드 5장, 피그마 03. 데이터는 모두 가짜
  ?state=empty | loading | error 로 상태별 화면을 본다
*/
import { notFound } from "next/navigation";
import { Button, CategoryChip, PinCard, FloatingPinButton, EmptyState, SkeletonPinCard, Icon, type Category } from "@/components/kit";
import { AppShell, BottomDock, Avatar, RoundButton, SectionTitle, ErrorState, Skel, readState } from "@/components/screen";

export const metadata = { title: "일정 | 시안" };

const days = [
  { w: "월", d: "28" }, { w: "화", d: "29" }, { w: "수", d: "30" }, { w: "목", d: "31" },
  { w: "금", d: "1" }, { w: "토", d: "2" }, { w: "일", d: "3" }, { w: "월", d: "4" },
];
const SELECTED = 1; // 2일차
const items: { time: string; category: Category; title: string; desc: string; editedBy?: string }[] = [
  { time: "08:40", category: "이동", title: "JR 쾌속 에어포트, 삿포로 → 오타루", desc: "약 40분, 오른쪽 창가 자리가 바다 쪽" },
  { time: "09:30", category: "쇼핑", title: "오타루 오르골당 본관", desc: "예상 2,000엔, 오전에 덜 붐빔", editedBy: "윤" },
  { time: "12:30", category: "식사", title: "나루토 반마리 닭튀김", desc: "예상 1,500엔, 현금만" },
  { time: "15:00", category: "관광", title: "Otaru Canal Gas Lamp Evening Walking Course", desc: "16시 전후 가스등 점등" },
];
const undated: { category: Category; title: string }[] = [
  { category: "식사", title: "징기스칸 다루마 본점" },
  { category: "관광", title: "시로이 코이비토 파크" },
];

function TopBar() {
  return (
    <div className="flex items-center justify-between px-5 pt-4">
      <RoundButton icon="back" label="뒤로" />
      <div className="flex items-center gap-2">
        <span className="flex -space-x-2">
          <Avatar initial="도" size={32} ring />
          <Avatar initial="윤" tone="accent" size={32} ring />
        </span>
        <button className="press inline-flex h-11 items-center gap-1 rounded-full px-2 text-sub font-bold text-ink">
          <span className="inline-flex h-7 items-center gap-1 rounded-full bg-btn px-2.5 text-tiny text-on-btn">
            <Icon name="plus" size={14} strokeWidth={2} /> 초대
          </span>
        </button>
      </div>
    </div>
  );
}

function TripHead() {
  return (
    <div className="px-5 pt-3">
      <h1 className="text-title-xl font-extrabold text-ink">삿포로 겨울 여행</h1>
      <p className="mt-1 text-sub text-ink-sub">12.28 ~ 1.4, 장소 23개</p>
    </div>
  );
}

/* 일정 / 준비 / 기록. 스크롤해도 위에 붙어 있다
   1단계는 일정만 있어 탭 줄을 숨긴다 (2026-11-14 마루님 결정). 준비/기록이 생기는 2단계에 SHOW_TRIP_TABS 를 켠다 */
const SHOW_TRIP_TABS = false;
function TripTabs() {
  if (!SHOW_TRIP_TABS) return <div className="h-4" />;
  const tabs = ["일정", "준비", "기록"];
  return (
    <div className="sticky top-0 z-10 bg-bg px-5 py-3">
      <div role="tablist" className="flex rounded-btn bg-surface-soft p-1">
        {tabs.map((t, i) => (
          <button key={t} role="tab" aria-selected={i === 0}
            className={i === 0 ? "h-11 flex-1 rounded-[14px] bg-surface text-body font-bold text-ink" : "h-11 flex-1 rounded-[14px] text-body font-semibold text-ink"}>
            {t}
          </button>
        ))}
      </div>
    </div>
  );
}

function DateStrip() {
  return (
    <div className="flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none]" aria-label="날짜">
      {days.map((d, i) => (
        <button key={i} aria-pressed={i === SELECTED} aria-label={`${i + 1}일차, ${d.d}일 ${d.w}요일`}
          className={"press flex h-[60px] w-[52px] flex-none flex-col items-center justify-center rounded-field " +
            (i === SELECTED ? "bg-btn text-on-btn" : "bg-surface text-ink")}>
          <span className={"text-tiny " + (i === SELECTED ? "" : "text-ink-sub")}>{d.w}</span>
          <span className="text-title font-bold">{d.d}</span>
        </button>
      ))}
    </div>
  );
}

export default async function TripScreen({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  if (process.env.NODE_ENV === "production" && process.env.SHOW_DEV_KIT !== "1") notFound();
  const state = readState((await searchParams).state);

  if (state === "loading") {
    return (
      <AppShell>
        <div aria-busy="true" aria-label="불러오는 중" className="flex flex-col gap-4 px-5 pt-4">
          <Skel className="size-11 rounded-full" />
          <Skel className="h-8 w-48 rounded-full" />
          <Skel className="h-4 w-32 rounded-full" />
          <div className="flex gap-2 overflow-hidden">{[0, 1, 2, 3, 4, 5].map((i) => <Skel key={i} className="h-[60px] w-[52px] flex-none rounded-field" />)}</div>
          <Skel className="mt-2 h-6 w-36 rounded-full" />
          <div><SkeletonPinCard /><div className="h-3" /><SkeletonPinCard /><div className="h-3" /><SkeletonPinCard /></div>
        </div>
      </AppShell>
    );
  }

  if (state === "error") {
    return (
      <AppShell>
        <div className="px-5 pt-4"><RoundButton icon="back" label="뒤로" /></div>
        <div className="px-5 pt-6">
          <ErrorState title="일정을 불러오지 못했어요" desc="인터넷 연결을 확인하고 다시 불러와 주세요" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <TopBar />
      <TripHead />
      <TripTabs />
      <DateStrip />

      <section className="flex flex-col gap-3 px-5 pt-5" aria-label="2일차 일정">
        <div>
          <span className="text-sub font-bold text-point-text">2일차</span>
          <h2 className="text-title-lg font-extrabold text-ink">오타루 당일치기</h2>
        </div>

        {state === "ok" ? (
          <div>
            {items.map((it, i) => (
              <PinCard key={it.title} index={i + 1} time={it.time} category={it.category} title={it.title}
                desc={it.desc} editedBy={it.editedBy} last={i === items.length - 1} />
            ))}
          </div>
        ) : (
          <EmptyState title="이 날은 아직 장소가 없어요" desc="가고 싶은 곳을 하나씩 추가해 보세요"
            action={<Button full icon="plus">장소 추가</Button>} />
        )}
      </section>

      {state === "ok" && (
        <section className="flex flex-col gap-3 px-5 pt-6" aria-label="날짜 미정">
          <SectionTitle title="날짜 미정" aside={`${undated.length}곳`} />
          <ul className="flex flex-col gap-2">
            {undated.map((u) => (
              <li key={u.title} className="flex min-h-14 items-center gap-3 rounded-pin bg-surface px-4">
                <CategoryChip category={u.category} />
                <span className="min-w-0 flex-1 truncate text-body font-semibold text-ink">{u.title}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {state === "ok" && <BottomDock align="end"><FloatingPinButton /></BottomDock>}
    </AppShell>
  );
}
