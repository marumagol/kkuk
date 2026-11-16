"use client";
/* 여행 머리 오른쪽 ⋯ 메뉴 : 여행 정보 수정, 삭제(주인만) (2026-11-16 마루님). 공유는 다른 버튼과 겹쳐 뺐다. 모양은 준비 탭 ⋯ 메뉴와 같다 */
import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/kit";
import { AlertDialog } from "@/components/gate";
import { removeTrip } from "@/app/actions";
import { safeCall } from "@/lib/safe-call";

export function TripMenu({ tripId, book, owner }: { tripId: string; book?: boolean; owner?: boolean }) {
  const [open, setOpen] = useState(false);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState("");
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
            <Link href={`/trips/${tripId}/edit`} role="menuitem" autoFocus className={item} onClick={close}><Icon name="pencil" size={18} className="text-ink-sub" />수정</Link>
            {owner && <button type="button" role="menuitem" className={item + " text-point-text"} onClick={() => { close(); setError(""); setAsking(true); }}><Icon name="trash" size={18} />삭제</button>}
            {book && <Link href={`/trips/${tripId}/book`} role="menuitem" className={item} onClick={close}><Icon name="book" size={18} className="text-ink-sub" />여행 한 권</Link>}
          </div>
        </>
      )}
      {asking && <AlertDialog title="여행을 삭제할까요?" desc="일정과 장소가 모두 목록에서 사라지고, 함께하는 사람에게도 보이지 않아요. 30일 안에는 설정 > 최근 삭제한 여행에서 되살릴 수 있어요"
        confirmLabel="삭제" confirm={async () => { setAsking(false); const r = await safeCall(() => removeTrip(tripId)); if (r?.error) setError(r.error); }} onClose={() => setAsking(false)} />}
      {error && <p role="alert" className="absolute right-0 top-12 z-40 w-60 rounded-field bg-surface px-3 py-2 text-tiny font-semibold text-point-text shadow-float">{error}</p>}
    </div>
  );
}
