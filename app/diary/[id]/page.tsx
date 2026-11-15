/* 일기 한 편 보기 : 피드 카드 + 댓글. 내 글이면 고치기, 삭제 */
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Icon } from "@/components/kit";
import { AppShell } from "@/components/screen";
import { getViewer } from "@/lib/viewer";
import { loadEntry, loadComments, loadTrip } from "@/lib/trips";
import { EntryCard } from "@/components/entry-card";
import { EntryComments } from "@/components/entry-comments";
import { EntryRemove } from "@/components/entry-remove";

export const metadata = { title: "일기" };

export default async function EntryPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const { id } = await params;
  const { saved } = await searchParams;
  const viewer = await getViewer();
  if (viewer.kind === "guest") redirect(`/login?next=/diary/${id}`);
  const e = await loadEntry(viewer, id);
  if (!e) notFound();
  const [comments, trip] = await Promise.all([
    e.visibility === "private" ? Promise.resolve([]) : loadComments(viewer, e.id, e.tripId),
    e.kind === "day" ? loadTrip(viewer, e.tripId) : Promise.resolve(null),
  ]);
  const places = trip && "trip" in trip ? (trip.trip.days[e.dayIndex!]?.items ?? []).map((i) => i.title) : [];
  const editHref = `/trips/${e.tripId}/diary?${e.kind === "recap" ? "recap=1" : `day=${e.dayIndex! + 1}`}`;
  return (
    <AppShell bottomGap={false}>
      <div className="flex items-center justify-between px-5 pt-4">
        <Link href="/diary" aria-label="일기 목록으로" className="press flex size-11 items-center justify-center rounded-full bg-surface text-ink"><Icon name="back" size={20} /></Link>
        {e.mine && <Link href={editHref} aria-label="일기 고치기" className="press flex size-11 items-center justify-center rounded-full bg-surface text-ink"><Icon name="pencil" size={20} /></Link>}
      </div>
      {saved && <p role="status" className="mx-5 mt-3 rounded-field bg-ok-soft px-3 py-2 text-tiny font-semibold text-ok-text">일기를 저장했어요</p>}
      <div className="flex flex-col gap-6 px-5 pb-10 pt-3">
        <EntryCard e={e} detail places={places} />
        {e.mine && <EntryRemove id={e.id} />}
        {e.visibility === "private"
          ? <p className="text-sub text-ink-sub">나만 보기 일기에는 좋아요와 댓글이 없어요</p>
          : <EntryComments entryId={e.id} list={comments} entryMine={e.mine} />}
      </div>
    </AppShell>
  );
}
