"use client";
/* 설정 > 테스터 전용 > 도장 테스트 (0.106.2 마루님 "내가 켜고 끌 수 있게").
   private.stamp_testers 계정에게만 보인다. 켜면 이 기기 쿠키 stamp-tester=1 이 남고, 카드 탭에 도장 테스트 카드가 보인다 */
import { useState } from "react";

export function TesterToggle({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial);
  const flip = () => {
    const next = !on;
    document.cookie = next ? "stamp-tester=1; path=/; max-age=31536000; samesite=lax" : "stamp-tester=; path=/; max-age=0";
    setOn(next);
  };
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-body font-bold text-ink">도장 테스트</p>
        <p className="text-tiny text-ink-sub">켜면 카드 탭에 테스트 카드가 보여요. 이 기기에만 적용돼요</p>
      </div>
      <button type="button" role="switch" aria-checked={on} aria-label="도장 테스트" onClick={flip} className="press flex h-11 w-16 flex-none items-center justify-center">
        <span className={`relative h-8 w-14 rounded-full transition-colors ${on ? "bg-point" : "bg-line-strong"}`}>
          <span className={`absolute top-1 size-6 rounded-full bg-white transition-all ${on ? "left-7" : "left-1"}`} />
        </span>
      </button>
    </div>
  );
}
