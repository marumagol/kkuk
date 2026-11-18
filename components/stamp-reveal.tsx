"use client";
/*
  도장 등장 연출 (0.87.1) : 꾹 누르기가 끝나고 도장을 받으면 화면 가운데에 크게 등장한다
  배경 흐림 → 도장이 위에서 쿵 찍힘(스프링) → 충격파 링 + 잉크 조각이 퍼짐 + 화면 살짝 흔들림 → 빛이 한 번 훑고 → 글자가 올라옴
  누르거나 확인을 누르면 닫힌다. 동작 줄이기 설정이면 흔들림과 조각 없이 나타나기만 한다
*/
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { StampFace } from "@/components/kit";

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const CHARGE_MS = 1200;


/* city 가 아직 없으면(서버 답을 기다리는 동안) 빛만 모이고, 오면 바로 찍힌다. 글자로 기다리라고 하지 않는다 */
export function StampReveal({ city: cityIn, country, title, sub, visits, onClose }: { city?: string | null; country?: string | null; title: string; sub: string; visits?: number; onClose: () => void }) {
  /* 0.88.0 : 답이 바로 와도 1.2초(0.89.2)는 긴장 고조 연출을 보여 준 뒤 찍는다 */
  const [ready, setReady] = useState(false);
  useEffect(() => { const t = setTimeout(() => setReady(true), CHARGE_MS); return () => clearTimeout(t); }, []);
  const city = ready ? cityIn : null;
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; });
  /* 기다리는 동안 : 심장 박동처럼 점점 빨라지는 약한 진동 */
  useEffect(() => {
    if (city) return;
    let gap = 420, t: ReturnType<typeof setTimeout>;
    const beat = () => { navigator.vibrate?.(8); gap = Math.max(160, gap * 0.85); t = setTimeout(beat, gap); };
    t = setTimeout(beat, 200);
    return () => clearTimeout(t);
  }, [city]);
  useEffect(() => {
    if (!city) return;
    const t = setTimeout(() => navigator.vibrate?.([0, 30, 40, 90]), 1300); // 도시 도장이 찍히는 순간
    const t2 = setTimeout(() => navigator.vibrate?.(50), 1850); // 입국 날짜 도장
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") close.current(); }; // 키보드 사용자는 Esc 로도 닫힘. 화면 바깥을 눌러서는 닫히지 않는다 (0.92.6)
    window.addEventListener("keydown", k);
    return () => { clearTimeout(t); clearTimeout(t2); window.removeEventListener("keydown", k); };
  }, [city]);

  const now = new Date();
  const ymd = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const entryDate = `${now.getDate()} ${MONTHS[now.getMonth()]} ${now.getFullYear()}`;
  const cc = (country ?? "").slice(0, 2).toUpperCase() || "XX";
  const heading = title === "도장 꾹!" && city ? `${city} 도장 꾹!` : title;

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={city ? `${city} 도장` : "도장"}
      className="sr-backdrop fixed inset-0 z-50 flex flex-col items-center justify-center px-6">
      {!city ? (
        <div className="relative flex size-[260px] items-center justify-center">
          {/* 긴장 고조 : 빛이 모이고, 점선 링이 점점 빨리 돌고, 빈 도장이 떨리며 내려올 준비를 한다 */}
          <span aria-hidden className="sr-charge absolute size-[220px] rounded-full" />
          <span aria-hidden className="sr-orbit absolute size-[236px] rounded-full" />
          <span aria-hidden className="sr-orbit sr-orbit-2 absolute size-[200px] rounded-full" />
          <span aria-hidden className="sr-blank relative flex size-[180px] items-center justify-center rounded-full text-[40px] font-extrabold text-white/90">꾹</span>
        </div>
      ) : (
        /* 0.93.0 여권 연출 (마루님 B안) : 여권이 펼쳐지고 → 도시 도장 쿵 → 입국 날짜 도장 쾅 */
        <div className="sp-shake">
          <svg width="0" height="0" className="absolute" aria-hidden>
            <filter id="sp-ink" x="-10%" y="-10%" width="120%" height="120%">
              <feTurbulence type="fractalNoise" baseFrequency=".7" numOctaves="2" seed="4" result="n" />
              <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -9 6.3" result="holes" />
              <feComposite in="SourceGraphic" in2="holes" operator="in" result="grain" />
              <feTurbulence type="fractalNoise" baseFrequency=".05" numOctaves="2" seed="9" result="w" />
              <feDisplacementMap in="grain" in2="w" scale="3.5" />
            </filter>
          </svg>
          <div className="sp-book">
            <div className="sp-page">
              <div className="sp-hd"><span>VISAS · 사증</span><span>KKUK</span></div>
              <span className="sp-no">KKUK PASSPORT</span>
              <div className="sp-city"><StampFace name={city} country={country} size={150} /></div>
              <div className="sp-entry">
                <div className="sp-a">ARRIVED</div>
                <div className="sp-b">{city}</div>
                <div className="sp-c">{entryDate}</div>
              </div>
              <div className="sp-lines">{`P<KOR<<KKUK<<${cc}<<<<<<<<<<<<<<`}<br />{`${cc}${String(visits ?? 1).padStart(4, "0")}<<${ymd}<<<<<<<<<<`}</div>
            </div>
            <div className="sp-cover" aria-hidden><span className="sp-em">꾹</span><span className="sp-ttl">PASSPORT</span></div>
          </div>
        </div>
      )}
      {city && <>
      <p className="sr-text mt-7 text-center text-[24px] font-extrabold text-white" style={{ animationDelay: "2050ms" }}>{heading}</p>
      <p className="sr-text mt-1 text-center text-sub text-white/80" style={{ animationDelay: "2200ms" }}>{sub}</p>
      {/* 받는 건 도장, 모으는 건 카드 (0.94.2 마루님 1안) */}
      {title !== "이미 받은 도장" && <p className="sr-text mt-3 rounded-full bg-white/12 px-3 py-1 text-center text-tiny font-bold text-[#FFD9A8]" style={{ animationDelay: "2300ms" }}>도장 카드가 도장 탭에 모였어요</p>}
      <button type="button" onClick={onClose}
        className="sr-text press mt-7 h-12 rounded-btn bg-white px-10 text-sub font-bold text-[#111]" style={{ animationDelay: "2400ms" }}>확인</button>
      </>}
    </div>,
    document.body,
  );
}
