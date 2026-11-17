"use client";
/* 홈 머리의 프로필 (2026-11-17 마루님 "누르면 설정, 로그아웃") : 작은 메뉴. 로그아웃은 확인 창을 한 번 거친다 */
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { Icon } from "@/components/kit";
import { AlertDialog } from "@/components/gate";
import { signOut } from "@/app/actions";

export function ProfileMenu({ children, face, name, email }: { children: React.ReactNode; face: React.ReactNode; name: string; email: string }) {
  const [open, setOpen] = useState(false);
  const [ask, setAsk] = useState(false);
  const [busy, start] = useTransition();
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    addEventListener("pointerdown", away); addEventListener("keydown", esc);
    return () => { removeEventListener("pointerdown", away); removeEventListener("keydown", esc); };
  }, [open]);
  return (
    <div ref={box} className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-label="내 메뉴" aria-haspopup="menu" aria-expanded={open}
        className="press flex size-11 items-center justify-center rounded-full">{children}</button>
      {open && (
        /* 맨 위 내 얼굴, 이름, 이메일. 선 아래 설정, 로그아웃 (2026-11-17 마루님 참고 화면) */
        <div role="menu" className="absolute right-0 top-full z-40 mt-1.5 w-60 rounded-[18px] bg-surface p-1.5 shadow-float">
          <div className="flex items-center gap-2.5 px-2.5 pb-2.5 pt-2">
            {face}
            <div className="min-w-0">
              <p className="truncate text-sub font-extrabold text-ink">{name}</p>
              {email && <p className="truncate text-tiny text-ink-sub">{email}</p>}
            </div>
          </div>
          <div className="mx-1.5 border-t border-line" />
          <div className="flex flex-col pt-1">
            <Link role="menuitem" href="/me" onClick={() => setOpen(false)} className="press flex h-10 items-center gap-2.5 rounded-field px-2.5 text-sub font-medium text-ink">
              <Icon name="gear" size={18} className="text-ink-sub" />설정
            </Link>
            <button role="menuitem" type="button" onClick={() => { setOpen(false); setAsk(true); }}
              className="press flex h-10 w-full items-center gap-2.5 rounded-field px-2.5 text-left text-sub font-medium text-ink">
              <Icon name="logout" size={18} className="text-ink-sub" />로그아웃
            </button>
          </div>
        </div>
      )}
      {ask && <AlertDialog title="로그아웃할까요?" desc="이 기기에서 로그아웃돼요. 다시 로그인하면 그대로 이어서 볼 수 있어요" confirmLabel={busy ? "로그아웃 중" : "로그아웃"}
        confirm={() => start(async () => { await signOut(); })} onClose={() => setAsk(false)} />}
    </div>
  );
}
