/*
  조각 모음 화면 (디자인-가이드.md 7장 3번)
  공통 조각을 한 화면에 모아 라이트/다크로 확인한다. 데이터는 모두 가짜.
  화면 번호(1~9)로 "3번 더 크게" 처럼 피드백을 받는다.
*/
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import {
  Button, IconButton, FloatingPinButton, Chip, CategoryChip, Card, StatTile, PinCard, Field, Sheet,
  Stamp, TicketCard, EmptyState, OfflineBar, SkeletonPinCard, TabBar, Pin, Icon,
} from "@/components/kit";

export const metadata = { title: "조각 모음 | 핀모리" };

function Block({ no, title, note, children }: { no: number; title: string; note?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3" id={`kit-${no}`}>
      <header className="flex items-baseline gap-2 border-b border-line pb-2">
        <span className="flex size-6 items-center justify-center rounded-full bg-btn text-tiny font-bold text-on-btn">{no}</span>
        <h2 className="text-title font-bold">{title}</h2>
        {note && <span className="ml-auto text-tiny text-ink-sub">{note}</span>}
      </header>
      {children}
    </section>
  );
}

export default function KitPage() {
  // 실제 서비스 주소에서는 숨긴다. 확인이 필요할 때만 SHOW_DEV_KIT=1 로 빌드
  if (process.env.NODE_ENV === "production" && process.env.SHOW_DEV_KIT !== "1") notFound();
  return (
    <main className="mx-auto flex w-full max-w-[430px] flex-col gap-10 px-5 pb-16 pt-8">
      <div>
        <h1 className="text-title-xl font-extrabold">조각 모음</h1>
        <p className="mt-1 text-sub text-ink-sub">핀모리 공통 조각, 라이트/다크 확인용</p>
      </div>

      <Block no={1} title="버튼" note="높이 56 / 44">
        <Button full icon="arrow">다음</Button>
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1">취소</Button>
          <Button className="flex-1">저장</Button>
        </div>
        <Button full disabled>저장</Button>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="md" variant="secondary">모두 보기</Button>
          <Button size="md" variant="ghost">나중에</Button>
          <IconButton icon="bell" label="알림" />
          <IconButton icon="plus" label="장소 추가" tone="point" />
          <FloatingPinButton />
        </div>
      </Block>

      <Block no={2} title="카드">
        <div className="flex gap-3">
          <StatTile label="내 장소" value="24" caption="지금까지 다녀온 곳" tone="point" icon={<Pin size={20} />} />
          <StatTile label="모은 도장" value="3" caption="도시를 다녀왔어요" tone="accent"
            icon={<span className="size-5 rounded-full border-2 border-dashed border-accent" />} />
        </div>
        <Card>
          <div className="flex items-center justify-between">
            <h3 className="text-body font-bold">챙길 일</h3>
            <span className="text-tiny font-bold text-point-text">2개 남음</span>
          </div>
          <ul className="mt-3 flex flex-col gap-3">
            <li className="flex items-center justify-between gap-2 text-sub font-semibold">오타루 기념품 가게 입장 방식 확인<Chip tone="point">12월 중순</Chip></li>
            <li className="flex items-center justify-between gap-2 text-sub font-semibold">삿포로 수프카레 점심 예약<Chip tone="warn">예약 전</Chip></li>
          </ul>
        </Card>
        <div>
          <PinCard index={1} time="08:40" category="이동" title="JR 쾌속 → 오타루역" desc="약 40분, 오른쪽 좌석이 바다 풍경" />
          <PinCard index={2} time="12:30" category="식사" title="운하 앞 해산물 덮밥" desc="예상 비용 3,000엔" editedBy="다온" />
          <PinCard index={3} time="15:30" category="관광" title="Otaru Canal Sunset Walk and Glass Street Tour" desc="긴 영어 이름은 두 줄까지 보여요" last />
        </div>
      </Block>

      <Block no={3} title="칩">
        <div className="flex flex-wrap gap-2">
          <Chip>기본</Chip><Chip selected>선택됨</Chip><Chip tone="surface">흰 칩</Chip><Chip tone="point">12월 중순</Chip><Chip tone="warn">예약 전</Chip><Chip tone="accent">보기만</Chip><Chip tone="ok">편집 가능</Chip>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["이동", "식사", "관광", "쇼핑", "숙소"] as const).map((c) => <CategoryChip key={c} category={c} />)}
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="text-tiny text-ink-sub">고르는 칩 (터치 44px)</span>
          {["이동", "식사", "관광", "쇼핑", "숙소"].map((c, i) => <Chip key={c} size="md" tone="surface" selected={i === 2}>{c}</Chip>)}
        </div>
      </Block>

      <Block no={4} title="입력칸">
        <Field label="어디에 갈까요?" placeholder="장소 이름" defaultValue="오타루 운하" icon={<Pin size={20} />} />
        <div className="flex gap-2.5">
          <div className="min-w-0 flex-1"><Field label="시간" defaultValue="15:30" icon={<Icon name="clock" size={20} className="text-ink-sub" />} /></div>
          <div className="min-w-0 flex-1"><Field label="예상 비용" placeholder="0" inputMode="numeric" hint="엔" /></div>
        </div>
        <Field label="여행 이름" defaultValue="" placeholder="예 : 삿포로 겨울 여행" error="여행 이름을 적어 주세요" />
        <Field label="도시" defaultValue="삿포로" disabled hint="만든 뒤에는 여행 정보에서 바꿀 수 있어요" />
      </Block>

      <Block no={5} title="아래 시트" note="장소 추가">
        <div className="overflow-hidden rounded-card bg-scrim pt-16">
          <Sheet inline title="장소 추가" badge={<Chip tone="surface">2일차, 12.29 (화)</Chip>}
            footer={<Button full>장소 추가</Button>}>
            <Field label="어디에 갈까요?" defaultValue="오타루 운하" icon={<Pin size={20} />} />
            <div className="flex flex-col gap-2">
              <span className="text-sub font-bold text-ink-sub">분류</span>
              <div className="flex flex-wrap gap-1.5">
                {["이동", "식사", "관광", "쇼핑", "숙소"].map((c) => <Chip key={c} size="md" tone="surface" selected={c === "관광"}>{c}</Chip>)}
              </div>
            </div>
            <div className="flex gap-2.5">
              <div className="min-w-0 flex-1"><Field label="시간" defaultValue="15:30" /></div>
              <div className="min-w-0 flex-1"><Field label="예상 비용" placeholder="0 엔" /></div>
            </div>
          </Sheet>
        </div>
      </Block>

      <Block no={6} title="도장" note="받은 것 / 못 받은 것">
        <Card className="flex justify-between">
          <Stamp name="오타루" date="2026.12.29" tilt={-6} />
          <Stamp name="삿포로" date="2026.12.28" tilt={5} />
          <Stamp name="노보리베츠" earned={false} />
        </Card>
      </Block>

      <Block no={7} title="탑승권 카드" note="다가오는 여행">
        <TicketCard dday="D-44" title="삿포로 겨울 여행" period="12.28 (월) ~ 1.4 (월), 7박 8일"
          stops={["삿포로", "오타루", "노보리베츠", "비에이"]} pinCount={23} ready={68}
          members={[{ initial: "마", tone: "point" }, { initial: "다", tone: "accent" }]} />
      </Block>

      <Block no={8} title="빈 상태, 오프라인, 불러오는 중">
        <EmptyState title="아직 여행이 없어요" desc="첫 번째로 갈 곳부터 정해 볼까요?" action={<Button full icon="arrow">여행 만들기</Button>} />
        <OfflineBar />
        <SkeletonPinCard />
      </Block>

      <Block no={9} title="하단 탭">
        <TabBar active="홈" />
      </Block>
    </main>
  );
}
