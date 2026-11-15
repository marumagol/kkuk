"use client";
/* 일기 댓글과 답글 (피그마 "일기 (11.15)" 02) : 답글은 한 단계만. 입력칸은 화면 아래 고정
   지우기 : 댓글 쓴 사람과 일기 쓴 사람. 댓글을 지우면 답글도 함께 지워진다. 고치기는 없다 */
import { useEffect, useRef, useState, useTransition } from "react";
import { Icon } from "@/components/kit";
import { Avatar } from "@/components/screen";
import { AlertDialog } from "@/components/gate";
import { addComment, removeComment } from "@/app/actions";
import { safeCall } from "@/lib/safe-call";
import type { EntryComment } from "@/lib/trips";

function ago(at: string) {
  const m = Math.max(0, Math.round((Date.now() - new Date(at).getTime()) / 60e3));
  if (m < 1) return "방금";
  if (m < 60) return `${m}분 전`;
  if (m < 60 * 24) return `${Math.floor(m / 60)}시간 전`;
  return `${Math.floor(m / 1440)}일 전`;
}

export function EntryComments({ entryId, list, entryMine }: { entryId: string; list: EntryComment[]; entryMine: boolean }) {
  const [text, setText] = useState("");
  const [to, setTo] = useState<EntryComment | null>(null);
  const [ask, setAsk] = useState<EntryComment | null>(null);
  const [error, setError] = useState("");
  const [busy, start] = useTransition();
  const box = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { const b = box.current; if (b) { b.style.height = "auto"; b.style.height = `${Math.min(b.scrollHeight, 128)}px`; } }, [text]);

  const roots = list.filter((c) => !c.parentId);
  const repliesOf = (id: string) => list.filter((c) => c.parentId === id);

  const send = () => {
    const body = text.trim();
    if (!body || busy) return;
    setError("");
    start(async () => {
      const r = await safeCall(() => addComment(entryId, body, to?.id ?? null));
      if (r?.error) setError(r.error); else { setText(""); setTo(null); }
    });
  };
  const reply = (c: EntryComment) => { setTo(c); setError(""); box.current?.focus(); };
  const remove = (c: EntryComment) => { setError(""); start(async () => { const r = await safeCall(() => removeComment(c.id)); if (r?.error) setError(r.error); else if (to?.id === c.id) setTo(null); }); };
  const askRemove = (c: EntryComment) => (!c.parentId && repliesOf(c.id).length ? setAsk(c) : remove(c));

  const Row = ({ c, small }: { c: EntryComment; small?: boolean }) => (
    <div className="flex gap-2.5">
      <Avatar initial={[...c.author][0] ?? "여"} size={small ? 28 : 34} src={c.avatar} tone={c.mine ? "point" : "accent"} />
      <div className="min-w-0 flex-1">
        <p className="flex items-baseline gap-1.5"><span className="text-sub font-bold text-ink">{c.mine ? "나" : c.author}</span>
          <span className="text-tiny text-ink-sub" suppressHydrationWarning>{ago(c.at)}</span></p>
        <p className="mt-0.5 whitespace-pre-wrap break-words text-body leading-relaxed text-ink">{c.body}</p>
        <div className="-ml-2 flex">
          {!small && <button type="button" onClick={() => reply(c)} className="press flex h-9 items-center px-2 text-sub font-bold text-ink-sub">답글 달기</button>}
          {(c.mine || entryMine) && <button type="button" disabled={busy} onClick={() => askRemove(c)} className="press flex h-9 items-center px-2 text-sub font-semibold text-ink-sub">삭제</button>}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <section id="comments" className="flex scroll-mt-4 flex-col gap-4 pb-36">
        <h2 className="text-title font-bold text-ink">댓글 {list.length}</h2>
        {roots.length ? roots.map((c) => (
          <div key={c.id} className="flex flex-col gap-2">
            <Row c={c} />
            {repliesOf(c.id).length > 0 && (
              <div className="flex flex-col gap-2 pl-11">
                {repliesOf(c.id).map((r) => <Row key={r.id} c={r} small />)}
              </div>
            )}
          </div>
        )) : <p className="text-sub text-ink-sub">첫 댓글을 남겨 보세요</p>}
      </section>

      <div className="fixed inset-x-0 bottom-0 z-20 mx-auto w-full max-w-[560px] border-t border-line bg-surface px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-2.5">
        {to && (
          <div className="flex items-center gap-2 pb-1.5">
            <p className="min-w-0 flex-1 truncate text-sub font-semibold text-ink-sub">{to.mine ? "내 댓글" : `${to.author}님`}에게 답글 남기는 중</p>
            <button type="button" onClick={() => setTo(null)} aria-label="답글 그만 쓰기" className="press -mr-2 flex size-9 items-center justify-center text-ink-sub"><Icon name="x" size={16} /></button>
          </div>
        )}
        {error && <p role="alert" className="pb-1.5 text-sub font-semibold text-point-text">{error}</p>}
        <div className="flex items-end gap-2">
          <label className="sr-only" htmlFor="comment-box">{to ? "답글 쓰기" : "댓글 쓰기"}</label>
          <textarea id="comment-box" ref={box} value={text} onChange={(e) => setText(e.target.value)} maxLength={500} rows={1}
            placeholder={to ? "답글 달기" : "댓글 달기"}
            className="max-h-32 min-h-12 flex-1 resize-none overflow-y-auto rounded-[24px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden border border-line bg-bg px-4 py-3 text-body text-ink outline-none placeholder:text-ink-sub focus:border-ink" />
          <button type="button" onClick={send} disabled={busy || !text.trim()} aria-label={to ? "답글 올리기" : "댓글 올리기"}
            className="press flex size-12 flex-none items-center justify-center rounded-full bg-btn text-on-btn disabled:opacity-40"><Icon name="up" size={20} /></button>
        </div>
      </div>

      {ask && <AlertDialog title="댓글을 삭제할까요?" desc={`이 댓글에 달린 답글 ${repliesOf(ask.id).length}개도 함께 지워져요`} confirmLabel="삭제"
        onClose={() => setAsk(null)} confirm={() => remove(ask)} />}
    </>
  );
}
