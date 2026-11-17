"use client";
/*
  도장 테스트 (2026-11-18 마루님 계정만 보임) : 위치 확인 없이 도시를 골라 도장 받기, 테스트로 받은 도장 지우기
  보이는지는 서버에서 am_stamp_tester 로 정하고, 받기·지우기도 DB 함수가 다시 검사한다
*/
import { useState, useTransition } from "react";
import { StampFace } from "@/components/kit";
import { testStamp, clearTestStamps, type ClaimResult } from "@/app/actions";
import { POPULAR_CITIES, countryNameOf } from "@/lib/countries";
import { safeCall } from "@/lib/safe-call";
import { HoldButton } from "@/components/hold-button";
import { StampReveal } from "@/components/stamp-reveal";

const OPTIONS = Object.entries(POPULAR_CITIES).flatMap(([code, list]) => list.map((name) => ({ code: code.slice(0, 2), name, key: `${code.slice(0, 2)}:${name}`, group: countryNameOf(code) ?? code })));

export function StampTester() {
  const [pick, setPick] = useState(OPTIONS.find((o) => o.key === "JP:삿포로")?.key ?? OPTIONS[0].key);
  const [res, setRes] = useState<Extract<ClaimResult, { ok: true }> | null>(null);
  const [msg, setMsg] = useState("");
  const [reveal, setReveal] = useState<{ code: string; name: string; sub: string } | null>(null);
  const [pending, start] = useTransition();
  const groups = [...new Set(OPTIONS.map((o) => o.group))];

  /* 고른 도시를 알고 있으니 서버 답을 기다리지 않고 바로 등장시킨다. 실패하면 닫고 알려 준다 */
  const take = () => {
    const o = OPTIONS.find((x) => x.key === pick)!;
    setReveal({ code: o.code, name: o.name, sub: `${o.name} 테스트 도장을 받았어요` });
    start(async () => {
      const r = await safeCall(() => testStamp(o.code, o.name));
      if (!("ok" in r) || !r.ok) { setReveal(null); setRes(null); setMsg(r.error); return; }
      setRes(r);
      const text = r.status === "already" ? `${r.city} 도장은 이미 있어요` : `${r.city} 테스트 도장을 받았어요${r.visits > 1 ? ` (${r.visits}번째)` : ""}`;
      setMsg(text);
      setReveal((v) => v && { ...v, sub: text });
    });
  };
  const clear = () => start(async () => {
    const r = await safeCall(() => clearTestStamps());
    setRes(null);
    setMsg("error" in r && r.error ? r.error : `테스트 도장 ${(r as { removed?: number }).removed ?? 0}개를 지웠어요`);
  });

  return (
    <section aria-label="도장 테스트" className="flex flex-col gap-3 rounded-card border-2 border-dashed border-point/50 bg-surface px-4 py-4">
      <div>
        <h2 className="text-body font-bold text-ink">도장 테스트 <span className="ml-1 rounded-full bg-point-soft px-2 py-0.5 text-[11px] font-bold text-point-text">내 계정만</span></h2>
        <p className="mt-0.5 text-tiny text-ink-sub">위치 확인 없이 도시를 골라 실제처럼 꾹 눌러 받아 봐요. 나만 받고, 아래 버튼으로 테스트로 받은 것만 지워요</p>
      </div>
      {reveal && <StampReveal city={reveal.name} country={reveal.code} title="도장 꾹!" sub={reveal.sub} onClose={() => setReveal(null)} />}
      {res && (
        <div className="flex justify-center py-1">
          <div key={res.city + res.visits} className={res.status === "already" ? "-rotate-6" : "stamp-hit"}><StampFace name={res.city} country={res.country} size={110} /></div>
        </div>
      )}
      <select value={pick} onChange={(e) => setPick(e.target.value)} aria-label="테스트할 도시" disabled={pending}
        className="h-12 rounded-field border border-line-strong bg-surface px-3 text-sub text-ink">
        {groups.map((g) => (
          <optgroup key={g} label={g}>
            {OPTIONS.filter((o) => o.group === g).map((o) => <option key={o.key} value={o.key}>{o.name}</option>)}
          </optgroup>
        ))}
      </select>
      {msg && <p role="status" className="text-sub text-ink">{msg}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={clear} disabled={pending}
          className="press h-12 flex-1 rounded-btn border border-line-strong bg-surface text-sub font-bold text-ink disabled:opacity-50">테스트 도장 지우기</button>
        <HoldButton onComplete={take} onShort={() => setMsg("조금 더 꾹 눌러 주세요. 게이지가 다 차면 도장이 찍혀요")} disabled={pending}
          className="h-12 flex-1 text-sub" label="꾹 눌러 받아 보기" />
      </div>
    </section>
  );
}
