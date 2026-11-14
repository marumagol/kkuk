"use client";
/* 일부 일정 공유 폼 (4단계 7) : 일차 고르기 → 링크 만들기. 만든 링크는 복사, 보내기, 끊기 */
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/kit";
import { makeDayShare, revokeDayShare } from "@/app/actions";
import type { DayShare } from "@/lib/trips";

type Day = { index: number; label: string; sub: string; count: number };
const daysText = (ds: number[]) => ds.map((d) => `${d + 1}일차`).join(", ");

export function DayShareForm({ tripId, days, shares }: { tripId: string; days: Day[]; shares: DayShare[] }) {
  const [picked, setPicked] = useState<number[]>([]);
  const [list, setList] = useState(shares);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [busy, start] = useTransition();
  const [canShare, setCanShare] = useState(false);
  useEffect(() => setCanShare(typeof navigator.share === "function"), []);
  useEffect(() => setList(shares), [shares]);

  const urlOf = (t: string) => `${window.location.origin}/s/${t}`;
  const copy = async (t: string) => {
    try { await navigator.clipboard.writeText(urlOf(t)); setMsg("링크를 복사했어요"); }
    catch { setMsg("복사하지 못했어요. 링크를 길게 눌러 복사해 주세요"); }
  };
  const send = async (t: string) => {
    try { await navigator.share({ title: "KKuK 일정", url: urlOf(t) }); }
    catch (e) { if ((e as Error)?.name !== "AbortError") await copy(t); }
  };
  const toggle = (i: number) => setPicked((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i].sort((a, b) => a - b)));

  return (
    <div className="flex flex-col gap-5 px-5 pb-10 pt-4">
      <section className="flex flex-col gap-3 rounded-card bg-surface p-4" aria-labelledby="pick-title">
        <h2 id="pick-title" className="text-body font-bold text-ink">공유할 날 고르기</h2>
        <p className="text-tiny text-ink-sub">링크를 받은 사람은 로그인 없이 고른 날의 장소 이름, 시간, 주소만 볼 수 있어요. 메모, 비용, 사진, 함께하는 사람은 보이지 않아요</p>
        <ul className="grid grid-cols-2 gap-2">
          {days.map((d) => {
            const on = picked.includes(d.index);
            return (
              <li key={d.index}>
                <button type="button" aria-pressed={on} onClick={() => toggle(d.index)}
                  className={`press flex min-h-14 w-full flex-col items-start justify-center rounded-field px-3 py-2 text-left ${on ? "bg-btn text-on-btn" : "bg-bg text-ink"}`}>
                  <span className="text-sub font-bold">{d.label}</span>
                  <span className={`text-tiny ${on ? "" : "text-ink-sub"}`}>{d.sub} · 장소 {d.count}개</span>
                </button>
              </li>
            );
          })}
        </ul>
        {error && <p role="alert" className="text-sub font-semibold text-point-text">{error}</p>}
        <Button full disabled={busy || !picked.length} onClick={() => start(async () => {
          setError(""); setMsg("");
          const r = await makeDayShare(tripId, picked);
          if (r.error) return setError(r.error);
          if (r.token) { setList((l) => [{ token: r.token!, days: picked, createdAt: new Date().toISOString() }, ...l]); setPicked([]); await copy(r.token); }
        })}>{picked.length ? `${daysText(picked)} 링크 만들기` : "날을 골라 주세요"}</Button>
      </section>

      {msg && <p role="status" className="text-center text-tiny font-semibold text-ink-sub">{msg}</p>}

      {list.length > 0 && (
        <section className="flex flex-col gap-2" aria-labelledby="links-title">
          <h2 id="links-title" className="text-body font-bold text-ink">공유 중인 링크</h2>
          <ul className="flex flex-col gap-2">
            {list.map((s) => (
              <li key={s.token} className="flex flex-col gap-2 rounded-card bg-surface p-3">
                <span className="text-sub font-semibold text-ink">{daysText(s.days)}</span>
                <div className="flex gap-2">
                  {canShare && <Button size="md" onClick={() => send(s.token)} disabled={busy}>보내기</Button>}
                  <Button size="md" variant="secondary" onClick={() => copy(s.token)} disabled={busy}>복사</Button>
                  <Button size="md" variant="ghost" disabled={busy} onClick={() => start(async () => {
                    const r = await revokeDayShare(tripId, s.token);
                    if (r.error) return setError(r.error);
                    setList((l) => l.filter((x) => x.token !== s.token)); setMsg("링크를 끊었어요. 이제 그 링크로는 볼 수 없어요");
                  })}>끊기</Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
