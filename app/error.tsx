"use client";
/* S14 오류 : 화면을 그리다 실패했을 때 (DB 연결 실패 등) */
import Link from "next/link";
import { AppShell } from "@/components/screen";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <AppShell bottomGap={false}>
      <div className="px-5 pt-16">
        <div role="alert" className="flex flex-col items-center gap-3 rounded-card bg-surface px-6 py-8 text-center">
          <h1 className="text-title font-bold text-ink">문제가 생겼어요</h1>
          <p className="text-sub text-ink-sub">잠시 뒤 다시 시도해 주세요. 인터넷 연결도 확인해 주세요</p>
          <div className="mt-2 flex gap-2">
            <button onClick={reset} className="press inline-flex h-11 items-center rounded-btn bg-btn px-5 text-sub font-bold text-on-btn">다시 시도</button>
            <Link href="/" className="press inline-flex h-11 items-center rounded-btn border border-line-strong bg-surface px-5 text-sub font-bold text-ink">홈으로</Link>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
