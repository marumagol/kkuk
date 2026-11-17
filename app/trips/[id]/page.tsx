/*
  S07 여행 상세 : 모든 날의 일정이 이어서 보인다 (2026-11-15 여행 메뉴 개편). ?day=2 면 그 날로 스크롤
  날짜 탭, 끌어서 날짜 옮기기는 components/day-board.tsx. 장소 추가는 로그인 문지기를 거친다
*/
import { FlashToast } from "@/components/toast";
import Link from "next/link";
import { after } from "next/server";
import { Icon } from "@/components/kit";
import { AppShell, MockNote } from "@/components/screen";
import { DayBoard } from "@/components/day-board";
import { OfflineSaver } from "@/components/offline-saver";
import { LiveRefresh } from "@/components/live-refresh";
import { TripTabs, TripHeader } from "@/components/trip-tabs";
import { StampClaim } from "@/components/stamp-claim";
import { getViewer, isIn } from "@/lib/viewer";
import { statusOf, daysBetween, todayOf, tripLength } from "@/lib/mock";
import { loadTrip, tripOpenLogger, coordsRefiller } from "@/lib/trips";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ day?: string; saved?: string; restored?: string; removed?: string; undated?: string; joined?: string }> };

export async function generateMetadata({ params }: Props) {
  const r = await loadTrip(await getViewer(), (await params).id);
  return { title: "trip" in r ? r.trip.title : "여행" };
}

function BackLink() {
  return (
    <Link href="/trips" aria-label="여행 목록으로" className="press flex size-11 items-center justify-center rounded-full bg-surface text-ink">
      <Icon name="back" size={20} />
    </Link>
  );
}

export default async function TripDetail({ params, searchParams }: Props) {
  const viewer = await getViewer();
  const loggedIn = isIn(viewer);
  const r = await loadTrip(viewer, (await params).id);
  const trip = "trip" in r ? r.trip : undefined;

  if (!trip) {
    const removed = "missing" in r && r.missing === "removed";
    return (
      <AppShell>
        <div className="px-5 pt-4"><BackLink /></div>
        <div className="px-5 pt-6">
          <div role="alert" className="flex flex-col items-center gap-3 rounded-card bg-surface px-6 py-8 text-center">
            <h1 className="text-title font-bold text-ink">{removed ? "삭제된 여행이에요" : "볼 수 없는 여행이에요"}</h1>
            <p className="text-sub text-ink-sub">{removed ? "호스트가 이 여행을 삭제했어요. 호스트는 30일 안에 설정 > 최근 삭제한 여행에서 되살릴 수 있어요" : loggedIn ? "지워졌거나 함께하는 사람에서 빠진 여행일 수 있어요" : "로그인하면 내 여행을 볼 수 있어요"}</p>
            <Link href={loggedIn ? "/trips" : "/login"} className="press inline-flex h-11 items-center rounded-btn border border-line-strong bg-surface px-4 text-sub font-bold text-ink">
              {loggedIn ? "여행 목록으로" : "로그인"}
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  const logOpen = await tripOpenLogger(viewer, trip.id);
  if (logOpen) after(logOpen); // 화면을 다 보낸 뒤에 기록
  const refill = await coordsRefiller(viewer, trip.id);
  if (refill) after(refill);
  const len = tripLength(trip);
  const today = todayOf(trip);
  const ongoing = statusOf(trip, today) === "ongoing";
  const fallback = ongoing ? daysBetween(trip.start, today) + 1 : 1;
  const sp = await searchParams;
  const asked = Number(sp.day);
  const canEdit = "role" in r && r.role !== "viewer";
  const owner = "role" in r && r.role === "owner";
  // 실제 저장은 로그인(DB)일 때만. 미리보기는 버튼만 보이고 "곧 열려요"
  const editable = canEdit && viewer.kind === "user";
  const valid = Number.isInteger(asked) && asked >= 1 && asked <= len;
  const day = valid ? asked : fallback;

  return (
    <AppShell>
      <TripHeader trip={trip} meId={viewer.kind === "user" ? viewer.id : undefined} user={viewer.kind === "user"} owner={owner} editable={editable} />
      {sp.removed && <FlashToast message="삭제했어요" param="removed" />}
      {sp.joined && <FlashToast message="여행에 함께하게 됐어요" param="joined" />}
      {sp.restored && <FlashToast message="여행을 되살렸어요" param="restored" />}
      {sp.saved && <FlashToast message="여행 정보를 저장했어요" param="saved" />}
      {viewer.kind === "preview" && <MockNote />}
      {viewer.kind === "user" && <TripTabs tripId={trip.id} active="일정" />}
      {viewer.kind === "user" && <LiveRefresh tripId={trip.id} />}
      {viewer.kind === "user" && ongoing && <StampClaim tripId={trip.id} city={trip.cities[0]} />}

      <DayBoard tripId={trip.id} start={trip.start} days={trip.days.slice(0, len)} undated={trip.undated}
        editable={editable} canAdd={canEdit} user={viewer.kind === "user"} initialDay={sp.day === "all" ? 0 : day}
        jump={(valid && asked > 1) || (!valid && ongoing && day > 1)} jumpUndated={!!sp.undated} />
      {viewer.kind === "user" && statusOf(trip, today) !== "past" && <OfflineSaver tripId={trip.id} days={len} />}
    </AppShell>
  );
}
