"use client";
/*
  꾹 누르기 버튼 (0.86.1) : 0.8초 누르고 있으면 게이지가 차고 onComplete. 일찍 떼면 onShort
  키보드나 화면 읽기 기능으로 누르면(click detail 0) 바로 onComplete. 휴대폰 길게 누르기 메뉴는 막는다
  도장 받기(stamp-claim), 도장 테스트(stamp-tester)에서 쓴다
*/
import { useEffect, useRef, useState, type ReactNode } from "react";

export const HOLD_MS = 800;

export function HoldButton({ onStart, onComplete, onShort, disabled, label, holdingLabel = "꾹 누르고 있어요", className = "h-14 text-[16px]" }: {
  onStart?: () => boolean; onComplete: () => void; onShort?: () => void; disabled?: boolean;
  label: ReactNode; holdingLabel?: ReactNode; className?: string;
}) {
  const [holding, setHolding] = useState(false);
  const [full, setFull] = useState(false); // 다 찼으면 줄어들지 않고 잠시 그대로
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const down = (e: React.PointerEvent) => {
    if (disabled || (e.pointerType === "mouse" && e.button !== 0)) return;
    if (onStart && !onStart()) return;
    setHolding(true);
    navigator.vibrate?.(10);
    timer.current = setTimeout(() => {
      timer.current = null; setFull(true); setHolding(false);
      navigator.vibrate?.(60); // 다 찬 순간 딱
      onComplete();
      setTimeout(() => setFull(false), 1500);
    }, HOLD_MS);
  };
  const up = () => {
    if (!timer.current) return;
    clearTimeout(timer.current); timer.current = null;
    setHolding(false); onShort?.();
  };
  const key = (e: React.MouseEvent) => {
    if (e.detail !== 0 || disabled) return;
    if (onStart && !onStart()) return;
    onComplete();
  };

  return (
    <button type="button" disabled={disabled}
      onPointerDown={down} onPointerUp={up} onPointerLeave={up} onPointerCancel={up}
      onClick={key} onContextMenu={(e) => e.preventDefault()}
      className={"relative select-none overflow-hidden rounded-btn bg-btn font-bold text-on-btn transition-transform duration-100 [-webkit-touch-callout:none] [touch-action:manipulation] disabled:bg-surface-soft disabled:text-ink-sub " + (holding ? "scale-[0.97] " : "") + className}>
      <span aria-hidden className="absolute inset-y-0 left-0 bg-point"
        style={{ width: holding || full ? "100%" : "0%", transition: full ? "none" : `width ${holding ? HOLD_MS : 200}ms ${holding ? "linear" : "ease-out"}` }} />
      <span className="relative">{holding ? holdingLabel : label}</span>
    </button>
  );
}
