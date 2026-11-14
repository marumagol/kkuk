"use client";
/* 링크로 공개 중인 일기 : 공개 중 표시 + 링크 복사 (3단계 7) */
import { useState } from "react";
import { Icon } from "@/components/kit";

export function ShareLink({ path }: { path: string }) {
  const [done, setDone] = useState<"" | "ok" | "fail">("");
  const copy = async () => {
    const url = `${location.origin}${path}`;
    try {
      if (navigator.share && matchMedia("(pointer: coarse)").matches) await navigator.share({ url });
      else await navigator.clipboard.writeText(url);
      setDone("ok");
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") setDone("fail");
    }
  };
  return (
    <div className="flex items-center gap-3 rounded-card bg-point-soft px-4 py-3">
      <Icon name="link" size={20} className="flex-none text-point-text" />
      <p className="min-w-0 flex-1 text-sub font-semibold text-point-text">
        링크로 공개 중이에요{done === "ok" ? ". 링크를 복사했어요" : done === "fail" ? ". 복사하지 못했어요" : ""}
      </p>
      <button type="button" onClick={copy} className="press h-11 flex-none rounded-full bg-surface px-4 text-sub font-bold text-ink">링크 복사</button>
    </div>
  );
}
