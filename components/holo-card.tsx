"use client";
/*
  홀로그램 도장 카드 (0.94.0, 2026-11-18 마루님) : 도장 탭에서 모은 도장을 누르면 뜨는 카드
  - 앞면 : 금속 테두리 + 도장 그림 창(둥근 빛, 숨 쉬는 링) + 도시 별명 + 한 줄 소개. 빛 층(무지개, 반짝이, 별, 반사)이 각도를 따라 움직인다
  - 뒷면 : KKUK 워터마크 + 도장 실루엣 + 도시, 처음 받은 날, 방문 횟수
  - 끌면 좌우로 뒤집히고 위아래로 기운다. 놓으면 가까운 면으로 돌아와 살짝 흔들린다. 동작 줄이기 설정이면 움직이지 않는다
  - 모양은 app/globals.css 의 hc-*
*/
import { useEffect, useRef } from "react";
import { StampFace } from "@/components/kit";
import { countryOf } from "@/lib/countries";
import { cityLore } from "@/lib/city-lore";

const EMB_OUT = "M36.55 8.35Q43.00 0.50 49.45 8.35Q55.91 16.20 66.07 16.35Q76.23 16.50 74.12 26.44Q72.00 36.38 78.22 44.42Q84.43 52.46 75.35 57.00Q66.26 61.55 63.85 71.42Q61.44 81.29 52.22 77.02Q43.00 72.75 33.78 77.02Q24.56 81.29 22.15 71.42Q19.74 61.55 10.65 57.00Q1.57 52.46 7.78 44.42Q14.00 36.38 11.88 26.44Q9.77 16.50 19.93 16.35Q30.09 16.20 36.55 8.35Z";
const EMB_IN = "M37.27 12.22Q43.00 5.25 48.73 12.22Q54.47 19.19 63.49 19.33Q72.51 19.46 70.64 28.29Q68.76 37.12 74.28 44.26Q79.80 51.40 71.73 55.44Q63.66 59.48 61.52 68.24Q59.38 77.01 51.19 73.22Q43.00 69.42 34.81 73.22Q26.62 77.01 24.48 68.24Q22.34 59.48 14.27 55.44Q6.20 51.40 11.72 44.26Q17.24 37.12 15.36 28.29Q13.49 19.46 22.51 19.33Q31.53 19.19 37.27 12.22Z";

export function HoloCard({ name, country, no, date, visits }: { name: string; country: string; no?: number | null; date?: string; visits: number }) {
  const persp = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const front = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const box = persp.current, c = card.current, f = front.current;
    if (!box || !c || !f || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let rx = 0, ry = 0, vy = 0, drag = false, lx = 0, ly = 0, raf = 0;
    const t0 = performance.now();
    const paint = () => {
      c.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`;
      const a = ((ry % 360) + 360) % 360, s = Math.sin((a * Math.PI) / 180);
      f.style.setProperty("--px", `${50 + s * 50}%`); f.style.setProperty("--py", `${50 - rx * 2}%`);
      f.style.setProperty("--lx", `${50 + s * 60}%`); f.style.setProperty("--ly", `${30 - rx * 2}%`);
      f.style.setProperty("--fa", `${ry * 1.5}deg`); f.style.setProperty("--so", String(0.25 + Math.abs(s) * 0.6));
    };
    const tick = (now: number) => {
      if (!drag) {
        // 놓으면 가까운 면(앞/뒤)으로 스프링, 쉬는 동안 살짝 흔들림
        const idle = Math.sin((now - t0) / 900) * 7;
        vy *= 0.93; ry += vy;
        const target = Math.round(ry / 180) * 180;
        if (Math.abs(vy) < 1.5) { vy += (target + (target % 360 === 0 ? idle : -idle) - ry) * 0.05; vy *= 0.85; }
        rx += (Math.cos((now - t0) / 1300) * 4 - rx) * 0.05;
      }
      paint(); raf = requestAnimationFrame(tick);
    };
    const start = setTimeout(() => { raf = requestAnimationFrame(tick); }, 900); // 등장 움직임이 끝난 뒤
    const down = (e: PointerEvent) => { drag = true; lx = e.clientX; ly = e.clientY; vy = 0; box.setPointerCapture(e.pointerId); };
    const move = (e: PointerEvent) => {
      if (!drag) return;
      const dx = e.clientX - lx, dy = e.clientY - ly;
      ry += dx * 0.8; rx = Math.max(-25, Math.min(25, rx - dy * 0.5)); vy = dx * 0.8; lx = e.clientX; ly = e.clientY;
    };
    const up = () => { if (!drag) return; drag = false; vy = Math.max(-30, Math.min(30, vy)); navigator.vibrate?.(6); };
    box.addEventListener("pointerdown", down); box.addEventListener("pointermove", move);
    box.addEventListener("pointerup", up); box.addEventListener("pointercancel", up);
    return () => {
      clearTimeout(start); cancelAnimationFrame(raf);
      box.removeEventListener("pointerdown", down); box.removeEventListener("pointermove", move);
      box.removeEventListener("pointerup", up); box.removeEventListener("pointercancel", up);
    };
  }, []);

  const lore = cityLore(country, name);
  const cname = countryOf(country)?.name ?? "";
  return (
    <div ref={persp} className="hc-persp" aria-label="카드를 끌어서 돌려 볼 수 있어요">
      <div className="hc-enter">
        <div ref={card} className="hc-card">
          <div ref={front} className="hc-side hc-front">
            <div className="hc-inner">
              <div className="hc-name"><span className="truncate">{name}</span><small>{country.slice(0, 2)}{cname ? ` · ${cname}` : ""}</small></div>
              <div className="hc-win"><span aria-hidden className="hc-halo" /><span className="hc-art"><StampFace name={name} country={country} size={112} /></span></div>
              <div className="hc-nick">{lore?.nick ?? `${cname || name} 도장`}</div>
              <div className="hc-desc">{lore?.desc ?? `${name}에 직접 가서 꾹 눌러 받은 도장이에요`}</div>
              <div className="hc-foot"><span>KKUK</span>{no != null && <span>No.{String(no).padStart(3, "0")}</span>}</div>
            </div>
            <span aria-hidden className="hc-holo" /><span aria-hidden className="hc-glitter" /><span aria-hidden className="hc-stars" />
            <span aria-hidden className="hc-shine" />
          </div>
          <div className="hc-side hc-back">
            <span aria-hidden className="hc-wm" />
            <svg aria-hidden className="hc-emb" viewBox="0 0 86 86"><path d={EMB_OUT} fill="none" stroke="#FFF3E0" strokeWidth="2" /><path d={EMB_IN} fill="#FFF3E0" /></svg>
            <span aria-hidden className="hc-ring" />
            <span className="text-[10px] font-bold tracking-[0.3em] opacity-80">KKUK</span>
            <span className="max-w-[150px] truncate text-[22px] font-extrabold">{name}</span>
            {date && <span className="text-[11px] font-semibold tabular-nums opacity-90">{date}</span>}
            <span className="mt-1 text-[11px] font-semibold opacity-85">{visits}번 방문</span>
          </div>
        </div>
      </div>
    </div>
  );
}
