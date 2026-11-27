"use client";
/*
  쓰기 버튼 문지기 (0단계 결정 : 둘러보기 허용)
  - 로그인 전 : "로그인 없이 써 볼까요?" 얼럿 (0.107.0) → [바로 시작] 손님 계정을 만들고 원래 가려던 곳으로, [로그인] /login?next=지금 화면
  - 손님 계정 : 초대, 공유를 누르면 "로그인하면 쓸 수 있어요" 얼럿 (useGate().needLogin)
  - 로그인 후 : href 가 있으면 그리로 가고, 없으면 "곧 열려요" 안내 (해당 기능이 아직 없는 단계)
*/
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Icon } from "@/components/kit";
import { createClient } from "@/lib/supabase/client";
import { setupGuest } from "@/app/actions";
import { GUEST_NOTE } from "@/lib/guest";

type Dialog = { title: string; desc: string; confirm?: () => void; confirmLabel?: string; alt?: { label: string; run: () => void } } | null;
const Ctx = createContext<{ loggedIn: boolean; anon: boolean; open: (d: Dialog) => void }>({ loggedIn: false, anon: false, open: () => {} });

export function GateProvider({ loggedIn, anon = false, children }: { loggedIn: boolean; anon?: boolean; children: ReactNode }) {
  const [dialog, setDialog] = useState<Dialog>(null);
  return (
    <Ctx.Provider value={{ loggedIn, anon, open: setDialog }}>
      {children}
      {dialog && <AlertDialog {...dialog} onClose={() => setDialog(null)} />}
    </Ctx.Provider>
  );
}


/* 손님 계정 만들기 (Supabase 익명 로그인) → 이름 채우기 → 가려던 곳으로 새로 연다. 실패하면 로그인 화면 */
export async function startGuest(target: string) {
  const sb = createClient();
  const login = () => { location.href = `/login?next=${encodeURIComponent(target)}&error=guest`; };
  if (!sb) return login();
  const { error } = await sb.auth.signInAnonymously().catch(() => ({ error: true }));
  if (error) return login();
  await setupGuest().catch(() => {});
  location.href = target;
}

/* 지금 화면 주소 (로그인 뒤 돌아올 곳) */
function useHere() {
  const path = usePathname();
  const qs = useSearchParams().toString();
  return path + (qs ? `?${qs}` : "");
}

/* 다른 조각에서 쓰는 문지기 : needLogin() 이 true 면 막고 얼럿을 띄운 것 */
export function useGate() {
  const { loggedIn, anon, open } = useContext(Ctx);
  const router = useRouter();
  const here = useHere();
  const toLogin = () => router.push(`/login?next=${encodeURIComponent(here)}`);
  return {
    loggedIn, anon,
    needLogin: (what = "초대, 공유") => {
      if (loggedIn && !anon) return false;
      open({ title: `${what}는 로그인하면 쓸 수 있어요`, desc: "로그인해도 지금까지 만든 여행과 카드는 그대로 남아요", confirm: toLogin, confirmLabel: "로그인" });
      return true;
    },
  };
}

/* 확인 창 (얼럿). 다른 화면에서도 쓴다 : 날짜 줄이기, 여행 삭제 */
export function AlertDialog({ title, desc, confirm, confirmLabel = "확인", alt, onClose }: NonNullable<Dialog> & { onClose: () => void }) {
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
          {alt ? (
            <button onClick={() => { onClose(); alt.run(); }} className="press h-12 flex-1 rounded-btn border border-line-strong bg-surface text-body font-bold text-ink">{alt.label}</button>
          ) : confirm && (
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
  const here = useHere();
  const onClick = () => {
    if (!loggedIn) {
      return open({
        title: "로그인 없이 써 볼까요?", desc: `지금 바로 여행을 만들 수 있어요. ${GUEST_NOTE}`,
        confirm: () => void startGuest(href ?? here), confirmLabel: "바로 시작",
        alt: { label: "로그인", run: () => router.push(`/login?next=${encodeURIComponent(href ?? here)}`) },
      });
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
