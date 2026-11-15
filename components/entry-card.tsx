/* 일기 피드 카드 (피그마 "일기 (11.15)" 01, 02) : 쓴 사람, 사진(칸 안 둥글게, 일차 표, 장수), 버튼 줄, 글, 최근 댓글 */
import Link from "next/link";
import { Icon } from "@/components/kit";
import { Avatar } from "@/components/screen";
import { EntryActions, ClampText } from "@/components/entry-actions";
import { EntryPhotos } from "@/components/entry-photos";
import { addDays, md } from "@/lib/mock";
import type { Entry } from "@/lib/trips";

export const VIS_NAME = { private: "나만 보기", members: "함께하는 사람", public: "링크 공개" } as const;
export const slotOf = (e: Pick<Entry, "kind" | "dayIndex" | "tripStart">) =>
  e.kind === "recap" ? "여행 회고" : `${e.dayIndex! + 1}일차 · ${md(addDays(e.tripStart, e.dayIndex!))}`;

function ago(at: string) {
  const m = Math.max(0, Math.round((Date.now() - new Date(at).getTime()) / 60e3));
  if (m < 1) return "방금";
  if (m < 60) return `${m}분 전`;
  if (m < 60 * 24) return `${Math.floor(m / 60)}시간 전`;
  if (m < 60 * 48) return "어제";
  return `${Math.floor(m / 1440)}일 전`;
}

export function SlotTag({ text, className = "" }: { text: string; className?: string }) {
  return <span className={`inline-flex h-7 items-center rounded-full bg-surface px-2.5 text-tiny font-bold text-ink ${className}`}>{text}</span>;
}

/* detail : 일기 한 편 화면 (글 전체, 이날 간 곳, 카드 링크 없음) */
export function EntryCard({ e, detail = false, places = [] }: { e: Entry; detail?: boolean; places?: string[] }) {
  const href = `/diary/${e.id}`;
  const slot = slotOf(e);
  return (
    <article className="rounded-card bg-surface p-2">
      <header className="flex items-center gap-2.5 px-2 py-2">
        <Avatar initial={[...e.author][0] ?? "여"} size={36} src={e.avatar} tone={e.mine ? "point" : "accent"} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-body font-bold text-ink">{e.mine ? "나" : e.author}</p>
          <Link href={`/trips/${e.tripId}`} className="block truncate text-tiny text-ink-sub">{e.tripTitle}</Link>
        </div>
        {e.visibility === "private" && <span className="flex h-7 flex-none items-center gap-1 rounded-full bg-surface-soft px-2.5 text-tiny font-semibold text-ink"><Icon name="lock" size={14} />나만 보기</span>}
        {e.visibility === "public" && <span className="flex h-7 flex-none items-center gap-1 rounded-full bg-point-soft px-2.5 text-tiny font-semibold text-point-text"><Icon name="link" size={14} />링크 공개</span>}
      </header>

      {e.photos.length > 0 ? (
        detail ? <EntryPhotos urls={e.photos.map((p) => p.url)} slot={slot} />
          : <Link href={href} aria-label={`${slot} 일기 보기`} className="block"><EntryPhotos urls={e.photos.map((p) => p.url)} slot={slot} /></Link>
      ) : (
        <div className="flex flex-col gap-2.5 rounded-[18px] bg-point-soft p-5">
          <SlotTag text={slot} className="self-start" />
          {e.title && (detail ? <h1 className="text-title-lg font-extrabold text-ink">{e.title}</h1>
            : <Link href={href} className="text-title-lg font-extrabold text-ink">{e.title}</Link>)}
          {e.body && <ClampText text={e.body} full={detail} lines={4} />}
        </div>
      )}

      <EntryActions id={e.id} mine={e.mine} visibility={e.visibility} token={e.shareToken} likes={e.likes} liked={e.liked} comments={e.comments}
        time={ago(e.updatedAt)} />

      {(e.photos.length > 0 || (!detail && e.latest) || (detail && places.length > 0)) && (
        <div className="flex flex-col gap-1 px-2 pb-2.5">
          {e.photos.length > 0 && e.title && (detail ? <h1 className="text-title font-bold text-ink">{e.title}</h1>
            : <Link href={href} className="text-title font-bold text-ink">{e.title}</Link>)}
          {e.photos.length > 0 && e.body && <ClampText text={e.body} full={detail} lines={2} />}
          {!detail && e.latest && (
            <Link href={`${href}#comments`} className="flex flex-col gap-0.5 pt-1">
              <span className="line-clamp-1 text-sub text-ink"><b className="font-bold">{e.latest.author}</b>&nbsp; {e.latest.body}</span>
              <span className="text-sub text-ink-sub">댓글 {e.comments}개 모두 보기</span>
            </Link>
          )}
          {detail && places.length > 0 && (
            <div className="flex flex-col gap-2 pt-3">
              <p className="text-sub font-bold text-ink-sub">이날 간 곳</p>
              <ul className="flex flex-wrap gap-1.5">
                {places.map((p, i) => <li key={i} className="flex h-8 items-center gap-1 rounded-full bg-surface-soft px-2.5 text-sub font-semibold text-ink"><Icon name="pin" size={14} className="text-point" />{p}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
