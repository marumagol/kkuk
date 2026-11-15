"use client";
/* 일기 피드의 버튼 줄 : 좋아요(누르면 바로 바뀜), 댓글, 공유. 나만 보기 글은 좋아요와 댓글이 없다 */
import Link from "next/link";
import { useState, useTransition } from "react";
import { Icon } from "@/components/kit";
import { AlertDialog } from "@/components/gate";
import { toggleLike, publishEntry } from "@/app/actions";
import { safeCall } from "@/lib/safe-call";
import type { Visibility } from "@/lib/trips";

async function shareUrl(path: string): Promise<"shared" | "copied" | "fail"> {
  const url = `${location.origin}${path}`;
  try {
    if (navigator.share && matchMedia("(pointer: coarse)").matches) { await navigator.share({ title: "KKuK 여행 일기", url }); return "shared"; }
    await navigator.clipboard.writeText(url); return "copied";
  } catch (e) {
    if ((e as Error)?.name === "AbortError") return "shared";
    try { await navigator.clipboard.writeText(url); return "copied"; } catch { return "fail"; }
  }
}

type Props = { id: string; mine: boolean; visibility: Visibility; token: string | null; likes: number; liked: boolean; comments: number; time: string };
export function EntryActions({ id, mine, visibility, token, likes, liked, comments, time }: Props) {
  const [like, setLike] = useState({ on: liked, n: likes });
  const [tok, setTok] = useState(token);
  const [ask, setAsk] = useState(false);
  const [note, setNote] = useState("");
  const [, start] = useTransition();
  const social = visibility !== "private";
  const canShare = !!tok || mine;

  const tapLike = () => {
    const next = { on: !like.on, n: Math.max(0, like.n + (like.on ? -1 : 1)) };
    const prev = like;
    setLike(next); setNote("");
    start(async () => { const r = await safeCall(() => toggleLike(id, next.on)); if (r?.error) { setLike(prev); setNote(r.error); } });
  };
  const say = (r: "shared" | "copied" | "fail") => setNote(r === "copied" ? "링크를 복사했어요" : r === "fail" ? "링크를 복사하지 못했어요" : "");
  const tapShare = async () => { if (tok) say(await shareUrl(`/j/${tok}`)); else setAsk(true); };
  const publish = () => start(async () => {
    const r = await safeCall(() => publishEntry(id));
    if ("error" in r && r.error) return setNote(r.error);
    if ("token" in r && r.token) { setTok(r.token); const s = await shareUrl(`/j/${r.token}`); setNote(s === "copied" ? "링크로 공개했어요. 링크를 복사했어요" : "링크로 공개했어요. 공유 버튼을 한 번 더 눌러 주세요"); }
  });

  return (
    <div className="px-0.5 pt-1">
      <div className="flex items-center">
        {social && (
          <>
            <button type="button" onClick={tapLike} aria-pressed={like.on} aria-label={like.on ? "좋아요 취소" : "좋아요"}
              className="press flex h-11 min-w-11 items-center gap-1.5 px-2 text-ink">
              <Icon name="heart" size={24} className={like.on ? "fill-[var(--point)] text-[var(--point)]" : undefined} />
              <span className="text-sub font-bold tabular-nums">{like.n}</span>
            </button>
            <Link href={`/diary/${id}#comments`} aria-label={`댓글 ${comments}개`} className="press flex h-11 min-w-11 items-center gap-1.5 px-2 text-ink">
              <Icon name="chat" size={24} /><span className="text-sub font-bold tabular-nums">{comments}</span>
            </Link>
          </>
        )}
        {canShare && (
          <button type="button" onClick={tapShare} aria-label="공유하기" className="press flex size-11 items-center justify-center text-ink"><Icon name="send" size={24} /></button>
        )}
        <span className="ml-auto pr-2 text-tiny text-ink-sub" suppressHydrationWarning>{time}</span>
      </div>
      {note && <p role="status" className="px-2 pb-1 text-tiny font-semibold text-point-text">{note}</p>}
      {ask && <AlertDialog title="링크로 공개하고 공유할까요?" desc="링크를 아는 사람은 로그인 없이 이 일기의 글, 사진, 좋아요 수를 볼 수 있어요. 댓글은 보이지 않고, 사진에 위치 정보는 들어 있지 않아요"
        confirmLabel="공개하고 공유" onClose={() => setAsk(false)} confirm={publish} />}
    </div>
  );
}

/* 글 앞 몇 줄 + 더 보기 */
const CLAMP = { 2: "line-clamp-2", 3: "line-clamp-3", 4: "line-clamp-4" } as const;
export function ClampText({ text, full = false, lines = 2 }: { text: string; full?: boolean; lines?: 2 | 3 | 4 }) {
  const [open, setOpen] = useState(full);
  const long = text.length > lines * 40 || text.split("\n").length > lines;
  return (
    <div>
      <p className={`whitespace-pre-wrap text-body leading-relaxed text-ink ${open ? "" : CLAMP[lines]}`}>{text}</p>
      {!open && long && <button type="button" onClick={() => setOpen(true)} className="press flex h-9 items-center text-sub font-semibold text-ink-sub">더 보기</button>}
    </div>
  );
}

/* 링크로 본 사람 : 좋아요 수만 보이고, 누르면 안내 */
export function PublicActions({ likes }: { likes: number }) {
  const [note, setNote] = useState(false);
  return (
    <div>
      <div className="-ml-2 flex items-center">
        <button type="button" onClick={() => setNote(true)} aria-label="좋아요" className="press flex size-11 items-center justify-center text-ink"><Icon name="heart" size={24} /></button>
        <button type="button" onClick={() => setNote(true)} aria-label="댓글" className="press flex size-11 items-center justify-center text-ink"><Icon name="chat" size={24} /></button>
      </div>
      <p className="text-sub font-bold text-ink">좋아요 {likes}개</p>
      {note && <p role="status" className="pt-1 text-tiny font-semibold text-point-text">좋아요와 댓글은 KKuK 앱에서 함께하는 사람만 할 수 있어요</p>}
    </div>
  );
}
