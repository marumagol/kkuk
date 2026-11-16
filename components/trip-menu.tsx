"use client";
/* 여행 머리 오른쪽 ⋯ 메뉴 : 공유, 여행 정보 수정 (2026-11-16 마루님 "쓰리닷 눌러서 공유, 수정"). 모양은 준비 탭 ⋯ 메뉴와 같다 */
import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/kit";

export function TripMenu({ tripId, book }: { tripId: string; book?: boolean }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const item = "press flex min-h-11 w-full items-center gap-2.5 px-4 text-left text-body text-ink";
  return (
    <div className="relative flex-none">
      <button type="button" aria-label="여행 메뉴" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}
        className="press flex size-11 items-center justify-center rounded-full bg-surface text-ink"><Icon name="more" size={20} /></button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={close} aria-hidden />
          <div role="menu" onKeyDown={(e) => e.key === "Escape" && close()}
            className="absolute right-0 top-12 z-40 min-w-[168px] overflow-hidden rounded-field bg-surface py-1 shadow-float ring-1 ring-line">
            <Link href={`/trips/${tripId}/share`} role="menuitem" autoFocus className={item} onClick={close}><Icon name="share" size={18} className="text-ink-sub" />공유</Link>
            <Link href={`/trips/${tripId}/edit`} role="menuitem" className={item} onClick={close}><Icon name="pencil" size={18} className="text-ink-sub" />수정</Link>
            {book && <Link href={`/trips/${tripId}/book`} role="menuitem" className={item} onClick={close}><Icon name="book" size={18} className="text-ink-sub" />여행 한 권</Link>}
          </div>
        </>
      )}
    </div>
  );
}
