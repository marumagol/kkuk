"use client";
/*
  카드 뽑기 연출 (0.100.1, 2026-11-20 마루님 "카드 봉지 속에서 보이지 않게 광원 이펙트 주면서 싹 나오게")
  pack  0~1.3초 : 봉지가 툭 내려와 떨린다. 뜯는 선이 테마 색으로 빛난다
  tear  1.3초   : 윗부분이 날아가고 틈으로 빛이 새어 나온다
  rise  1.9초   : 빛에 덮인 카드가 쑥 올라오며 빛이 걷힌다 (나오기 전에는 어떤 카드인지 안 보임)
  shown 3.1초   : 봉지는 아래로 빠지고 카드가 자리 잡은 뒤 글자가 올라온다
  모양은 app/globals.css 의 cd-*. 동작 줄이기 설정이면 바로 결과만
*/
import { useEffect, useState } from "react";
import { HoloCard } from "@/components/holo-card";
import { tierName, visitLabel, type Tier } from "@/lib/card-tier";

export const GLOW: Partial<Record<Tier, string>> = {
  2: "255 190 90", 3: "200 130 240", 4: "70 210 160", 5: "110 200 255", 6: "255 170 230",
  7: "255 140 105", 8: "220 228 240", 10: "170 200 255", 11: "80 130 240", 12: "235 80 115",
};
type Phase = "pack" | "tear" | "rise" | "shown";
const AT: [Phase, number][] = [["tear", 1300], ["rise", 1900], ["shown", 3100]];

export function CardDraw({ name, country, tier, visit = 1, date, onClose, freeze }: { name: string; country: string; tier: Tier; visit?: number; date?: string; onClose?: () => void; freeze?: Phase }) {
  const today = new Date();
  const d = date ?? `${String(today.getFullYear()).slice(2)}.${String(today.getMonth() + 1).padStart(2, "0")}.${String(today.getDate()).padStart(2, "0")}`;
  const [phase, setPhase] = useState<Phase>(freeze ?? "pack");
  useEffect(() => {
    if (freeze) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { setPhase("shown"); return; }
    const ts = AT.map(([p, ms]) => setTimeout(() => {
      setPhase(p);
      if (p === "tear") navigator.vibrate?.(25);
      if (p === "rise") navigator.vibrate?.([0, 15, 40, 60]);
    }, ms));
    return () => ts.forEach(clearTimeout);
  }, [freeze]);
  return (
    <div className={`cd-wrap ${phase}`} style={{ ["--cd-glow" as string]: GLOW[tier] ?? "255 255 255" }}>
      <div aria-hidden className="cd-light" />
      <div className="cd-stage">
        <div className="cd-slot">
          <HoloCard name={name} country={country} tier={tier} date={d} visit={visit} visits={visit} active={false} />
          <span aria-hidden className="cd-flash" />
        </div>
        <div className="cd-pack" aria-hidden>
          <div className="cd-body"><span className="cd-em">꾹</span><span className="cd-lab">TRAVEL CARD</span></div>
          <div className="cd-strip" />
          <div className="cd-cut" />
        </div>
        <span aria-hidden className="cd-leak" />
      </div>
      <p className="cd-text" aria-live="polite">{phase === "shown" && <><b>{tierName(tier)}</b> 카드가 나왔어요</>}</p>
      <p className="cd-sub">{visit === 1 ? `${name}에서 처음 받은 카드예요` : `${name} ${visitLabel(visit)} 카드예요`}</p>
      <button type="button" onClick={() => onClose?.()} className="cd-ok press" tabIndex={phase === "shown" ? 0 : -1}>확인</button>
    </div>
  );
}
