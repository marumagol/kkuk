"use client";
/*
  도장 탭 카드 (2026-11-17 마루님)
  - 아직 열지 않은 도장 : 누르면 여행으로 넘어가지 않고 받는 방법을 알려 주는 창
  - 모은 도장 : 누르면 홀로그램 카드로 크게 보여 주는 창 (0.94.0, 예전 메달). 주소 ?c=도시번호 로 바로 열 수도 있다
*/
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { StampFace } from "@/components/kit";
import { HoloCard } from "@/components/holo-card";
import { AlertDialog } from "@/components/gate";
import { flagWideOf, countryOf } from "@/lib/countries";
import { md } from "@/lib/mock";
import type { StampCard } from "@/lib/trips";

const dot = (d?: string) => (d ? d.slice(2).replaceAll("-", ".") : undefined);
const tiltOf = (name: string) => ([...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 17) - 8;

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

/* 모은 도장 칸 : 누르면 카드 창 */
export function EarnedStamp({ x, isNew, startOpen }: { x: StampCard; isNew: boolean; startOpen?: boolean }) {
  const [open, setOpen] = useState(!!startOpen);
  const close = () => {
    setOpen(false);
    if (location.search.includes("c=")) history.replaceState(history.state, "", "/stamps"); // ?c= 로 열린 창을 닫으면 주소도 정리
  };
  return (
    <>
      {/* 작은 홀로그램 카드 (0.94.1) : 금박 테두리 + 도시 이름 + 도장 + 받은 날. 누르면 큰 카드 */}
      <button type="button" onClick={() => setOpen(true)} aria-label={`${x.name} 도장, ${x.visits}번 방문`} className="press relative block w-full">
        <span className="mc">
          <span className="mc-in">
            <span className="mc-name">{x.name}</span>
            <span className="mc-win"><StampFace name={x.name} country={x.country} size={64} /></span>
            <span className="mc-foot"><span>KKUK</span><span>{dot(x.firstDate)}</span></span>
          </span>
          <span aria-hidden className="mc-holo" />
          <span aria-hidden className="mc-sweep" style={{ animationDelay: `${(tiltOf(x.name) + 8) * 0.3}s` }} />
        </span>
        {isNew && <span className="absolute -right-1 -top-1.5 z-[1] rounded-full bg-point px-1.5 py-0.5 text-[10px] font-extrabold leading-none text-white">NEW</span>}
      </button>
      {open && <StampMedal x={x} onClose={close} />}
    </>
  );
}

function StampMedal({ x, onClose }: { x: StampCard; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const back = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    addEventListener("keydown", esc);
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { removeEventListener("keydown", esc); document.body.style.overflow = prev; back?.focus?.(); };
  }, [onClose]);
  const flag = flagWideOf(x.country);
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6 backdrop-blur-[2px]" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={`${x.name} 도장`} onClick={(e) => e.stopPropagation()}
        className="relative flex w-full max-w-[340px] flex-col items-center overflow-hidden rounded-deep bg-deep px-5 pb-5 pt-8 text-center text-on-deep shadow-float">
        {/* 홀로그램 카드 (0.94.0) : 뒤로 퍼지는 빛 + 끌어서 돌려 보는 카드 */}
        <div aria-hidden className="pointer-events-none absolute left-1/2 top-[-70px] size-[380px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgb(255_90_54/0.42)_0%,rgb(255_90_54/0.1)_40%,transparent_68%)]" />
        <div className="relative flex flex-col items-center">
          <HoloCard name={x.name} country={x.country} no={x.cityId} date={dot(x.firstDate)} visits={x.visits} />
          <span className="relative -mt-3 rounded-full bg-point px-3 py-1 text-tiny font-extrabold text-white shadow-[0_4px_10px_rgb(0_0_0/0.25)]">
            {x.visits > 1 ? `${x.visits}번 방문` : "첫 방문"}
          </span>
        </div>
        <h2 className="relative mt-4 flex items-center justify-center gap-1.5 text-title-lg font-extrabold">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {flag && <img src={flag} alt="" width={27} height={18} className="rounded-[3px]" />}
          {x.name}
        </h2>
        <p className="relative mt-1 text-sub text-on-deep-sub">{countryOf(x.country)?.name ?? ""}{x.firstDate ? `, ${dot(x.firstDate)} 처음 받음` : ""}</p>
        {x.trips.length > 0 && (
          <ul className="relative mt-4 flex w-full flex-col gap-1.5 text-left">
            {x.trips.map((t) => (
              <li key={t.id}>
                <Link href={`/trips/${t.id}`} className="press flex min-h-11 items-center justify-between gap-2 rounded-field bg-deep-soft px-3 py-2 text-sub">
                  <span className="truncate font-semibold">{t.title}</span>
                  {t.verifiedBy && <span className="flex-none text-tiny text-on-deep-sub">{t.verifiedBy === "나" ? "내가 인증" : `${t.verifiedBy}님이 인증`}</span>}
                </Link>
              </li>
            ))}
          </ul>
        )}
        <button ref={closeRef} type="button" onClick={onClose} className="press relative mt-4 h-12 w-full rounded-btn bg-on-deep text-body font-bold text-deep">닫기</button>
      </div>
    </div>,
    document.body,
  );
}
