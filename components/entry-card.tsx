/* 일기 카드 (일기 탭 목록) */
import Link from "next/link";
import { addDays, md } from "@/lib/mock";
import type { Entry } from "@/lib/trips";

export const VIS_NAME = { private: "나만 보기", members: "함께하는 사람", public: "링크 공개" } as const;
export const slotOf = (e: Pick<Entry, "kind" | "dayIndex" | "tripStart">) =>
  e.kind === "recap" ? "여행 회고" : `${e.dayIndex! + 1}일차 · ${md(addDays(e.tripStart, e.dayIndex!))}`;

export function EntryCard({ e }: { e: Entry }) {
  return (
    <Link href={`/diary/${e.id}`} className="press flex gap-3 rounded-card bg-surface p-4">
      <div className="min-w-0 flex-1">
        <p className="truncate text-tiny font-semibold text-ink-sub">{e.tripTitle} · {slotOf(e)}</p>
        <h2 className="mt-1 line-clamp-1 text-body font-bold text-ink">{e.title ?? (e.body.split("\n")[0] || "사진 일기")}</h2>
        {e.title && e.body && <p className="mt-0.5 line-clamp-2 text-sub text-ink-sub">{e.body}</p>}
        <p className="mt-2 text-tiny text-ink-sub">{e.mine ? "나" : e.author} · {VIS_NAME[e.visibility]}</p>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {e.photos[0] && <img src={e.photos[0].url} alt="" width={72} height={72} loading="lazy" className="size-18 flex-none rounded-field object-cover" />}
    </Link>
  );
}
