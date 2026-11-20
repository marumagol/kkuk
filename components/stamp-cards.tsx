"use client";
/*
  도장 탭 카드 (2026-11-17 마루님)
  - 아직 열지 않은 도장 : 누르면 여행으로 넘어가지 않고 받는 방법을 알려 주는 창
  - 모은 도장 : 가장 높은 등급 카드 한 장. 누르면 등급별 카드를 넘겨 보는 창 (0.95.0). 주소 ?c=도시번호 로 바로 열 수도 있다
*/
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { StampFace } from "@/components/kit";
import { HoloCard, Twinkles } from "@/components/holo-card";
import { cardsOf, isWinter, finishOf, lookOf, tierName, visitLabel, type Look } from "@/lib/card-tier";

const GLOW: Record<Look, string> = {
  4: "bg-[radial-gradient(circle,rgb(60_200_150/0.42)_0%,rgb(60_200_150/0.1)_40%,transparent_68%)]",
  2: "bg-[radial-gradient(circle,rgb(255_170_60/0.42)_0%,rgb(255_170_60/0.1)_40%,transparent_68%)]",
  3: "bg-[radial-gradient(circle,rgb(210_130_230/0.45)_0%,rgb(210_130_230/0.1)_40%,transparent_68%)]",
  w: "bg-[radial-gradient(circle,rgb(190_225_255/0.55)_0%,rgb(190_225_255/0.14)_40%,transparent_68%)]",
  5: "bg-[radial-gradient(circle,rgb(110_200_255/0.55)_0%,rgb(110_200_255/0.14)_40%,transparent_68%)]",
  6: "bg-[radial-gradient(circle,rgb(255_180_230/0.45)_0%,rgb(160_210_255/0.18)_40%,transparent_68%)]",
};
import { AlertDialog } from "@/components/gate";
import { flagWideOf, countryOf } from "@/lib/countries";
import { md } from "@/lib/mock";
import type { StampCard } from "@/lib/trips";

const dot = (d?: string) => (d ? d.slice(2, 10).replaceAll("-", ".") : undefined); // 시각이 붙은 값(2026-11-19T07:07:22)도 날짜만

/* 봉인 도장을 눌렀을 때 안내 */
export function SealedButton({ x, tone, label, children }: { x: StampCard; tone: "now" | "soon" | "past"; label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const n = x.next;
  const desc = tone === "now"
    ? `여행 중에 ${x.name}에 도착하면, 여행 화면의 [도장 받기]를 눌러 주세요`
    : tone === "soon" && n
      ? `${md(n.start)}부터 ${x.name}에 가면 받을 수 있어요. 여행지에 도착해서 여행 화면의 [도장 받기]를 눌러 주세요`
      : `${x.name}에 가는 여행을 다시 떠나면 받을 수 있어요. 여행지에서 [도장 받기]를 눌러 주세요`;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label={`${x.name} 도장, ${label}`} className="press block h-full w-full text-left">{children}</button>
      {open && <AlertDialog title={tone === "now" ? `지금 ${x.name} 도장을 받을 수 있어요` : `${x.name} 도장은 아직 열리지 않았어요`} desc={desc} onClose={() => setOpen(false)} />}
    </>
  );
}

/* 카드들 : 받은 시각이 없으면(미리보기 등) 처음 받은 날 하나로 */
const cardsFor = (x: StampCard) => cardsOf(x.dates?.length ? x.dates : Array.from({ length: x.visits }, () => x.firstAt ?? x.firstDate ?? ""));

/* 모은 도장 칸 : 그 도시에서 모은 가장 높은 등급 카드 한 장 (0.95.0). 누르면 카드 창 */
export function EarnedStamp({ x, isNew, startOpen }: { x: StampCard; isNew: boolean; startOpen?: boolean }) {
  const [open, setOpen] = useState(!!startOpen);
  const close = () => {
    setOpen(false);
    if (location.search.includes("c=")) history.replaceState(history.state, "", "/stamps"); // ?c= 로 열린 창을 닫으면 주소도 정리
  };
  const cards = cardsFor(x);
  const top = cards[cards.length - 1];
  const flag = flagWideOf(x.country);
  const win = isWinter(x.country, x.name);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label={`${x.name} 도장, ${tierName(top.tier, win)} 카드, ${x.visits}번 방문`} className="press relative block w-full">
        <span className={`mc mc-t${lookOf(top.tier, x.country, x.name)}`}>
          <span className="mc-in">
            <span className="mc-name"><span>{x.name}</span>{flag && <img src={flag} alt="" width={18} height={12} className="mc-flag" />}</span>
            <span className="mc-win"><span aria-hidden className="hc-halo" /><StampFace name={x.name} country={x.country} size={64} finish={finishOf(lookOf(top.tier, x.country, x.name))} /><span aria-hidden className="mc-holo" /><span aria-hidden className="mc-glitter" /><span aria-hidden className="mc-stars" />{top.tier >= 3 && <Twinkles o={10} />}</span>
            <span className="mc-foot"><span className="mc-pill">{tierName(top.tier, win)}</span><span>{dot(top.at)}</span></span>
          </span>
        </span>
        {isNew && <span className="absolute -right-1 -top-1.5 z-[1] rounded-full bg-point px-1.5 py-0.5 text-[10px] font-extrabold leading-none text-white">NEW</span>}
      </button>
      {open && <StampMedal x={x} onClose={close} />}
    </>
  );
}

/* 카드 창 : 모은 등급 카드를 옆으로 넘겨 본다. 처음엔 가장 높은 등급. 아래 등급 탭으로도 이동 (못 모은 등급은 보여 주지 않음) */
function StampMedal({ x, onClose }: { x: StampCard; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const cards = cardsFor(x);
  const [cur, setCur] = useState(cards.length - 1);
  useEffect(() => {
    const back = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    addEventListener("keydown", esc);
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { removeEventListener("keydown", esc); document.body.style.overflow = prev; back?.focus?.(); };
  }, [onClose]);
  const center = (i: number, smooth: boolean) => {
    const tr = track.current, el = tr?.children[i] as HTMLElement | undefined;
    if (tr && el) tr.scrollTo({ left: el.offsetLeft - (tr.clientWidth - el.clientWidth) / 2, behavior: smooth ? "smooth" : "instant" });
  };
  useEffect(() => { center(cards.length - 1, false); }, [cards.length]);
  const onScroll = () => {
    const tr = track.current; if (!tr) return;
    const mid = tr.scrollLeft + tr.clientWidth / 2;
    let best = 0, bd = Infinity;
    [...tr.children].forEach((k, i) => { const el = k as HTMLElement; const d = Math.abs(el.offsetLeft + el.clientWidth / 2 - mid); if (d < bd) { bd = d; best = i; } });
    if (best !== cur) { setCur(best); navigator.vibrate?.(4); }
  };
  const c = cards[cur] ?? cards[0];
  const flag = flagWideOf(x.country);
  /* 0.95.5 마지막 등급(0.96.0 부터 레전드) 뒤로도 방문하면 카드는 그대로, 상세 줄의 방문 횟수와 날짜만 올라간다 (마루님) */
  const last = c.tier === 6 && x.visits > c.visit;
  const lastDate = x.dates?.at(-1) ?? c.at;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6 backdrop-blur-[2px]" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={`${x.name} 도장 카드`} onClick={(e) => e.stopPropagation()}
        className="relative flex w-full max-w-[340px] flex-col items-center overflow-hidden rounded-deep bg-deep px-5 pb-5 pt-6 text-center text-on-deep shadow-float">
        <div aria-hidden className={`pointer-events-none absolute left-1/2 top-[-70px] size-[380px] -translate-x-1/2 rounded-full transition-[background] duration-300 ${GLOW[lookOf(c.tier, x.country, x.name)]}`} />
        {/* 여백 % 는 바깥 상자(트랙보다 40px 좁음) 기준이라 카드 반폭 93 - 20 = 73 */}
        <div ref={track} onScroll={onScroll} className="relative -mx-5 flex w-[calc(100%+40px)] snap-x snap-mandatory -my-6 gap-4 overflow-x-auto px-[calc(50%-73px)] pb-10 pt-8 [scrollbar-width:none]">
          {cards.map((k, i) => (
            <div key={k.tier} onClick={i === cur ? undefined : () => center(i, true)} className={`flex-none snap-center transition-[transform,opacity] duration-300 ${i === cur ? "" : "scale-90 opacity-50"}`}>
              <HoloCard name={x.name} country={x.country} tier={k.tier} date={dot(k.at)} visit={k.visit} visits={x.visits} trip={x.trips[k.visit - 1]?.title} active={i === cur} />
            </div>
          ))}
        </div>
        {/* 등급 탭 : 모은 카드만 (0.95.0, 못 모은 등급은 보이지 않음). 한 장뿐이면 탭 없음 */}
        {cards.length > 1 && (
          <div className="relative flex gap-1.5" role="tablist" aria-label="카드 등급">
            {cards.map((k, i) => (
              <button key={k.tier} type="button" role="tab" aria-selected={i === cur} onClick={() => center(i, true)}
                className={`press inline-flex h-7 items-center rounded-full px-2.5 text-tiny font-extrabold ${i === cur ? "bg-on-deep text-deep" : "bg-deep-soft text-on-deep-sub"}`}>
                {k.name}
              </button>
            ))}
          </div>
        )}
        <h2 className="relative mt-4 flex items-center justify-center gap-1.5 text-title-lg font-extrabold">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {flag && <img src={flag} alt="" width={27} height={18} className="rounded-[3px]" />}
          {x.name}
        </h2>
        <p className="relative mt-1 text-sub text-on-deep-sub">{countryOf(x.country)?.name ?? ""}{c.at ? ` · ${dot(last ? lastDate : c.at)} ${visitLabel(last ? x.visits : c.visit)}` : ""}</p>
        <button ref={closeRef} type="button" onClick={onClose} className="press relative mt-4 h-12 w-full rounded-btn bg-on-deep text-body font-bold text-deep">닫기</button>
      </div>
    </div>,
    document.body,
  );
}
