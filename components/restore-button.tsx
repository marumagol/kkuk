"use client";
/* 최근 삭제한 여행 > [되살리기] (5단계 3번) */
import { useState, useTransition } from "react";
import { restoreTrip } from "@/app/actions";
import { safeCall } from "@/lib/safe-call";

export function RestoreButton({ id }: { id: string }) {
  const [error, setError] = useState("");
  const [busy, start] = useTransition();
  return (
    <div className="flex flex-col items-end gap-1">
      <button type="button" disabled={busy} onClick={() => start(async () => { const r = await safeCall(() => restoreTrip(id)); if (r?.error) setError(r.error); })}
        className="press h-11 flex-none rounded-btn border border-line-strong bg-surface px-4 text-sub font-bold text-ink disabled:opacity-50">
        {busy ? "되살리는 중" : "되살리기"}
      </button>
      {error && <p role="alert" className="text-tiny font-semibold text-point-text">{error}</p>}
    </div>
  );
}
