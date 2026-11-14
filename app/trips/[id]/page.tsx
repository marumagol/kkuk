/*
  S07 여행 상세 : 일자별 일정. ?day=2 처럼 일차를 고른다
  준비/기록 탭은 2단계 (1단계는 숨김). 장소 추가는 로그인 문지기를 거친다
*/
import Link from "next/link";
import { CategoryChip, EmptyState, Icon } from "@/components/kit";
import { AppShell, BottomDock, Avatar, SectionTitle, MockNote } from "@/components/screen";
import { GateFab, GateCta } from "@/components/gate";
import { SortablePlaces } from "@/components/sortable-places";
import { TripTabs } from "@/components/trip-tabs";
import { getViewer, isIn } from "@/lib/viewer";
import { addDays, weekday, md, placeCount, statusOf, daysBetween, todayOf, tripLength } from "@/lib/mock";
import { loadTrip } from "@/lib/trips";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ day?: string; saved?: string; removed?: string; undated?: string; joined?: string }> };

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
            <p className="text-sub text-ink-sub">{removed ? "여행 주인이 이 여행을 삭제했어요" : loggedIn ? "지워졌거나 함께하는 사람에서 빠진 여행일 수 있어요" : "로그인하면 내 여행을 볼 수 있어요"}</p>
            <Link href={loggedIn ? "/trips" : "/login"} className="press inline-flex h-11 items-center rounded-btn border border-line-strong bg-surface px-4 text-sub font-bold text-ink">
              {loggedIn ? "여행 목록으로" : "로그인"}
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  const len = tripLength(trip);
  const today = todayOf(trip);
  const fallback = statusOf(trip, today) === "ongoing" ? daysBetween(trip.start, today) + 1 : 1;
  const sp = await searchParams;
  const asked = Number(sp.day);
  const canEdit = "role" in r && r.role !== "viewer";
  // 실제 저장은 로그인(DB)일 때만. 미리보기는 버튼만 보이고 "곧 열려요"
  const editable = canEdit && viewer.kind === "user";
  const day = Number.isInteger(asked) && asked >= 1 && asked <= len ? asked : fallback;
  const plan = trip.days[day - 1] ?? { items: [] };
  const addHref = viewer.kind === "user" ? `/trips/${trip.id}/places/new?day=${day}` : undefined;

  return (
    <AppShell>
      <div className="flex items-center justify-between px-5 pt-4">
        <BackLink />
        {/* 함께하는 사람 : 누르면 목록과 초대 (2단계) */}
        <Link href={viewer.kind === "user" ? `/trips/${trip.id}/members` : "#"} aria-label={`함께하는 사람 ${trip.members.length}명${canEdit && "role" in r && r.role === "owner" ? ", 초대하기" : ""}`}
          className="press flex h-11 items-center gap-1 rounded-full bg-surface pl-1.5 pr-3">
          <span className="flex -space-x-2">
            {trip.members.slice(0, 4).map((m, i) => <Avatar key={i} initial={m.initial} tone={m.tone} size={32} ring src={m.avatar} />)}
          </span>
          {"role" in r && r.role === "owner" && viewer.kind === "user" ? <Icon name="plus" size={16} className="text-ink-sub" /> : <span className="text-tiny font-bold text-ink-sub">{trip.members.length}</span>}
        </Link>
      </div>
      {sp.removed && <p role="status" className="mx-5 mt-3 rounded-field bg-surface px-3 py-2 text-tiny font-semibold text-ink">삭제했어요</p>}
      {sp.joined && <p role="status" className="mx-5 mt-3 rounded-field bg-ok-soft px-3 py-2 text-tiny font-semibold text-ok-text">여행에 함께하게 됐어요</p>}
      {sp.saved && <p role="status" className="mx-5 mt-3 rounded-field bg-ok-soft px-3 py-2 text-tiny font-semibold text-ok-text">여행 정보를 저장했어요</p>}
      {viewer.kind === "preview" && <MockNote />}
      <div className="flex items-start gap-2 px-5 pt-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-title-xl font-extrabold text-ink">{trip.title}</h1>
          <p className="mt-1 text-sub text-ink-sub">{md(trip.start)} ~ {md(trip.end)}, 장소 {placeCount(trip)}개</p>
        </div>
        {/* 여행 정보 수정 : 제목 옆 연필 (주인, 편집 가능) */}
        {editable && (
          <Link href={`/trips/${trip.id}/edit`} aria-label="여행 정보 수정" className="press flex size-11 flex-none items-center justify-center rounded-full bg-surface text-ink">
            <Icon name="pencil" size={20} />
          </Link>
        )}
      </div>

      {viewer.kind === "user" && <TripTabs tripId={trip.id} active="일정" />}

      <nav className="mt-4 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none]" aria-label="날짜">
        {Array.from({ length: len }).map((_, i) => {
          const d = addDays(trip.start, i);
          const on = i + 1 === day;
          return (
            <Link key={d} href={`/trips/${trip.id}?day=${i + 1}`} replace scroll={false}
              aria-current={on ? "page" : undefined} aria-label={`${i + 1}일차, ${md(d)} ${weekday(d)}요일`}
              className={"press flex h-[60px] w-[52px] flex-none flex-col items-center justify-center rounded-field " + (on ? "bg-btn text-on-btn" : "bg-surface text-ink")}>
              <span className={"text-tiny " + (on ? "" : "text-ink-sub")}>{weekday(d)}</span>
              <span className="text-title font-bold">{Number(d.slice(8))}</span>
            </Link>
          );
        })}
      </nav>

      <section className="flex flex-col gap-3 px-5 pt-5" aria-label={`${day}일차 일정`}>
        <div>
          <span className="text-sub font-bold text-point-text">{day}일차</span>
          <h2 className="text-title-lg font-extrabold text-ink">{plan.title ?? `${md(addDays(trip.start, day - 1))} (${weekday(addDays(trip.start, day - 1))})`}</h2>
        </div>
        {plan.items.length ? (
          <SortablePlaces key={day} tripId={trip.id} items={plan.items} editable={editable} />
        ) : (
          <EmptyState title="이 날은 아직 장소가 없어요" desc="가고 싶은 곳을 하나씩 추가해 보세요"
            action={canEdit ? <GateCta icon="plus" href={addHref}>장소 추가</GateCta> : undefined} />
        )}
      </section>

      {trip.undated.length > 0 && (
        <section id="undated" className="flex scroll-mt-4 flex-col gap-3 px-5 pt-6" aria-label="날짜 미정">
          <SectionTitle title="날짜 미정" aside={`${trip.undated.length}곳`} />
          <ul className="flex flex-col gap-2">
            {trip.undated.map((u) => (
              <li key={u.id ?? u.title}>
                {editable && u.id ? (
                  <Link href={`/trips/${trip.id}/places/${u.id}`} className="press flex min-h-14 items-center gap-3 rounded-pin bg-surface px-4">
                    <CategoryChip category={u.category} />
                    <span className="min-w-0 flex-1 truncate text-body font-semibold text-ink">{u.title}</span>
                    <Icon name="right" size={18} className="flex-none text-ink-sub" />
                  </Link>
                ) : (
                  <div className="flex min-h-14 items-center gap-3 rounded-pin bg-surface px-4">
                    <CategoryChip category={u.category} />
                    <span className="min-w-0 flex-1 truncate text-body font-semibold text-ink">{u.title}</span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {plan.items.length > 0 && canEdit && <BottomDock align="end"><GateFab href={addHref} /></BottomDock>}
    </AppShell>
  );
}
