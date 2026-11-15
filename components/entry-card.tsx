/* 일기 피드 카드 (일기 탭, 일기 한 편 화면) : 쓴 사람, 사진(옆으로 넘기기), 좋아요/댓글/공유, 글 */
import Link from "next/link";
import { Icon } from "@/components/kit";
import { Avatar } from "@/components/screen";
import { EntryActions, ClampText } from "@/components/entry-actions";
import { addDays, md } from "@/lib/mock";
import type { Entry } from "@/lib/trips";

export const VIS_NAME = { private: "나만 보기", members: "함께하는 사람", public: "링크 공개" } as const;
export const slotOf = (e: Pick<Entry, "kind" | "dayIndex" | "tripStart">) =>
  e.kind === "recap" ? "여행 회고" : `${e.dayIndex! + 1}일차 · ${md(addDays(e.tripStart, e.dayIndex!))}`;

export function Photos({ urls }: { urls: string[] }) {
  if (!urls.length) return null;
  return (
    <div className="relative">
      <div className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none]">
        {urls.map((u, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={i} src={u} alt={`사진 ${i + 1}`} loading={i ? "lazy" : undefined} className="aspect-[4/5] w-full flex-none snap-center object-cover" />
        ))}
      </div>
      {urls.length > 1 && (
        <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-scrim px-2.5 py-1 text-tiny font-semibold text-on-deep">사진 {urls.length}장 · 옆으로 넘겨요</span>
      )}
    </div>
  );
}

/* detail : 일기 한 편 화면 (글을 다 보여 주고, 카드 전체 링크를 뺀다) */
export function EntryCard({ e, detail = false }: { e: Entry; detail?: boolean }) {
  const href = `/diary/${e.id}`;
  const name = e.mine ? "나" : e.author;
  return (
    <article className="overflow-hidden rounded-card bg-surface">
      <header className="flex items-center gap-3 px-4 py-3">
        <Avatar initial={[...e.author][0] ?? "여"} size={36} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sub font-bold text-ink">{name}</p>
          <Link href={`/trips/${e.tripId}`} className="block truncate text-tiny text-ink-sub">{e.tripTitle} · {slotOf(e)}</Link>
        </div>
        <span className="flex flex-none items-center gap-1 text-tiny text-ink-sub">
          {e.visibility === "private" && <Icon name="lock" size={14} />}{VIS_NAME[e.visibility]}
        </span>
      </header>
      <Photos urls={e.photos.map((p) => p.url)} />
      <EntryActions id={e.id} mine={e.mine} visibility={e.visibility} token={e.shareToken} likes={e.likes} liked={e.liked} comments={e.comments} detail={detail} />
      <div className="px-4 pb-4">
        {e.title && (detail
          ? <h1 className="text-body font-bold text-ink">{e.title}</h1>
          : <Link href={href} className="block text-body font-bold text-ink">{e.title}</Link>)}
        {e.body && <ClampText text={e.body} full={detail} />}
        {!detail && e.visibility !== "private" && e.comments > 0 && (
          <Link href={`${href}#comments`} className="mt-2 flex h-9 items-center text-sub text-ink-sub">댓글 {e.comments}개 모두 보기</Link>
        )}
      </div>
    </article>
  );
}
