"use client";
/*
  통화 고르기 (2026-11-17 마루님 "달러를 고른 뒤 다시 열면 달러 쪽에 고정돼서 위에 뭐가 있는지 모르겠어")
  - 기본 select 는 열 때 고른 값 위치로 스크롤돼서, 직접 만든 목록으로 바꿨다. 열 때마다 맨 위부터 보인다
  - 위 : 여행 통화 → 원 → 달러, 아래 : 기타 (모든 통화). 고른 통화는 체크 표시
*/
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/kit";
import { curName, ALL_CURRENCIES } from "@/lib/countries";

export function CurrencySelect({ value, main, onChange, disabled, className = "" }: {
  value: string; main: string[]; onChange: (cur: string) => void; disabled?: boolean; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  useEffect(() => {
    if (!open) return;
    if (list.current) list.current.scrollTop = 0;
    const out = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", out);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", out); document.removeEventListener("keydown", esc); };
  }, [open]);
  const pick = (c: string) => { setOpen(false); if (c !== value) onChange(c); };
  const row = (c: string, label: string) => (
    <li key={c}>
      <button type="button" role="option" aria-selected={c === value} onClick={() => pick(c)}
        className={"press flex h-11 w-full items-center gap-2 px-3 text-left text-body " + (c === value ? "font-bold text-ink" : "text-ink")}>
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {c === value && <Icon name="check" size={16} />}
      </button>
    </li>
  );
  const rest = ALL_CURRENCIES.filter((c) => !main.includes(c));
  return (
    <div ref={box} className={"relative " + className}>
      <button type="button" aria-haspopup="listbox" aria-expanded={open} aria-label={`통화 : ${curName(value)}`} disabled={disabled} onClick={() => setOpen((v) => !v)}
        className="flex h-14 w-full items-center justify-between gap-1 rounded-field border border-line-strong bg-surface px-3 text-body text-ink outline-none focus:border-ink focus:ring-2 focus:ring-ink/15 disabled:opacity-60">
        <span className="truncate">{curName(value)}</span>
        <Icon name="chevron-down" size={16} className="flex-none text-ink-sub" />
      </button>
      {open && (
        <ul ref={list} role="listbox" aria-label="통화"
          className="absolute bottom-full right-0 z-30 mb-1 max-h-72 w-52 overflow-y-auto overscroll-contain rounded-card border border-line bg-surface py-1 shadow-lg">
          {main.map((c) => row(c, curName(c)))}
          <li className="px-3 pb-1 pt-2 text-tiny font-semibold text-ink-sub" role="presentation">기타</li>
          {rest.map((c) => row(c, `${curName(c)} (${c})`))}
        </ul>
      )}
    </div>
  );
}
