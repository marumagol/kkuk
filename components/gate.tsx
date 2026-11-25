"use client";
/*
  쓰기 버튼 문지기 (0단계 결정 : 둘러보기 허용)
  - 로그인 전 : "로그인이 필요해요" 얼럿 → [확인] 누르면 /login?next=지금 화면
  - 로그인 후 : href 가 있으면 그리로 가고, 없으면 "곧 열려요" 안내 (해당 기능이 아직 없는 단계)
*/
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Icon } from "@/components/kit";

type Dialog = { title: string; desc: string; confirm?: () => void; confirmLabel?: string } | null;
const Ctx = createContext<{ loggedIn: boolean; open: (d: Dialog) => void }>({ loggedIn: false, open: () => {} });

export function GateProvider({ loggedIn, children }: { loggedIn: boolean; children: ReactNode }) {
  const [dialog, setDialog] = useState<Dialog>(null);
  return (
    <Ctx.Provider value={{ loggedIn, open: setDialog }}>
      {children}
      {dialog && <AlertDialog {...dialog} onClose={() => setDialog(null)} />}
    </Ctx.Provider>
  );
}

/* 확인 창 (얼럿). 다른 화면에서도 쓴다 : 날짜 줄이기, 여행 삭제 */
export function AlertDialog({ title, desc, confirm, confirmLabel = "확인", onClose }: NonNullable<Dialog> & { onClose: () => void }) {
  const okRef = useRef<HTMLButtonElement>(null);
  const back = useRef<Element | null>(null);
  useEffect(() => {
    back.current = document.activeElement;
    okRef.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => { window.removeEventListener("keydown", esc); (back.current as HTMLElement | null)?.focus?.(); };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-scrim px-8" onClick={onClose}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="gate-title" aria-describedby="gate-desc"
        className="w-full max-w-[320px] rounded-card bg-surface p-6 text-center shadow-float" onClick={(e) => e.stopPropagation()}>
        <h2 id="gate-title" className="text-title font-bold text-ink">{title}</h2>
        <p id="gate-desc" className="mt-2 text-sub text-ink-sub">{desc}</p>
        <div className="mt-5 flex gap-2">
          {confirm && (
            <button onClick={onClose} className="press h-12 flex-1 rounded-btn border border-line-strong bg-surface text-body font-bold text-ink">취소</button>
          )}
          <button ref={okRef} onClick={() => { onClose(); confirm?.(); }}
            className="press h-12 flex-1 rounded-btn bg-btn text-body font-bold text-on-btn">{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

/* 문지기를 거치는 버튼. 모양은 className 으로 */
export function GateButton({ href, soon = "이 기능은 다음 단계에서 열려요", className, children, label }: {
  href?: string; soon?: string; className?: string; children: ReactNode; label?: string;
}) {
  const { loggedIn, open } = useContext(Ctx);
  const router = useRouter();
  const path = usePathname();
  const qs = useSearchParams().toString();
  const onClick = () => {
    if (!loggedIn) {
      const next = encodeURIComponent(path + (qs ? `?${qs}` : ""));
      return open({ title: "로그인이 필요해요", desc: "여행을 만들고 저장하려면 로그인해 주세요", confirm: () => router.push(`/login?next=${next}`) });
    }
    if (href) return router.push(href);
    open({ title: "곧 열려요", desc: soon });
  };
  return <button type="button" aria-label={label} onClick={onClick} className={className}>{children}</button>;
}

/* 큰 버튼 모양 */
export function GateCta({ children, icon = "arrow", href }: { children: ReactNode; icon?: "arrow" | "plus"; href?: string }) {
  return (
    <GateButton href={href} className="press inline-flex h-14 w-full items-center justify-center gap-2 rounded-btn bg-btn px-5 text-[16px] font-bold text-on-btn">
      {children}<Icon name={icon} size={20} />
    </GateButton>
  );
}
