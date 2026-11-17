"use client";
/*
  도장 등장 연출 (0.87.1) : 꾹 누르기가 끝나고 도장을 받으면 화면 가운데에 크게 등장한다
  배경 흐림 → 도장이 위에서 쿵 찍힘(스프링) → 충격파 링 + 잉크 조각이 퍼짐 + 화면 살짝 흔들림 → 빛이 한 번 훑고 → 글자가 올라옴
  누르거나 확인을 누르면 닫힌다. 동작 줄이기 설정이면 흔들림과 조각 없이 나타나기만 한다
*/
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { StampFace } from "@/components/kit";
import { stampColor } from "@/lib/stamp-art";

const BITS = Array.from({ length: 14 }, (_, i) => {
  const a = (i / 14) * Math.PI * 2 + (i % 2 ? 0.2 : -0.1);
  const d = 110 + (i % 3) * 26;
  return { x: Math.cos(a) * d, y: Math.sin(a) * d, s: 6 + (i % 4) * 3, delay: (i % 3) * 25 };
});

/* city 가 아직 없으면(서버 답을 기다리는 동안) 빛만 모이고, 오면 바로 찍힌다. 글자로 기다리라고 하지 않는다 */
export function StampReveal({ city, country, title, sub, onClose }: { city?: string | null; country?: string | null; title: string; sub: string; onClose: () => void }) {
  const color = stampColor(country);
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; });
  useEffect(() => {
    if (!city) return;
    const t = setTimeout(() => navigator.vibrate?.([0, 30, 40, 90]), 380); // 찍히는 순간에 맞춘 진동
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") close.current(); };
    window.addEventListener("keydown", k);
    return () => { clearTimeout(t); window.removeEventListener("keydown", k); };
  }, [city]);

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={city ? `${city} 도장` : "도장"} onClick={city ? onClose : undefined}
      className="sr-backdrop fixed inset-0 z-50 flex flex-col items-center justify-center px-6">
      <div className="sr-shake relative flex size-[260px] items-center justify-center" style={{ ["--sr-color" as string]: color }}>
        {!city ? <span aria-hidden className="sr-charge absolute size-[200px] rounded-full" /> : <>
        <span aria-hidden className="sr-glow absolute inset-0 rounded-full" />
        <span aria-hidden className="sr-ring absolute size-[180px] rounded-full" />
        <span aria-hidden className="sr-ring sr-ring-2 absolute size-[180px] rounded-full" />
        {BITS.map((b, i) => (
          <span key={i} aria-hidden className="sr-bit absolute rounded-full"
            style={{ width: b.s, height: b.s, ["--x" as string]: `${b.x}px`, ["--y" as string]: `${b.y}px`, animationDelay: `${380 + b.delay}ms` }} />
        ))}
        <div className="sr-stamp relative overflow-hidden rounded-full">
          <StampFace name={city} country={country} size={200} />
          <span aria-hidden className="sr-sheen absolute inset-0" />
        </div>
        </>}
      </div>
      {city && <>
      <p className="sr-text mt-6 text-center text-[24px] font-extrabold text-white" style={{ animationDelay: "620ms" }}>{title}</p>
      <p className="sr-text mt-1 text-center text-sub text-white/80" style={{ animationDelay: "720ms" }}>{sub}</p>
      <button type="button" onClick={onClose}
        className="sr-text press mt-8 h-12 rounded-btn bg-white px-10 text-sub font-bold text-[#111]" style={{ animationDelay: "900ms" }}>확인</button>
      </>}
    </div>,
    document.body,
  );
}
