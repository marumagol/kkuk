"use client";
/*
  메달 돌려 보기 (0.88.0) : 손가락(마우스)으로 끌면 메달이 3D 로 돈다
  - 좌우 : 끝없이 돌릴 수 있고, 세게 튕기면 관성으로 더 돈다. 뒷면이 보인다
  - 상하 : ±35도까지 기울어진다
  - 손을 떼면 관성이 줄어든 뒤 가장 가까운 앞면으로 스프링처럼 돌아온다
  - 0.88.1 입체감 : 두께(금색 옆면 여러 겹), 돌아갈수록 어두워지는 면, 바닥 그림자가 각도에 따라 줄어듦
  - 빛 반사가 각도를 따라 움직인다. 동작 줄이기 설정이면 돌지 않는다
*/
import { useEffect, useRef, type ReactNode } from "react";

export function MedalSpin({ front, back, size }: { front: ReactNode; back: ReactNode; size: number }) {
  const el = useRef<HTMLDivElement>(null);
  const shine = useRef<HTMLSpanElement>(null);
  const shade = useRef<HTMLSpanElement>(null);
  const shadeBack = useRef<HTMLSpanElement>(null);
  const floor = useRef<HTMLSpanElement>(null);
  const s = useRef({ rx: 0, ry: 0, vx: 0, vy: 0, drag: false, lx: 0, ly: 0, lt: 0, raf: 0 });

  useEffect(() => {
    const st = s.current;
    const paint = () => {
      if (el.current) el.current.style.transform = `rotateX(${st.rx}deg) rotateY(${st.ry}deg)`;
      const rad = (st.ry * Math.PI) / 180, c = Math.cos(rad);
      // 옆으로 돌아갈수록 그 면이 어두워진다
      if (shade.current) shade.current.style.opacity = String(Math.min(0.55, Math.max(0, (1 - c) * 0.5)));
      if (shadeBack.current) shadeBack.current.style.opacity = String(Math.min(0.55, Math.max(0, (1 + c) * 0.5)));
      // 바닥 그림자 : 옆으로 서면 좁아지고, 기울면 앞뒤로 움직인다
      if (floor.current) floor.current.style.transform = `translateX(-50%) translateY(${st.rx * 0.4}px) scaleX(${0.35 + 0.65 * Math.abs(c)})`;
      if (shine.current) {
        const a = ((st.ry % 360) + 360) % 360;
        shine.current.style.backgroundPosition = `${50 + Math.sin((a * Math.PI) / 180) * 60}% ${50 - st.rx * 1.4}%`;
      }
    };
    const tick = () => {
      if (!st.drag) {
        // 관성 → 줄어들면 가장 가까운 앞면(360의 배수)과 0도로 스프링
        st.vy *= 0.95; st.vx *= 0.9;
        st.ry += st.vy; st.rx += st.vx;
        if (Math.abs(st.vy) < 1.2) {
          const target = Math.round(st.ry / 360) * 360;
          st.vy += (target - st.ry) * 0.06; st.vy *= 0.8;
        }
        st.vx += (0 - st.rx) * 0.08; st.vx *= 0.8;
        st.rx = Math.max(-35, Math.min(35, st.rx));
        const settled = Math.abs(st.vy) < 0.02 && Math.abs(st.vx) < 0.02 && Math.abs(st.ry - Math.round(st.ry / 360) * 360) < 0.1 && Math.abs(st.rx) < 0.1;
        if (settled) { st.ry = Math.round(st.ry / 360) * 360; st.rx = 0; paint(); st.raf = 0; return; }
      }
      paint();
      st.raf = requestAnimationFrame(tick);
    };
    const start = () => { if (!st.raf) st.raf = requestAnimationFrame(tick); };
    const node = el.current?.parentElement;
    if (!node || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const down = (e: PointerEvent) => {
      st.drag = true; st.lx = e.clientX; st.ly = e.clientY; st.lt = performance.now(); st.vx = st.vy = 0;
      node.setPointerCapture(e.pointerId); start();
    };
    const move = (e: PointerEvent) => {
      if (!st.drag) return;
      const now = performance.now(), dt = Math.max(8, now - st.lt);
      const dx = e.clientX - st.lx, dy = e.clientY - st.ly;
      st.ry += dx * 0.9; st.rx = Math.max(-35, Math.min(35, st.rx - dy * 0.5));
      st.vy = (dx * 0.9 * 16) / dt; st.vx = (-dy * 0.5 * 16) / dt;
      st.lx = e.clientX; st.ly = e.clientY; st.lt = now;
    };
    const up = () => { if (!st.drag) return; st.drag = false; st.vy = Math.max(-40, Math.min(40, st.vy)); navigator.vibrate?.(6); start(); };
    node.addEventListener("pointerdown", down);
    node.addEventListener("pointermove", move);
    node.addEventListener("pointerup", up);
    node.addEventListener("pointercancel", up);
    return () => {
      node.removeEventListener("pointerdown", down); node.removeEventListener("pointermove", move);
      node.removeEventListener("pointerup", up); node.removeEventListener("pointercancel", up);
      cancelAnimationFrame(st.raf);
    };
  }, []);

  const T = 14; // 메달 두께(px)
  const face = "absolute inset-0 overflow-hidden rounded-full [backface-visibility:hidden] [-webkit-backface-visibility:hidden]";
  const edges = Array.from({ length: T - 1 }, (_, i) => i - (T - 2) / 2);
  return (
    <div className="relative cursor-grab touch-none select-none active:cursor-grabbing [perspective:800px]" style={{ width: size, height: size }}
      aria-label="메달을 끌어서 돌려 볼 수 있어요">
      <span ref={floor} aria-hidden className="pointer-events-none absolute left-1/2 top-full mt-3 h-4 w-[70%] rounded-[50%] bg-black/45 blur-md"
        style={{ transform: "translateX(-50%)" }} />
      <div ref={el} className="relative size-full [transform-style:preserve-3d]">
        {/* 옆면 : 금색 원판을 겹겹이 쌓아 두께를 만든다 (가운데일수록 어둡게) */}
        {edges.map((z) => (
          <span key={z} aria-hidden className="absolute inset-0 rounded-full"
            style={{ transform: `translateZ(${z}px)`, background: `linear-gradient(180deg, #E3A55C, #9C6227)`, filter: `brightness(${0.75 + Math.abs(z) * 0.03})` }} />
        ))}
        <div className={face} style={{ transform: `translateZ(${T / 2}px)` }}>
          {front}
          <span ref={shine} aria-hidden className="pointer-events-none absolute inset-0 mix-blend-soft-light"
            style={{ background: "linear-gradient(115deg, transparent 30%, rgb(255 255 255 / .75) 48%, transparent 62%)", backgroundSize: "250% 250%", backgroundPosition: "50% 50%" }} />
          <span ref={shade} aria-hidden className="pointer-events-none absolute inset-0 bg-black opacity-0" />
        </div>
        <div className={face} style={{ transform: `rotateY(180deg) translateZ(${T / 2}px)` }}>
          {back}
          <span ref={shadeBack} aria-hidden className="pointer-events-none absolute inset-0 bg-black opacity-0" />
        </div>
      </div>
    </div>
  );
}
