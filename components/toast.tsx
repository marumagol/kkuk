"use client";
/*
  토스트 (2026-11-17 마루님 "토스트 전체 검수") : 앱 전체에서 같은 모양 하나만 쓴다
  - 화면 아래쪽 가운데, 탭바와 + 버튼 위. 폭은 화면 폭(최대 520) 고정이라 글이 짧아도 길어도 왼쪽부터 같은 자리에서 시작
  - 글자 15px(text-sub), 두 줄까지. 되돌리기 같은 버튼은 오른쪽 끝
  - 올라오며 나타남. 화면 읽기 프로그램에는 status 로 읽힘
*/
import { useEffect, useState, type ReactNode } from "react";

export const TOAST_MS = 4000;

export function Toast({ children, action, onAction, tone = "default" }: {
  children: ReactNode; action?: string; onAction?: () => void; tone?: "default" | "error";
}) {
  return (
    <div role="status" aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(80px+env(safe-area-inset-bottom))] z-40 mx-auto flex w-full max-w-[560px] justify-center px-5">
      <div className={"toast-in pointer-events-auto flex min-h-[52px] w-full items-center gap-3 rounded-[18px] bg-deep py-2.5 pl-4 text-on-deep shadow-float " + (action ? "pr-2.5" : "pr-4")}>
        {tone === "error" && <span aria-hidden className="flex size-5 flex-none items-center justify-center rounded-full bg-point text-[13px] font-extrabold text-white">!</span>}
        <p className="line-clamp-2 min-w-0 flex-1 py-1 text-left text-sub font-semibold leading-snug">{children}</p>
        {action && onAction && (
          <button type="button" onClick={onAction} className="press h-9 flex-none rounded-full bg-deep-soft px-3.5 text-sub font-bold text-on-deep">{action}</button>
        )}
      </div>
    </div>
  );
}

/*
  페이지를 옮긴 뒤 한 번 보여 주는 알림 (예 : 저장 뒤 ?saved=1). 4초 뒤 사라지고, 주소에서 그 표시를 지워
  새로고침해도 다시 뜨지 않게 한다
*/
export function FlashToast({ message, param }: { message: string; param?: string | string[] }) {
  const [on, setOn] = useState(true);
  useEffect(() => {
    const keys = param ? (Array.isArray(param) ? param : [param]) : [];
    if (keys.length) {
      const u = new URL(location.href);
      let changed = false;
      for (const k of keys) if (u.searchParams.has(k)) { u.searchParams.delete(k); changed = true; }
      if (changed) history.replaceState(history.state, "", u.pathname + (u.search || "") + u.hash);
    }
    const t = setTimeout(() => setOn(false), TOAST_MS);
    return () => clearTimeout(t);
  }, [message]); // eslint-disable-line react-hooks/exhaustive-deps
  return on ? <Toast>{message}</Toast> : null;
}
