/* S19 일기 탭 (2단계) : 내가 볼 수 있는 여행일기 최신순 + 지금 여행의 일기 쓰기 바로 가기 */
import Link from "next/link";
import { EmptyState, Icon } from "@/components/kit";
import { AppShell, MainTabs } from "@/components/screen";
import { GateCta } from "@/components/gate";
import { getViewer } from "@/lib/viewer";
import { loadDiaryFeed, loadTrips } from "@/lib/trips";
import { upcomingOf, pastOf, statusOf, todayOf, daysBetween, addDays, md } from "@/lib/mock";
import { EntryCard } from "@/components/entry-card";

export const metadata = { title: "일기" };

export default async function Diary({ searchParams }: { searchParams: Promise<{ removed?: string }> }) {
  const { removed } = await searchParams;
  const viewer = await getViewer();
  const [feed, trips] = await Promise.all([loadDiaryFeed(viewer), loadTrips(viewer)]);
  const now = upcomingOf(trips).find((t) => statusOf(t, todayOf(t)) === "ongoing");
  const recent = pastOf(trips)[0];
  const nowDay = now ? daysBetween(now.start, todayOf(now)) : 0;

  return (
    <AppShell>
      <header className="px-5 pt-6">
        <h1 className="text-title-xl font-extrabold text-ink">일기</h1>
        <p className="mt-1 text-sub text-ink-sub">여행의 하루를 글과 사진으로 남겨요</p>
      </header>
      {removed && <p role="status" className="mx-5 mt-3 rounded-field bg-surface px-3 py-2 text-tiny font-semibold text-ink">일기를 삭제했어요</p>}
      <div className="flex flex-col gap-4 px-5 pt-5">
        {viewer.kind === "user" && (now || recent) && (
          <Link href={now ? `/trips/${now.id}/diary?day=${nowDay + 1}` : `/trips/${recent!.id}/diary?recap=1`}
            className="press flex items-center gap-3 rounded-card bg-btn px-5 py-4 text-on-btn">
            <Icon name="pencil" size={20} />
            <span className="min-w-0 flex-1">
              <span className="block text-body font-bold">{now ? `오늘 일기 쓰기 · ${nowDay + 1}일차` : "지난 여행 회고 쓰기"}</span>
              <span className="block truncate text-tiny opacity-80">{now ? `${now.title} · ${md(addDays(now.start, nowDay))}` : recent!.title}</span>
            </span>
            <Icon name="right" size={18} />
          </Link>
        )}
        {feed.length ? feed.map((e) => <EntryCard key={e.id} e={e} />) : (
          <EmptyState title="아직 일기가 없어요" desc="여행 화면의 날짜마다 그날 일기를 쓸 수 있어요"
            action={viewer.kind === "user" ? undefined : <GateCta href="/trips">여행 보기</GateCta>} />
        )}
      </div>
      <MainTabs active="일기" />
    </AppShell>
  );
}
