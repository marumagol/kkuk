"use client";
/*
  카드 뽑기 연출 (0.100.0, 2026-11-20 마루님 "뽑는 순간 보여 주기")
  여권 도장 연출 뒤 [카드 받기] → 뒤집힌 카드가 떨리며 빛이 모이고 → 휙 뒤집혀 이번에 나온 테마 카드가 보인다
  테마 색 빛이 카드 뒤로 번지고, "코랄 카드가 나왔어요" 글자가 올라온다
*/
import { useEffect, useState } from "react";
import { HoloCard } from "@/components/holo-card";
import { tierName, visitLabel, type Tier } from "@/lib/card-tier";

const GLOW: Partial<Record<Tier, string>> = {
  2: "255 190 90", 3: "200 130 240", 4: "70 210 160", 5: "110 200 255", 6: "255 170 230",
  7: "255 140 105", 8: "220 228 240", 10: "170 200 255", 11: "80 130 240", 12: "235 80 115",
};

export function CardDraw({ name, country, tier, visit = 1, date, onClose, freeze }: { name: string; country: string; tier: Tier; visit?: number; date?: string; onClose?: () => void; freeze?: "back" | "flip" | "shown" }) {
  const today = new Date();
  const d = date ?? `${String(today.getFullYear()).slice(2)}.${String(today.getMonth() + 1).padStart(2, "0")}.${String(today.getDate()).padStart(2, "0")}`;
  const [phase, setPhase] = useState<"back" | "flip" | "shown">(freeze ?? "back");
  useEffect(() => {
    if (freeze) return;
    const a = setTimeout(() => { setPhase("flip"); navigator.vibrate?.([0, 20, 30, 60]); }, 1400);
    const b = setTimeout(() => setPhase("shown"), 2100);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, [freeze]);
  return (
    <div className="cd-wrap" style={{ ["--cd-glow" as string]: GLOW[tier] ?? "255 255 255" }}>
      <div aria-hidden className={`cd-light ${phase !== "back" ? "on" : ""}`} />
      <div className={`cd-card ${phase}`}>
        <div className="cd-face cd-front"><HoloCard name={name} country={country} tier={tier} date={d} visit={visit} visits={visit} active={false} /></div>
        <div className="cd-face cd-backface" aria-hidden><span className="cd-ring" /><span className="cd-em">꾹</span><span className="cd-q">?</span></div>
      </div>
      <p className={`cd-text ${phase === "shown" ? "on" : ""}`}><b>{tierName(tier)}</b> 카드가 나왔어요</p>
      <p className={`cd-sub ${phase === "shown" ? "on" : ""}`}>{visit === 1 ? `${name}에서 처음 받은 카드예요` : `${name} ${visitLabel(visit)} 카드예요`}</p>
      {<button type="button" onClick={() => onClose?.()} className={`cd-ok press ${phase === "shown" ? "on" : ""}`}>확인</button>}
    </div>
  );
}
