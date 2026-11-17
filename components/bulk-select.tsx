"use client";
/* 여러 개 골라 한꺼번에 삭제 (2026-11-17 마루님 "예약, 체크리스트, 경비 일괄 선택 삭제") : 머리의 [선택] 버튼, 줄 앞 동그라미, 아래 바 */
import { Icon } from "@/components/kit";

export function SelectToggle({ on, onClick, label = "선택" }: { on: boolean; onClick: () => void; label?: string }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on}
      className="press inline-flex h-8 flex-none items-center rounded-full bg-surface-soft px-3 text-tiny font-semibold text-ink">{on ? "완료" : label}</button>
  );
}

export function PickBox({ checked }: { checked: boolean }) {
  return (
    <span aria-hidden className={"flex size-6 flex-none items-center justify-center rounded-full border-2 transition-colors " + (checked ? "border-point bg-point text-white" : "border-line-strong bg-surface")}>
      {checked && <Icon name="check" size={14} strokeWidth={3} />}
    </span>
  );
}

export function BulkBar({ count, total, busy, onAll, onDelete }: { count: number; total: number; busy?: boolean; onAll: () => void; onDelete: () => void }) {
  const all = count === total && total > 0;
  return (
    <div className="flex items-center gap-2 border-t border-line px-4 py-2.5">
      <button type="button" onClick={onAll} className="press inline-flex h-9 items-center gap-2 text-sub font-semibold text-ink">
        <PickBox checked={all} />{all ? "전체 해제" : "전체 선택"}
      </button>
      <span className="flex-1" />
      <button type="button" disabled={!count || busy} onClick={onDelete}
        className="press h-9 rounded-full bg-point px-4 text-sub font-bold text-white disabled:bg-surface-soft disabled:text-ink-sub">{count ? `${count}개 삭제` : "삭제"}</button>
    </div>
  );
}
