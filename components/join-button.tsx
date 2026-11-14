"use client";
/* 초대 링크 [참여하기]. 성공하면 서버가 그 여행으로 보낸다 */
import { useState, useTransition } from "react";
import { Button } from "@/components/kit";
import { joinInvite } from "@/app/actions";
import { safeCall } from "@/lib/safe-call";

export function JoinButton({ token }: { token: string }) {
  const [error, setError] = useState("");
  const [busy, start] = useTransition();
  return (
    <>
      <Button full disabled={busy} onClick={() => start(async () => { setError(""); const r = await safeCall(() => joinInvite(token)); if (r?.error) setError(r.error); })}>
        {busy ? "참여하는 중" : "참여하기"}
      </Button>
      {error && <p role="alert" className="text-sub font-semibold text-point-text">{error}</p>}
    </>
  );
}
