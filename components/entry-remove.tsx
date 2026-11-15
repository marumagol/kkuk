"use client";
/* 내 일기 삭제 (확인 창) */
import { useState, useTransition } from "react";
import { AlertDialog } from "@/components/gate";
import { removeEntry } from "@/app/actions";
import { safeCall } from "@/lib/safe-call";

export function EntryRemove({ id }: { id: string }) {
  const [ask, setAsk] = useState(false);
  const [error, setError] = useState("");
  const [busy, start] = useTransition();
  return (
    <>
      <button type="button" disabled={busy} onClick={() => setAsk(true)} className="press -mt-3 inline-flex h-11 items-center self-end px-2 text-sub font-semibold text-ink-sub underline underline-offset-4">일기 삭제</button>
      {error && <p role="alert" className="text-center text-sub font-semibold text-point-text">{error}</p>}
      {ask && <AlertDialog title="일기를 삭제할까요?" desc="함께하는 사람에게도 더 이상 보이지 않아요" confirmLabel="삭제" onClose={() => setAsk(false)}
        confirm={() => { setAsk(false); start(async () => { const r = await safeCall(() => removeEntry(id)); if (r?.error) setError(r.error); }); }} />}
    </>
  );
}
