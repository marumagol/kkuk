"use client";
/*
  홀로그램 도장 카드 (0.94.0, 2026-11-18 마루님) : 도장 탭에서 모은 도장을 누르면 뜨는 카드
  - 앞면 : 금속 테두리 + 도장 그림 창(둥근 빛, 숨 쉬는 링) + 도시 별명 + 한 줄 소개. 빛 층(무지개, 반짝이, 별, 반사)이 각도를 따라 움직인다
  - 뒷면 : TRIPTUAL 워터마크 + 도장 실루엣 + 도시, 처음 받은 날, 방문 횟수
  - 누르면 뒤집히고, 가운데 카드는 끌어서 돌릴 수 있다 (0.95.2). 쉬는 동안 살짝 흔들린다. 동작 줄이기 설정이면 움직이지 않는다
  - 모양은 app/globals.css 의 hc-*
*/
import "@/components/cards.css";
import { useEffect, useRef } from "react";
import { StampFace } from "@/components/stamp-face";
import { countryOf } from "@/lib/countries";
import { cityLore } from "@/lib/city-lore";
import { backStars, finishOf, lookOf, tierName, twinkles, visitLabel, type Tier } from "@/lib/card-tier";

/* 에픽 카드 그림 창 네 모서리에서 차례로 반짝이는 별 */
export function Twinkles({ o = 18 }: { o?: number }) {
  const at = [{ left: o, top: o }, { right: o, top: o }, { left: o, bottom: o }, { right: o, bottom: o }];
  return <>{at.map((p, i) => <span key={i} aria-hidden className="tier-tw" style={{ ...p, animationDelay: `${i * 0.6}s` }}>✦</span>)}</>;
}

const EMB_OUT = "M36.55 8.35Q43.00 0.50 49.45 8.35Q55.91 16.20 66.07 16.35Q76.23 16.50 74.12 26.44Q72.00 36.38 78.22 44.42Q84.43 52.46 75.35 57.00Q66.26 61.55 63.85 71.42Q61.44 81.29 52.22 77.02Q43.00 72.75 33.78 77.02Q24.56 81.29 22.15 71.42Q19.74 61.55 10.65 57.00Q1.57 52.46 7.78 44.42Q14.00 36.38 11.88 26.44Q9.77 16.50 19.93 16.35Q30.09 16.20 36.55 8.35Z";
const EMB_IN = "M37.27 12.22Q43.00 5.25 48.73 12.22Q54.47 19.19 63.49 19.33Q72.51 19.46 70.64 28.29Q68.76 37.12 74.28 44.26Q79.80 51.40 71.73 55.44Q63.66 59.48 61.52 68.24Q59.38 77.01 51.19 73.22Q43.00 69.42 34.81 73.22Q26.62 77.01 24.48 68.24Q22.34 59.48 14.27 55.44Q6.20 51.40 11.72 44.26Q17.24 37.12 15.36 28.29Q13.49 19.46 22.51 19.33Q31.53 19.19 37.27 12.22Z";

/* 0.95.0 : 등급(tier)별 모양, 넘겨 보기 안에서 쓰므로 끌어 돌리기 대신 "누르면 뒤집기". 쉬는 동안 살짝 흔들림은 그대로 */
export function HoloCard({ name, country, tier = 2, date, visit = 1, visits, trip, active = true }: { name: string; trip?: string; country: string; tier?: Tier; date?: string; visit?: number; visits: number; active?: boolean }) {
  const persp = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const front = useRef<HTMLDivElement>(null);
  const goal = useRef(0);
  const on = useRef(active);
  useEffect(() => { on.current = active; }, [active]);

  useEffect(() => {
    const box = persp.current, c = card.current, f = front.current;
    if (!box || !c || !f) return;
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let rx = 0, ry = 0, vy = 0, raf = 0;
    /* 0.95.2 끌어서 돌리기 다시 (마루님) : 가운데 카드만. 끌면 손가락을 따라 돌고, 놓으면 가까운 면(앞/뒤)으로 돌아간다. 살짝 누르면 뒤집기 */
    let drag: { x: number; y: number; ry: number; id: number; moved: boolean } | null = null;
    let tx = 0;
    const t0 = performance.now();
    const paint = () => {
      c.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`;
      const a = ((ry % 360) + 360) % 360, s = Math.sin((a * Math.PI) / 180);
      f.style.setProperty("--px", `${50 + s * 50}%`); f.style.setProperty("--py", `${50 - rx * 2}%`);
      f.style.setProperty("--lx", `${50 + s * 60}%`); f.style.setProperty("--ly", `${30 - rx * 2}%`);
      f.style.setProperty("--fa", `${ry * 1.5}deg`); f.style.setProperty("--so", String(0.25 + Math.abs(s) * 0.6));
    };
    const tick = (now: number) => {
      if (drag) { vy = 0; rx += (tx - rx) * 0.3; paint(); raf = requestAnimationFrame(tick); return; }
      // 목표 면(앞 0 / 뒤 180)으로 스프링, 쉬는 동안 살짝 흔들림
      const idle = still ? 0 : Math.sin((now - t0) / 900) * 7;
      vy += (goal.current + (goal.current % 360 === 0 ? idle : -idle) - ry) * 0.05; vy *= 0.82; ry += vy;
      rx += ((still ? 0 : Math.cos((now - t0) / 1300) * 4) - rx) * 0.05;
      paint(); raf = requestAnimationFrame(tick);
    };
    const down = (e: PointerEvent) => {
      if (!on.current) return;
      drag = { x: e.clientX, y: e.clientY, ry, id: e.pointerId, moved: false };
      box.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) < 6) return;
      drag.moved = true;
      ry = drag.ry + dx * 0.7;
      tx = Math.max(-25, Math.min(25, -dy * 0.3));
    };
    const up = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      const tap = !drag.moved; drag = null; tx = 0;
      goal.current = tap ? goal.current + 180 : Math.round(ry / 180) * 180;
      navigator.vibrate?.(6);
      if (still) { ry = goal.current; rx = 0; paint(); }
    };
    box.addEventListener("pointerdown", down);
    box.addEventListener("pointermove", move);
    box.addEventListener("pointerup", up);
    box.addEventListener("pointercancel", up);
    if (still) paint();
    const start = setTimeout(() => { raf = requestAnimationFrame(tick); }, still ? 0 : 900); // 등장 움직임이 끝난 뒤
    return () => {
      clearTimeout(start); cancelAnimationFrame(raf);
      box.removeEventListener("pointerdown", down); box.removeEventListener("pointermove", move);
      box.removeEventListener("pointerup", up); box.removeEventListener("pointercancel", up);
    };
  }, []);

  const lore = cityLore(country, name);
  const look = lookOf(tier);
  const cname = countryOf(country)?.name ?? "";
  return (
    <div ref={persp} className="hc-persp" style={{ touchAction: active ? "none" : "pan-x" }} role="button" tabIndex={-1} aria-label={`${tierName(tier)} 카드, 누르면 뒷면을 볼 수 있어요`}>
      <div className="hc-enter">
        <div ref={card} className={`hc-card hc-t${look}`}>
          <div ref={front} className="hc-side hc-front">
            <div className="hc-inner">
              <div className="hc-name"><span className="truncate">{name}</span><small>{country.slice(0, 2)}{cname ? ` · ${cname}` : ""}</small></div>
              <div className="hc-win"><span aria-hidden className="hc-halo" /><span className="hc-art"><StampFace name={name} country={country} size={112} finish={finishOf(look)} /></span>{twinkles(tier) && <Twinkles />}</div>
              <div className="hc-nick">{lore?.nick ?? `${cname || name} 여행`}</div>
              <div className="hc-desc">{lore?.desc ?? `${name}에 직접 가서 받은 카드예요`}</div>
              <div className="hc-foot"><span className="hc-pill">{tierName(tier)}</span>{date && <span>{date}</span>}</div>
            </div>
            <span aria-hidden className="hc-holo" /><span aria-hidden className="hc-glitter" /><span aria-hidden className="hc-stars" />
            <span aria-hidden className="hc-shine" />
          </div>
          <div className="hc-side hc-back">
            <span aria-hidden className="hc-wm" />
            {backStars(tier) && <span aria-hidden className="hc-bstars" />}
            {twinkles(tier) && <Twinkles />}
            <svg aria-hidden className="hc-emb" viewBox="0 0 86 86"><path d={EMB_OUT} fill="none" stroke="currentColor" strokeWidth="2" /><path d={EMB_IN} fill="currentColor" /></svg>
            <span aria-hidden className="hc-ring" />
            <span className="hc-bk text-[10px] font-bold tracking-[0.3em] opacity-80">TRIPTUAL</span>
            <span className="max-w-[150px] truncate text-[22px] font-extrabold">{name}</span>
            {date && <span className="hc-bd text-micro font-semibold tabular-nums opacity-90">{date}</span>}
            <span className="mt-1 text-micro font-bold">{visitLabel(visit)}</span>
            <span className="hc-bpill">{tierName(tier)}</span>
            {trip && <span className="hc-btrip mt-1.5 max-w-[150px] truncate text-[10.5px] font-semibold opacity-85">✈ {trip}</span>}{/* 0.95.4 받은 여행은 뒷면에 (마루님) */}
          </div>
        </div>
      </div>
    </div>
  );
}
