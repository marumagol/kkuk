"use client";
/*
  꾹 누르기 버튼 (0.86.1) : 0.8초 누르고 있으면 게이지가 차고 onComplete. 일찍 떼면 onShort
  키보드나 화면 읽기 기능으로 누르면(click detail 0) 바로 onComplete. 휴대폰 길게 누르기 메뉴는 막는다
  도장 받기(stamp-claim), 도장 테스트(stamp-tester)에서 쓴다
*/
import { useEffect, useRef, useState, type ReactNode } from "react";

export const HOLD_MS = 800;

export function HoldButton({ onStart, onComplete, onShort, disabled, label, holdingLabel = "꾹 누르고 있어요", className = "h-14 text-[16px]", ring }: {
  onStart?: () => boolean; onComplete: () => void; onShort?: () => void; disabled?: boolean;
  label: ReactNode; holdingLabel?: ReactNode; className?: string;
  /* ring : 원형 도장 버튼 + 둘레 링 게이지 (0.89.0 도장 받기 카드). 숫자는 지름(px) */
  ring?: number;
}) {
  const [holding, setHolding] = useState(false);
  const [full, setFull] = useState(false); // 다 찼으면 줄어들지 않고 잠시 그대로
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ticker = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopTick = () => { if (ticker.current) clearTimeout(ticker.current); ticker.current = null; };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); if (ticker.current) clearTimeout(ticker.current); }, []);

  const down = (e: React.PointerEvent) => {
    if (disabled || (e.pointerType === "mouse" && e.button !== 0)) return;
    if (onStart && !onStart()) return;
    setHolding(true);
    /* 누르는 동안 : 점점 빨라지는 약한 진동 (0.88.0) */
    let gap = 220;
    const tick = () => { navigator.vibrate?.(6); gap = Math.max(70, gap * 0.75); ticker.current = setTimeout(tick, gap); };
    tick();
    timer.current = setTimeout(() => {
      timer.current = null; stopTick(); setFull(true); setHolding(false);
      navigator.vibrate?.(60); // 다 찬 순간 딱
      onComplete();
      setTimeout(() => setFull(false), 1500);
    }, HOLD_MS);
  };
  const up = () => {
    if (!timer.current) return;
    clearTimeout(timer.current); timer.current = null; stopTick();
    setHolding(false); onShort?.();
  };
  const key = (e: React.MouseEvent) => {
    if (e.detail !== 0 || disabled) return;
    if (onStart && !onStart()) return;
    onComplete();
  };

  const handlers = {
    onPointerDown: down, onPointerUp: up, onPointerLeave: up, onPointerCancel: up,
    onClick: key, onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  };
  const on = holding || full;
  const dur = full ? "0ms" : `${holding ? HOLD_MS : 250}ms`;

  if (ring) {
    const R = ring / 2 - 4, C = 2 * Math.PI * R;
    return (
      <button type="button" disabled={disabled} {...handlers}
        className={"group relative flex-none select-none rounded-full [-webkit-touch-callout:none] [touch-action:none] disabled:opacity-60 " + className}
        style={{ width: ring, height: ring }}>
        <svg aria-hidden width={ring} height={ring} className="absolute inset-0 -rotate-90">
          <circle cx={ring / 2} cy={ring / 2} r={R} fill="none" stroke="var(--color-line)" strokeWidth={3} />
          <circle cx={ring / 2} cy={ring / 2} r={R} fill="none" stroke="var(--color-point, #FF5A36)" strokeWidth={4} strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={on ? 0 : C}
            style={{ transition: `stroke-dashoffset ${dur} ${holding ? "linear" : "ease-out"}` }} />
        </svg>
        <span className={"absolute inset-[12px] flex flex-col items-center justify-center rounded-full border-2 border-dashed transition-colors duration-300 " + (on ? "border-point bg-point-soft text-point-text " : "border-line-strong bg-surface-soft text-ink-sub ") + (holding ? "hold-tense" : "")}>
          {holding ? holdingLabel : label}
        </span>
      </button>
    );
  }

  return (
    <button type="button" disabled={disabled} {...handlers}
      className={"relative select-none overflow-hidden rounded-btn bg-btn font-bold text-on-btn transition-transform duration-100 [-webkit-touch-callout:none] [touch-action:manipulation] disabled:bg-surface-soft disabled:text-ink-sub " + (holding ? "hold-tense " : "") + className}>
      <span aria-hidden className="absolute inset-y-0 left-0 bg-point"
        style={{ width: on ? "100%" : "0%", transition: `width ${dur} ${holding ? "linear" : "ease-out"}` }} />
      <span className="relative">{holding ? holdingLabel : label}</span>
    </button>
  );
}
