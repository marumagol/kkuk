/*
  S07 여행 상세 : 일자별 일정. ?day=2 처럼 일차를 고른다
  준비/기록 탭은 2단계 (1단계는 숨김). 장소 추가는 로그인 문지기를 거친다
*/
import Link from "next/link";
import { CategoryChip, PinCard, EmptyState, Icon } from "@/components/kit";
import { AppShell, BottomDock, Avatar, SectionTitle, MockNote } from "@/components/screen";
import { GateFab, GateCta } from "@/components/gate";
import { getViewer, isIn } from "@/lib/viewer";
import { getTrip, addDays, weekday, md, placeCount, statusOf, daysBetween, todayKST, tripLength } from "@/lib/mock";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ day?: string }> };

export async function generateMetadata({ params }: Props) {
  const t = getTrip((await params).id);
  return { title: t?.title ?? "여행" };
}

function BackLink() {
  return (
    <Link href="/trips" aria-label="여행 목록으로" className="press flex size-11 items-center justify-center rounded-full bg-surface text-ink">
      <Icon name="back" size={20} />
    </Link>
  );
}

export default async function TripDetail({ params, searchParams }: Props) {
  const loggedIn = isIn(await getViewer());
  const trip = loggedIn ? getTrip((await params).id) : undefined;

  if (!trip) {
    return (
      <AppShell>
        <div className="px-5 pt-4"><BackLink /></div>
        <div className="px-5 pt-6">
          <div role="alert" className="flex flex-col items-center gap-3 rounded-card bg-surface px-6 py-8 text-center">
            <h1 className="text-title font-bold text-ink">볼 수 없는 여행이에요</h1>
            <p className="text-sub text-ink-sub">{loggedIn ? "지워졌거나 함께하는 사람에서 빠진 여행일 수 있어요" : "로그인하면 내 여행을 볼 수 있어요"}</p>
            <Link href={loggedIn ? "/trips" : "/login"} className="press inline-flex h-11 items-center rounded-btn border border-line-strong bg-surface px-4 text-sub font-bold text-ink">
              {loggedIn ? "여행 목록으로" : "로그인"}
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  const len = tripLength(trip);
  const today = todayKST();
  const fallback = statusOf(trip, today) === "ongoing" ? daysBetween(trip.start, today) + 1 : 1;
  const asked = Number((await searchParams).day);
  const day = Number.isInteger(asked) && asked >= 1 && asked <= len ? asked : fallback;
  const plan = trip.days[day - 1] ?? { items: [] };

  return (
    <AppShell>
      <div className="flex items-center justify-between px-5 pt-4">
        <BackLink />
        <span className="flex -space-x-2" aria-label={`함께하는 사람 ${trip.members.length}명`}>
          {trip.members.map((m, i) => <Avatar key={i} initial={m.initial} tone={m.tone} size={32} ring />)}
        </span>
      </div>
      <MockNote />
      <div className="px-5 pt-3">
        <h1 className="text-title-xl font-extrabold text-ink">{trip.title}</h1>
        <p className="mt-1 text-sub text-ink-sub">{md(trip.start)} ~ {md(trip.end)}, 장소 {placeCount(trip)}개</p>
      </div>

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
          <div>
            {plan.items.map((it, i) => (
              <PinCard key={i} index={i + 1} time={it.time ?? ""} category={it.category} title={it.title}
                desc={it.desc ?? ""} editedBy={it.editedBy} last={i === plan.items.length - 1} />
            ))}
          </div>
        ) : (
          <EmptyState title="이 날은 아직 장소가 없어요" desc="가고 싶은 곳을 하나씩 추가해 보세요"
            action={<GateCta icon="plus" soon="장소 추가는 장소 넣기 단계(8단계)에서 열려요">장소 추가</GateCta>} />
        )}
      </section>

      {trip.undated.length > 0 && (
        <section className="flex flex-col gap-3 px-5 pt-6" aria-label="날짜 미정">
          <SectionTitle title="날짜 미정" aside={`${trip.undated.length}곳`} />
          <ul className="flex flex-col gap-2">
            {trip.undated.map((u) => (
              <li key={u.title} className="flex min-h-14 items-center gap-3 rounded-pin bg-surface px-4">
                <CategoryChip category={u.category} />
                <span className="min-w-0 flex-1 truncate text-body font-semibold text-ink">{u.title}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {plan.items.length > 0 && <BottomDock align="end"><GateFab /></BottomDock>}
    </AppShell>
  );
}
