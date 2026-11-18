"use client";
/*
  목표 배지 (0.94.0, 2026-11-18 마루님 "업적 달성하듯 소유하고 싶은 배지")
  - 꾹 도장과 같은 물결 모양 + 금속 테두리(동, 은, 금, 전설은 홀로그램) + 크림 종이. 홀로그램 도장 카드와 같은 재료
  - 아직 못 받은 배지 : 열리지 않은 도장처럼 점선, 진행한 만큼 둘레가 주황으로 찬다
  - 누르면 큰 배지 창. 받은 배지는 쾅 내려앉고 불꽃, 못 받은 배지는 남은 수와 진행 막대
  - 모양은 app/globals.css 의 gb-*
*/
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BLOB_IN, BLOB_OUT, Icon } from "@/components/kit";
import { GOALS, TIER_NAME, type Goal } from "@/lib/stamp-goals";

function Badge({ g, value, big }: { g: Goal; value: number; big?: boolean }) {
  const done = value >= g.need;
  const icon = <Icon name={g.of === "stamp" ? "stamp" : "globe"} size={20} />;
  if (!done) {
    const p = Math.min(value, g.need) / g.need;
    return (
      <div className="gb">
        <svg aria-hidden viewBox="0 0 86 86" className="absolute inset-0 size-full" fill="none" strokeLinecap="round">
          <path d={BLOB_OUT} stroke="var(--color-line-strong)" strokeWidth={2} strokeDasharray="2 2.4" />
          {p > 0 && <path d={BLOB_OUT} stroke="var(--color-point)" strokeWidth={2.2} pathLength={100} strokeDasharray={`${p * 100} 100`} />}
        </svg>
        <div className="gb-q">{icon}<b>{g.need}</b></div>
      </div>
    );
  }
  return (
    <div className={`gb gb-${g.tier}`}>
      <div className="gb-rim" style={{ clipPath: `path("${BLOB_OUT}")` }} />
      {g.tier === "legend" && <div className="gb-foil" style={{ clipPath: `path("${BLOB_OUT}")` }} />}
      <div className="gb-core" style={{ clipPath: `path("${BLOB_IN}")` }}>{icon}<b>{g.need}</b></div>
      <div className="gb-shine" style={{ clipPath: `path("${BLOB_OUT}")` }} />
      {!big && <span className="gb-rib">달성</span>}
    </div>
  );
}

export function GoalBadges({ stamps, countries }: { stamps: number; countries: number }) {
  const [open, setOpen] = useState<Goal | null>(null);
  const value = (g: Goal) => (g.of === "stamp" ? stamps : countries);
  return (
    <>
      <ul className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 pt-1 [scrollbar-width:none]">
        {GOALS.map((g) => {
          const done = value(g) >= g.need;
          return (
            <li key={g.key} className="flex-none">
              <button type="button" onClick={() => setOpen(g)} aria-label={`${g.label} 배지, ${done ? "달성" : `${value(g)}/${g.need}`}`}
                className={`press flex w-[100px] flex-col items-center gap-1.5 rounded-card bg-surface px-2 pb-2.5 pt-3 text-center gb-${g.tier}`}>
                <Badge g={g} value={value(g)} />
                <span className="mt-1 text-tiny font-bold text-ink">{g.label}</span>
                <span className={`text-[11px] font-semibold ${done ? "gb-tc font-extrabold tracking-wider" : "text-ink-sub"}`}>{done ? TIER_NAME[g.tier] : `${value(g)}/${g.need}`}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {open && <BadgeDialog g={open} value={value(open)} onClose={() => setOpen(null)} />}
    </>
  );
}

function BadgeDialog({ g, value, onClose }: { g: Goal; value: number; onClose: () => void }) {
  const done = value >= g.need;
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const back = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    if (done) navigator.vibrate?.([20, 40, 30]);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    addEventListener("keydown", esc);
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { removeEventListener("keydown", esc); document.body.style.overflow = prev; back?.focus?.(); };
  }, [onClose, done]);
  const left = g.need - value;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6 backdrop-blur-[2px]" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={`${g.label} 배지`} onClick={(e) => e.stopPropagation()}
        className={`modal-pop relative flex w-full max-w-[320px] flex-col items-center overflow-hidden rounded-deep bg-deep px-5 pb-5 pt-8 text-center text-on-deep shadow-float gb-${g.tier}`}>
        <div aria-hidden className="pointer-events-none absolute left-1/2 top-[-80px] size-[360px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgb(255_90_54/0.42)_0%,rgb(255_90_54/0.1)_40%,transparent_68%)]" />
        <div className={`relative my-9 ${done ? "gb-land" : ""}`} style={{ transform: "scale(1.8)" }}><Badge g={g} value={value} big /></div>
        {done && Array.from({ length: 14 }, (_, i) => {
          const a = (i / 14) * Math.PI * 2;
          return <i key={i} aria-hidden className="gb-spark" style={{ ["--dx" as string]: `${Math.cos(a) * 120}px`, ["--dy" as string]: `${Math.sin(a) * 100}px`, background: i % 2 ? "#fff" : "var(--gb-m2)" }} />;
        })}
        <span className={`relative rounded-full px-3 py-1 text-tiny font-extrabold tracking-wider ${done ? "gb-tier text-[#3A2A18]" : "bg-deep-soft text-on-deep-sub"}`}>{done ? TIER_NAME[g.tier] : "아직 잠겨 있어요"}</span>
        <h2 className="relative mt-2.5 text-title-lg font-extrabold">{g.label}</h2>
        <p className="relative mt-1 text-sub text-on-deep-sub">{done ? g.desc : `${left}${g.of === "stamp" ? "개" : "곳"} 더 모으면 ${TIER_NAME[g.tier]} 배지를 받아요`}</p>
        {!done && (
          <>
            <div className="relative mt-4 h-2 w-full overflow-hidden rounded-full bg-deep-soft"><i className="absolute inset-y-0 left-0 rounded-full bg-point" style={{ width: `${(value / g.need) * 100}%` }} /></div>
            <p className="relative mt-1.5 text-tiny text-on-deep-sub">{value}/{g.need}</p>
          </>
        )}
        <button ref={closeRef} type="button" onClick={onClose} className="press relative mt-5 h-12 w-full rounded-btn bg-on-deep text-body font-bold text-deep">확인</button>
      </div>
    </div>,
    document.body,
  );
}
