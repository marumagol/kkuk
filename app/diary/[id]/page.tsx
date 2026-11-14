/* 일기 한 편 보기. 내 글이면 고치기, 삭제 */
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Icon } from "@/components/kit";
import { AppShell } from "@/components/screen";
import { getViewer } from "@/lib/viewer";
import { loadEntry } from "@/lib/trips";
import { VIS_NAME, slotOf } from "@/components/entry-card";
import { EntryRemove } from "@/components/entry-remove";

export const metadata = { title: "일기" };

export default async function EntryPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const { id } = await params;
  const { saved } = await searchParams;
  const viewer = await getViewer();
  if (viewer.kind === "guest") redirect(`/login?next=/diary/${id}`);
  const e = await loadEntry(viewer, id);
  if (!e) notFound();
  const editHref = `/trips/${e.tripId}/diary?${e.kind === "recap" ? "recap=1" : `day=${e.dayIndex! + 1}`}`;
  return (
    <AppShell bottomGap={false}>
      <div className="flex items-center justify-between px-5 pt-4">
        <Link href="/diary" aria-label="일기 목록으로" className="press flex size-11 items-center justify-center rounded-full bg-surface text-ink"><Icon name="back" size={20} /></Link>
        {e.mine && <Link href={editHref} aria-label="일기 고치기" className="press flex size-11 items-center justify-center rounded-full bg-surface text-ink"><Icon name="pencil" size={20} /></Link>}
      </div>
      {saved && <p role="status" className="mx-5 mt-3 rounded-field bg-ok-soft px-3 py-2 text-tiny font-semibold text-ok-text">일기를 저장했어요</p>}
      <article className="flex flex-col gap-4 px-5 pb-10 pt-4">
        <div>
          <Link href={`/trips/${e.tripId}`} className="text-sub font-semibold text-point-text">{e.tripTitle} · {slotOf(e)}</Link>
          {e.title && <h1 className="mt-1 text-title-xl font-extrabold text-ink">{e.title}</h1>}
          <p className="mt-1 text-tiny text-ink-sub">{e.mine ? "내 일기" : `${e.author}님의 일기`} · {VIS_NAME[e.visibility]}</p>
        </div>
        {e.photos.length > 0 && (
          <div className="-mx-5 flex snap-x gap-2 overflow-x-auto px-5">
            {e.photos.map((p, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={p.path} src={p.url} alt={`사진 ${i + 1}`} className="h-64 w-auto max-w-[85%] flex-none snap-center rounded-card object-cover" />
            ))}
          </div>
        )}
        {e.body && <p className="whitespace-pre-wrap text-body leading-relaxed text-ink">{e.body}</p>}
        {e.mine && <EntryRemove id={e.id} />}
      </article>
    </AppShell>
  );
}
