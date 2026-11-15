"use client";
/* 일기 댓글 : 목록, 쓰기(500자), 지우기(댓글 쓴 사람과 일기 쓴 사람). 고치기는 없다 */
import { useState, useTransition } from "react";
import { Icon } from "@/components/kit";
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
  const [error, setError] = useState("");
  const [busy, start] = useTransition();
  const send = () => {
    const body = text.trim();
    if (!body || busy) return;
    setError("");
    start(async () => { const r = await safeCall(() => addComment(entryId, body)); if (r?.error) setError(r.error); else setText(""); });
  };
  const remove = (id: string) => { setError(""); start(async () => { const r = await safeCall(() => removeComment(id)); if (r?.error) setError(r.error); }); };
  return (
    <section id="comments" className="scroll-mt-4">
      <h2 className="text-sub font-bold text-ink">댓글 {list.length}개</h2>
      {list.length ? (
        <ul className="mt-2 flex flex-col">
          {list.map((c) => (
            <li key={c.id} className="flex items-start gap-2 py-2">
              <div className="min-w-0 flex-1">
                <p className="whitespace-pre-wrap break-words text-sub text-ink"><span className="font-bold">{c.mine ? "나" : c.author}</span> {c.body}</p>
                <p className="mt-0.5 text-tiny text-ink-sub" suppressHydrationWarning>{ago(c.at)}</p>
              </div>
              {(c.mine || entryMine) && (
                <button type="button" disabled={busy} onClick={() => remove(c.id)} aria-label="댓글 삭제" className="press -mr-2 flex size-11 flex-none items-center justify-center text-ink-sub"><Icon name="x" size={16} /></button>
              )}
            </li>
          ))}
        </ul>
      ) : <p className="mt-2 text-sub text-ink-sub">첫 댓글을 남겨 보세요</p>}
      <div className="mt-3 flex items-end gap-2">
        <label className="sr-only" htmlFor="comment-box">댓글 쓰기</label>
        <textarea id="comment-box" value={text} onChange={(e) => setText(e.target.value)} maxLength={500} rows={1} placeholder="댓글 달기"
          className="max-h-32 min-h-12 flex-1 resize-none rounded-field border border-line-strong bg-surface px-3 py-3 text-body text-ink placeholder:text-ink-sub" />
        <button type="button" onClick={send} disabled={busy || !text.trim()} className="press h-12 flex-none rounded-btn bg-btn px-4 text-sub font-bold text-on-btn disabled:opacity-40">{busy ? "올리는 중" : "올리기"}</button>
      </div>
      {error && <p role="alert" className="mt-2 text-sub font-semibold text-point-text">{error}</p>}
    </section>
  );
}
