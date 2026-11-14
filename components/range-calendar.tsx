"use client";
/*
  기간 고르기 달력 (여행 만들기 2/3)
  - 첫 번째 누름 : 시작 날짜, 두 번째 누름 : 끝 날짜 (시작보다 앞을 누르면 시작을 다시 고름)
  - 끝까지 고른 뒤 다시 누르면 처음부터
  날짜는 모두 "YYYY-MM-DD" 글자로 다룬다 (시간대 어긋남 방지)
*/
import { useState } from "react";
import { Icon } from "@/components/kit";
import { addDays, daysBetween } from "@/lib/mock";

const WD = ["일", "월", "화", "수", "목", "금", "토"];
const pad = (n: number) => String(n).padStart(2, "0");
const ym = (y: number, m: number) => `${y}-${pad(m + 1)}`;

export function RangeCalendar({ start, end, today, maxDays, onChange }: {
  start?: string; end?: string; today: string; maxDays: number;
  onChange: (start?: string, end?: string, error?: string) => void;
}) {
  const first = start ?? today;
  const [view, setView] = useState({ y: Number(first.slice(0, 4)), m: Number(first.slice(5, 7)) - 1 });
  const lead = new Date(Date.UTC(view.y, view.m, 1)).getUTCDay();
  const count = new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate();
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: count }, (_, i) => `${ym(view.y, view.m)}-${pad(i + 1)}`)];
  const move = (d: number) => setView(({ y, m }) => { const t = m + d; return { y: y + Math.floor(t / 12), m: ((t % 12) + 12) % 12 }; });

  const pick = (d: string) => {
    if (!start || end || d < start) return onChange(d, undefined);
    if (daysBetween(start, d) + 1 > maxDays) return onChange(start, undefined, `여행 기간은 ${maxDays}일까지 정할 수 있어요. ${addDays(start, maxDays - 1).slice(5).replace("-", ".")} 까지 고를 수 있어요`);
    onChange(start, d);
  };

  return (
    <div className="rounded-card bg-surface p-4">
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => move(-1)} aria-label="이전 달" className="press flex size-11 items-center justify-center rounded-full text-ink">
          <Icon name="back" size={20} />
        </button>
        <h3 className="text-title font-bold text-ink" aria-live="polite">{view.y}년 {view.m + 1}월</h3>
        <button type="button" onClick={() => move(1)} aria-label="다음 달" className="press flex size-11 items-center justify-center rounded-full text-ink">
          <Icon name="right" size={20} />
        </button>
      </div>
      <div className="mt-2 grid grid-cols-7 text-center text-tiny font-semibold text-ink-sub" aria-hidden="true">
        {WD.map((w) => <span key={w} className="py-1">{w}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((d, i) => {
          if (!d) return <span key={`e${i}`} />;
          const edge = d === start || d === end;
          const inside = !!(start && end && d > start && d < end);
          const wd = (lead + Number(d.slice(8)) - 1) % 7;
          return (
            <span key={d} className={"flex justify-center " + (inside || (edge && start && end && start !== end) ? (d === start ? "bg-gradient-to-r from-transparent from-50% to-point-soft to-50%" : d === end ? "bg-gradient-to-l from-transparent from-50% to-point-soft to-50%" : "bg-point-soft") : "")}>
              <button type="button" onClick={() => pick(d)} aria-pressed={edge || inside}
                aria-label={`${Number(d.slice(5, 7))}월 ${Number(d.slice(8))}일 ${WD[wd]}요일${d === start ? ", 시작" : d === end ? ", 끝" : ""}${d === today ? ", 오늘" : ""}`}
                className={"press flex size-11 items-center justify-center rounded-full text-body " +
                  (edge ? "bg-btn font-bold text-on-btn" : inside ? "font-semibold text-ink" : d === today ? "font-bold text-point-text" : wd === 0 ? "text-point-text" : "text-ink")}>
                {Number(d.slice(8))}
              </button>
            </span>
          );
        })}
      </div>
    </div>
  );
}
