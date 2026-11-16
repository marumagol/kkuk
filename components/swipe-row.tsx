"use client";
/*
  목록 줄 제스처 (2026-11-16 마루님) : 왼쪽으로 밀면 삭제, 길게 누르면 옮기기 시작
  - 세로 스크롤은 그대로 (touch-action: pan-y). 가로로 먼저 움직일 때만 밀기로 본다
  - 너비의 35% (최대 120px) 넘게 밀고 놓으면 onDelete. 덜 밀면 제자리로
  - 0.3초 동안 거의 안 움직이고 누르고 있으면 onLongPress(그 손가락의 y). 그 뒤 손가락 움직임은 부르는 쪽이 창(window)에서 받는다
  - 밀거나 길게 누른 뒤 따라오는 누름(click)은 막아서, 카드 링크로 넘어가지 않는다
  - 버튼(삭제, 편집)은 그대로 두어 제스처를 못 쓰는 사람도 쓸 수 있다
*/
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "@/components/kit";

const HOLD_MS = 300, SLOP = 8;

export function SwipeRow({ children, onDelete, onLongPress, disabled, className = "", rounded = "rounded-pin", bg = "bg-bg" }: {
  children: ReactNode; onDelete?: () => void; onLongPress?: (y: number) => void; disabled?: boolean; className?: string; rounded?: string; bg?: string /* 미는 줄의 바탕 (뒤 빨간 칸이 비치지 않게) */;
}) {
  const [dx, setDx] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const g = useRef<{ id: number; x: number; y: number; mode: "" | "swipe" | "scroll" | "hold"; timer: number } | null>(null);
  const eatClick = useRef(false);

  // 밀거나 붙잡은 동안에는 화면이 스크롤되지 않게 (아이폰은 touchmove 를 막아야 한다)
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const stop = (e: TouchEvent) => { const m = g.current?.mode; if (m === "swipe" || m === "hold") e.preventDefault(); };
    el.addEventListener("touchmove", stop, { passive: false });
    return () => el.removeEventListener("touchmove", stop);
  }, []);
  useEffect(() => () => { if (g.current) clearTimeout(g.current.timer); }, []);

  const end = () => {
    const s = g.current;
    if (!s) return;
    clearTimeout(s.timer);
    g.current = null;
    if (s.mode !== "swipe") return;
    const w = box.current?.offsetWidth ?? 300;
    if (onDelete && dxRef.current < -Math.min(120, w * 0.35)) {
      setLeaving(true); setDx(-w);
      setTimeout(() => { onDelete(); setLeaving(false); setDx(0); }, 180);
    } else setDx(0);
  };
  const dxRef = useRef(0);
  dxRef.current = dx;

  return (
    <div ref={box} className={`relative touch-pan-y select-none [-webkit-touch-callout:none] ${className}`}
      onClickCapture={(e) => { if (eatClick.current) { e.preventDefault(); e.stopPropagation(); eatClick.current = false; } }}
      onContextMenu={(e) => { if (onLongPress) e.preventDefault(); }}
      onDragStart={(e) => e.preventDefault() /* 링크 끌기(컴퓨터)가 밀기를 끊지 않게 */}
      onPointerDown={(e) => {
        if (disabled || e.button !== 0 || (e.target as Element).closest("button, a[target=_blank], input, textarea, select, [data-grip]")) return;
        eatClick.current = false;
        const y = e.clientY;
        const timer = window.setTimeout(() => {
          const s = g.current;
          if (!s || s.mode || !onLongPress) return;
          s.mode = "hold"; eatClick.current = true;
          navigator.vibrate?.(12);
          onLongPress(y);
        }, HOLD_MS);
        g.current = { id: e.pointerId, x: e.clientX, y, mode: "", timer };
      }}
      onPointerMove={(e) => {
        const s = g.current;
        if (!s || s.id !== e.pointerId) return;
        const mx = e.clientX - s.x, my = e.clientY - s.y;
        if (!s.mode) {
          if (Math.abs(my) > SLOP && Math.abs(my) >= Math.abs(mx)) { s.mode = "scroll"; clearTimeout(s.timer); return; }
          if (onDelete && mx < -SLOP && Math.abs(mx) > Math.abs(my)) { s.mode = "swipe"; clearTimeout(s.timer); eatClick.current = true; box.current?.setPointerCapture(e.pointerId); }
          else if (Math.abs(mx) > SLOP) { s.mode = "scroll"; clearTimeout(s.timer); return; }
        }
        if (s.mode === "swipe") setDx(Math.min(0, mx));
      }}
      onPointerUp={end} onPointerCancel={() => { const s = g.current; if (s?.mode === "swipe") setDx(0); if (s) clearTimeout(s.timer); g.current = null; }}>
      {onDelete && dx < 0 && (
        <div aria-hidden className={`absolute inset-0 flex items-center justify-end gap-1.5 bg-point pr-5 text-sub font-bold text-white ${rounded}`}>
          <Icon name="trash" size={18} />삭제
        </div>
      )}
      <div className={`relative ${dx ? bg : ""}`} style={{ transform: dx ? `translateX(${dx}px)` : undefined, transition: g.current?.mode === "swipe" && !leaving ? "none" : "transform 180ms ease-out" }}>
        {children}
      </div>
    </div>
  );
}
