"use client";
/* 탈퇴 확인 : 안내 확인 체크 → 확인 창 → 탈퇴 */
import { useState, useTransition } from "react";
import { Button } from "@/components/kit";
import { AlertDialog } from "@/components/gate";
import { withdraw } from "@/app/actions";
import { safeCall } from "@/lib/safe-call";

export function WithdrawForm({ email }: { email: string }) {
  const [agree, setAgree] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState("");
  const [busy, start] = useTransition();
  const run = () => start(async () => {
    const r = await safeCall(() => withdraw());
    if (r?.error) setError(r.error);
  });
  return (
    <div className="flex flex-col gap-4">
      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sub text-ink">
        <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="size-5 accent-[var(--btn)]" disabled={busy} />
        위 내용을 확인했어요
      </label>
      {error && <p role="alert" className="text-sub font-semibold text-point-text">{error}</p>}
      <Button variant="secondary" full disabled={!agree || busy} onClick={() => setConfirm(true)}>{busy ? "탈퇴하는 중" : "탈퇴하기"}</Button>
      <p className="text-center text-tiny text-ink-sub">{email}</p>
      {confirm && <AlertDialog title="정말 탈퇴할까요?" desc="내 여행과 계정이 바로 지워지고 되살릴 수 없어요" confirmLabel="탈퇴"
        confirm={run} onClose={() => setConfirm(false)} />}
    </div>
  );
}
