"use client";
/* 알림 > 읽은 알림 모두 삭제 (2026-11-17 마루님) : 확인 창 한 번 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertDialog } from "@/components/gate";
import { deleteReadNotices } from "@/app/actions";
import { safeCall } from "@/lib/safe-call";

export function ClearRead() {
  const [ask, setAsk] = useState(false);
  const [err, setErr] = useState("");
  const [busy, start] = useTransition();
  const router = useRouter();
  const go = () => { setAsk(false); start(async () => { const r = await safeCall(() => deleteReadNotices()); if (r?.error) setErr(r.error); else router.refresh(); }); };
  return (
    <>
      <button type="button" onClick={() => { setErr(""); setAsk(true); }} disabled={busy}
        className="press h-9 flex-none rounded-full px-3 text-tiny font-semibold text-ink-sub hover:bg-surface hover:text-ink">{busy ? "지우는 중" : "읽은 알림 삭제"}</button>
      {err && <p role="alert" className="absolute right-5 top-16 rounded-field bg-surface px-3 py-2 text-tiny font-semibold text-point-text shadow-float">{err}</p>}
      {ask && <AlertDialog title="읽은 알림을 모두 삭제할까요?" desc="읽은 알림이 목록에서 사라지고 되돌릴 수 없어요. 안 읽은 알림은 남아요" confirmLabel="삭제" confirm={go} onClose={() => setAsk(false)} />}
    </>
  );
}
