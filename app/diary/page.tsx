/* S19 일기 탭 (2단계) : 내가 볼 수 있는 여행일기 최신순 + 지금 여행의 일기 쓰기 바로 가기 */
import Link from "next/link";
import { EmptyState, Icon } from "@/components/kit";
import { AppShell, MainTabs } from "@/components/screen";
import { GateCta } from "@/components/gate";
import { getViewer } from "@/lib/viewer";
import { loadDiaryFeed, loadTrips, type DiaryFilter } from "@/lib/trips";
import { upcomingOf, pastOf, statusOf, todayOf, daysBetween, addDays, md } from "@/lib/mock";
import { EntryCard } from "@/components/entry-card";

export const metadata = { title: "일기" };

const FILTERS: { f: DiaryFilter; label: string; empty: string }[] = [
  { f: "all", label: "전체", empty: "아직 일기가 없어요" },
  { f: "mine", label: "내가 쓴", empty: "아직 쓴 일기가 없어요" },
  { f: "liked", label: "좋아요한", empty: "좋아요한 일기가 없어요" },
  { f: "commented", label: "댓글 단", empty: "댓글이나 답글을 단 일기가 없어요" },
];

export default async function Diary({ searchParams }: { searchParams: Promise<{ removed?: string; f?: string }> }) {
  const { removed, f } = await searchParams;
  const filter = FILTERS.find((x) => x.f === f) ?? FILTERS[0];
  const viewer = await getViewer();
  const [feed, trips] = await Promise.all([loadDiaryFeed(viewer, filter.f), loadTrips(viewer)]);
  const now = upcomingOf(trips).find((t) => statusOf(t, todayOf(t)) === "ongoing");
  const recent = pastOf(trips)[0];
  const nowDay = now ? daysBetween(now.start, todayOf(now)) : 0;

  return (
    <AppShell>
      <header className="px-5 pt-6">
        <h1 className="text-title-xl font-extrabold text-ink">일기</h1>
        <p className="mt-1 text-sub text-ink-sub">여행의 하루를 사진과 글로 남기고 함께 이야기해요</p>
      </header>
      {removed && <p role="status" className="mx-5 mt-3 rounded-field bg-surface px-3 py-2 text-tiny font-semibold text-ink">일기를 삭제했어요</p>}
      {viewer.kind === "user" && (
        <nav aria-label="일기 모아 보기" className="flex gap-1.5 overflow-x-auto px-5 pt-4 [scrollbar-width:none]">
          {FILTERS.map((x) => {
            const on = x.f === filter.f;
            return (
              <Link key={x.f} href={x.f === "all" ? "/diary" : `/diary?f=${x.f}`} aria-current={on ? "page" : undefined} scroll={false}
                className={`press flex h-9 flex-none items-center rounded-full px-3.5 text-sub font-bold ${on ? "bg-btn text-on-btn" : "bg-surface text-ink"}`}>{x.label}</Link>
            );
          })}
        </nav>
      )}
      <div className="flex flex-col gap-3.5 px-5 pt-4">
        {viewer.kind === "user" && filter.f === "all" && (now || recent) && (
          <Link href={now ? `/trips/${now.id}/diary?day=${nowDay + 1}` : `/trips/${recent!.id}/diary?recap=1`}
            className="press flex items-center gap-3 rounded-card bg-surface p-3 pr-4">
            <span className="flex size-11 flex-none items-center justify-center rounded-full bg-point text-on-deep"><Icon name="pencil" size={20} /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-body font-bold text-ink">{now ? "오늘 일기 쓰기" : "지난 여행 회고 쓰기"}</span>
              <span className="block truncate text-tiny text-ink-sub">{now ? `${now.title} · ${nowDay + 1}일차 ${md(addDays(now.start, nowDay))}` : recent!.title}</span>
            </span>
            <Icon name="right" size={18} className="text-ink-sub" />
          </Link>
        )}
        {feed.length ? feed.map((e) => <EntryCard key={e.id} e={e} />) : (
          <EmptyState title={filter.empty} desc={filter.f === "all" || filter.f === "mine" ? "여행 화면의 날짜마다 그날 일기를 쓸 수 있어요" : "함께하는 사람의 일기에 좋아요나 댓글을 남기면 여기에 모여요"}
            action={viewer.kind === "user" ? undefined : <GateCta href="/trips">여행 보기</GateCta>} />
        )}
      </div>
      <MainTabs active="일기" />
    </AppShell>
  );
}
