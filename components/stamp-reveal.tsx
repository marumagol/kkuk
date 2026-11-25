"use client";
/*
  도장 등장 연출 (0.87.1) : 꾹 누르기가 끝나고 도장을 받으면 화면 가운데에 크게 등장한다
  배경 흐림 → 도장이 위에서 쿵 찍힘(스프링) → 충격파 링 + 잉크 조각이 퍼짐 + 화면 살짝 흔들림 → 빛이 한 번 훑고 → 글자가 올라옴
  누르거나 확인을 누르면 닫힌다. 동작 줄이기 설정이면 흔들림과 조각 없이 나타나기만 한다
*/
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { StampFace } from "@/components/kit";
import { GLOW } from "@/components/card-draw";
import { HoloCard } from "@/components/holo-card";
import { tierName, visitLabel, type Tier } from "@/lib/card-tier";

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const CHARGE_MS = 1200;


/* city 가 아직 없으면(서버 답을 기다리는 동안) 빛만 모이고, 오면 바로 찍힌다. 글자로 기다리라고 하지 않는다 */
/* 0.103.0 card : 이번에 나온 카드 (마루님 B안). 입국 도장 뒤 도장과 여권이 테마 색으로 빛나고, 빛나는 도장(또는 버튼)을 누르면
   빛이 카드가 되어 여권에서 떠오른다. 도장은 여권에 남는다. 다 모은 도시(card 없음)는 빛 없이 확인만. 모양은 globals.css se-* */
export function StampReveal({ city: cityIn, country, title, sub, visits, card, onClose }: { city?: string | null; country?: string | null; title: string; sub: string; visits?: number; card?: { tier: Tier; visit: number } | null; onClose: () => void }) {
  const [phase, setPhase] = useState<"stamp" | "glow" | "lift" | "shown">("stamp");
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
    const t = setTimeout(() => navigator.vibrate?.([0, 30, 40, 90]), 1700); // 도시 도장이 찍히는 순간 (0.94.6 표지가 다 넘어간 뒤)
    const t2 = setTimeout(() => navigator.vibrate?.(50), 2250); // 입국 날짜 도장
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") close.current(); }; // 키보드 사용자는 Esc 로도 닫힘. 화면 바깥을 눌러서는 닫히지 않는다 (0.92.6)
    window.addEventListener("keydown", k);
    return () => { clearTimeout(t); clearTimeout(t2); window.removeEventListener("keydown", k); };
  }, [city]);

  /* 카드가 있으면 입국 도장 뒤(2.7초) 빛나기 시작 */
  useEffect(() => {
    if (!city || !card) return;
    const t = setTimeout(() => setPhase((p) => (p === "stamp" ? "glow" : p)), 2700);
    return () => clearTimeout(t);
  }, [city, card]);
  const lift = () => {
    if (phase === "lift" || phase === "shown") return;
    navigator.vibrate?.([0, 15, 40, 60]);
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { setPhase("shown"); return; }
    setPhase("lift");
    setTimeout(() => navigator.vibrate?.([0, 20, 30, 70]), 2900); // 0.103.1 돌던 카드가 멈추며 앞면이 보이는 순간
    setTimeout(() => setPhase("shown"), 3300);
  };
  const glowing = phase === "glow" || phase === "lift";

  const now = new Date();
  const ymd = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const entryDate = `${now.getDate()} ${MONTHS[now.getMonth()]} ${now.getFullYear()}`;
  const cc = (country ?? "").slice(0, 2).toUpperCase() || "XX";
  const heading = title === "도장 꾹!" && city ? `${city} 도장 꾹!` : title;

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={city ? `${city} 도장` : "도장"}
      className="sr-backdrop fixed inset-0 z-50 flex flex-col items-center justify-center px-6" style={card ? { ["--g" as string]: GLOW[card.tier] ?? "255 255 255" } : undefined}>
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
        <div className={`se-stage se-${phase}`}>
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
              <div className="sp-city" onClick={card && phase === "glow" ? lift : undefined}><StampFace name={city} country={country} size={150} /></div>
              <div className="sp-entry">
                <div className="sp-a">ARRIVED</div>
                <div className="sp-b">{city}</div>
                <div className="sp-c">{entryDate}</div>
              </div>
              {glowing && <span aria-hidden className="se-bloom" />}
              <div className="sp-lines">{`P<KOR<<KKUK<<${cc}<<<<<<<<<<<<<<`}<br />{`${cc}${String(visits ?? 1).padStart(4, "0")}<<${ymd}<<<<<<<<<<`}</div>
            </div>
            <span className="sp-cast" aria-hidden />
            {glowing && <span aria-hidden className="se-edge" />}
            {/* 표지 (0.94.3) : 바깥면과 안쪽면이 있는 한 장. 왼쪽 경첩을 따라 넘어가 펼쳐진 채로 남는다 */}
            <div className="sp-cover" aria-hidden>
              <div className="sp-face sp-out"><span className="sp-em">꾹</span><span className="sp-ttl">PASSPORT</span></div>
              <div className="sp-face sp-in"><span className="sp-in-hd">KKUK PASSPORT</span><span className="sp-photo" /></div>
            </div>
          </div>
        </div>
        {card && (phase === "lift" || phase === "shown") && <>
          <div aria-hidden className="se-motes">{[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => <i key={i} style={{ left: 20 + ((i * 53) % 230), animationDelay: `${(i * 90) % 700}ms` }} />)}</div>
          <div className="se-card">
            <HoloCard name={city} country={country ?? ""} tier={card.tier} visit={card.visit} visits={card.visit} active={phase === "shown"}
              date={`${ymd.slice(0, 2)}.${ymd.slice(2, 4)}.${ymd.slice(4)}`} />
            <span aria-hidden className="se-veil" />
          </div>
        </>}
        </div>
      )}
      {city && card && phase === "shown" ? <>
      <p className="sr-text mt-7 text-center text-[24px] font-extrabold text-white" aria-live="polite">{tierName(card.tier)} 카드가 나왔어요</p>
      <p className="sr-text mt-1 text-center text-sub text-white/80" style={{ animationDelay: "120ms" }}>{card.visit === 1 ? `${city}에서 처음 받은 카드예요` : `${city} ${visitLabel(card.visit)} 카드예요`}</p>
      <button type="button" onClick={onClose} className="sr-text press mt-7 h-12 rounded-btn bg-white px-10 text-sub font-bold text-[#111]" style={{ animationDelay: "240ms" }}>확인</button>
      </> : city && phase !== "lift" && <>
      <p className="sr-text mt-7 text-center text-[24px] font-extrabold text-white" style={{ animationDelay: "2450ms" }}>{heading}</p>
      <p className="sr-text mt-1 text-center text-sub text-white/80" style={{ animationDelay: "2600ms" }}>{sub}</p>
      {card ? (
        <button type="button" onClick={lift} className="se-hint sr-text press mt-7 h-12 rounded-full px-6 text-sub font-bold text-white" style={{ animationDelay: "2800ms" }}>빛나는 도장을 눌러 카드 꺼내기</button>
      ) : (
        <button type="button" onClick={onClose} className="sr-text press mt-7 h-12 rounded-btn bg-white px-10 text-sub font-bold text-[#111]" style={{ animationDelay: "2800ms" }}>확인</button>
      )}
      </>}
    </div>,
    document.body,
  );
}
