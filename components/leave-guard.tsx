"use client";
/*
  적던 내용을 두고 나갈 때 한 번 묻기 (2026-11-16 안정화, 마루님 "추천안으로")
  - 안쪽 입력칸에 무언가 적으면(input 이벤트) 그때부터 지킨다
  - 앱 안 링크(뒤로 버튼 등)를 누르면 "저장하지 않고 나갈까요?" 창, 새로고침/창 닫기는 브라우저 기본 확인
  - 저장 뒤 서버가 보내는 이동은 링크가 아니라서 묻지 않는다
  - 휴대폰 뒤로가기 제스처(브라우저 뒤로)는 막지 않는다 (Next 이동 기록을 건드리면 다른 화면이 깨질 수 있어서)
*/
import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AlertDialog } from "@/components/gate";

export function LeaveGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [dirty, setDirty] = useState(false);
  const [to, setTo] = useState<string | null>(null);

  useEffect(() => {
    if (!dirty) return;
    const unload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    const click = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const u = new URL(a.href, location.href);
      if (u.origin !== location.origin || (u.pathname === location.pathname && u.search === location.search)) return;
      e.preventDefault(); e.stopPropagation();
      setTo(u.pathname + u.search + u.hash);
    };
    addEventListener("beforeunload", unload);
    document.addEventListener("click", click, true);
    return () => { removeEventListener("beforeunload", unload); document.removeEventListener("click", click, true); };
  }, [dirty]);

  return (
    <div className="contents" onInputCapture={() => setDirty(true)}>
      {children}
      {to && <AlertDialog title="저장하지 않고 나갈까요?" desc="적은 내용은 저장되지 않아요" confirmLabel="나가기"
        confirm={() => { const t = to; setTo(null); setDirty(false); router.push(t); }} onClose={() => setTo(null)} />}
    </div>
  );
}
