"use client";
/* 일정 공유 폼 : 기본은 여행 전체 링크, 일부 날짜만은 안쪽에 접어 둠 (0018). 만든 링크는 복사, 보내기, 끊기 */
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/kit";
import { makeDayShare, revokeDayShare } from "@/app/actions";
import { safeCall } from "@/lib/safe-call";
import type { DayShare } from "@/lib/trips";

type Day = { index: number; label: string; sub: string; count: number };
const daysText = (ds: number[] | null) => (ds ? ds.map((d) => `${d + 1}일차`).join(", ") : "여행 전체");

export function DayShareForm({ tripId, days, shares }: { tripId: string; days: Day[]; shares: DayShare[] }) {
  const [picked, setPicked] = useState<number[]>([]);
  const [list, setList] = useState(shares);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [busy, start] = useTransition();
  const [canShare, setCanShare] = useState(false);
  const [partOpen, setPartOpen] = useState(false);
  useEffect(() => setCanShare(typeof navigator.share === "function"), []);
  useEffect(() => setList(shares), [shares]);

  const urlOf = (t: string) => `${window.location.origin}/s/${t}`;
  const copy = async (t: string) => {
    try { await navigator.clipboard.writeText(urlOf(t)); setMsg("링크를 복사했어요"); }
    catch { setMsg("복사하지 못했어요. 링크를 길게 눌러 복사해 주세요"); }
  };
  const send = async (t: string) => {
    try { await navigator.share({ title: "트립추얼 일정", url: urlOf(t) }); }
    catch (e) { if ((e as Error)?.name !== "AbortError") await copy(t); }
  };
  const make = (ds: number[] | null) => start(async () => {
    setError(""); setMsg("");
    const r = await safeCall(() => makeDayShare(tripId, ds));
    if ("error" in r && r.error) return setError(r.error);
    if ("token" in r && r.token) { setList((l) => [{ token: r.token!, days: ds, createdAt: new Date().toISOString() }, ...l]); setPicked([]); await copy(r.token); }
  });
  const toggle = (i: number) => setPicked((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i].sort((a, b) => a - b)));

  return (
    <div className="flex flex-col gap-5 px-5 pb-10 pt-4">
      <section className="flex flex-col gap-3 rounded-card bg-surface p-4" aria-labelledby="whole-title">
        <h2 id="whole-title" className="text-body font-bold text-ink">여행 일정 공유</h2>
        <p className="text-tiny text-ink-sub">링크를 받은 사람은 로그인 없이 장소 이름, 시간, 주소만 볼 수 있어요. 메모, 비용, 사진, 함께하는 사람은 보이지 않아요. 여행 기간이 바뀌어도 링크는 그대로 따라가요</p>
        {error && <p role="alert" className="text-sub font-semibold text-point-text">{error}</p>}
        <Button full disabled={busy} onClick={() => make(null)}>여행 전체 링크 만들기</Button>
        <button type="button" aria-expanded={partOpen} onClick={() => setPartOpen((o) => !o)}
          className="press flex min-h-11 items-center justify-center text-sub font-semibold text-ink-sub">
          {partOpen ? "일부 날짜만 공유 닫기" : "일부 날짜만 공유하기"}
        </button>
        {partOpen && (
          <>
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
            <Button full variant="secondary" disabled={busy || !picked.length} onClick={() => make(picked)}>
              {picked.length ? `${daysText(picked)} 링크 만들기` : "날을 골라 주세요"}
            </Button>
          </>
        )}
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
                    setError(""); setMsg("");
                    const r = await safeCall(() => revokeDayShare(tripId, s.token));
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
