"use client";
/*
  환율 수정 창 (2026-11-17) : 1 외화 = 몇 원. 여행에 저장해서 함께하는 사람 모두 같은 환율을 쓴다 (0040 trip_fx)
  [기본 환율로 되돌리기] 는 정한 값을 지워 그날 받아 온 환율로
*/
import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Button, Field } from "@/components/kit";
import { saveFxRate } from "@/app/actions";
import { safeCall } from "@/lib/safe-call";
import { curName } from "@/lib/countries";

export const rateText = (v: number) => (v < 10 ? v.toFixed(2) : Math.round(v * 100) / 100 >= 100 ? Math.round(v).toLocaleString("ko-KR") : String(Math.round(v * 100) / 100));

export function RateDialog({ tripId, cur, current, auto, custom, canEdit, onClose }: {
  tripId: string; cur: string; current: number | null; auto: number | null; custom: boolean; canEdit: boolean; onClose: () => void;
}) {
  const router = useRouter();
  const [text, setText] = useState(current ? String(current < 10 ? Number(current.toFixed(4)) : Math.round(current * 100) / 100) : "");
  const [err, setErr] = useState("");
  const [busy, start] = useTransition();
  const save = (v: number | null) => start(async () => {
    const r = await safeCall(() => saveFxRate(tripId, cur, v));
    if (r?.error) return setErr(r.error);
    router.refresh(); onClose();
  });
  const submit = () => {
    const v = Number(text.replace(/,/g, ""));
    if (!(v > 0) || v > 1_000_000) return setErr("0보다 큰 숫자로 적어 주세요");
    save(v);
  };
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="rate-title" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.key === "Escape" && onClose()}
        className="w-full max-w-[420px] rounded-t-[24px] bg-surface px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-5 sm:rounded-[24px]">
        <h2 id="rate-title" className="text-title font-extrabold text-ink">{curName(cur)} 환율 수정</h2>
        <p className="mt-1 text-sub text-ink-sub">환전한 환율로 맞추면 원화 금액과 정산이 더 정확해져요. 함께하는 사람 모두 이 환율로 봐요</p>
        <form className="mt-4 flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); if (canEdit) submit(); }}>
          <Field label={`1 ${cur} = 원`} name="rate" inputMode="decimal" autoFocus={canEdit} value={text} placeholder="예 : 9.12" disabled={!canEdit || busy}
            onChange={(e) => { setText(e.target.value.replace(/[^\d.,]/g, "")); setErr(""); }}
            hint={auto ? `오늘 받아 온 환율 : 1 ${cur} = ${rateText(auto)}원` : "오늘 환율을 받아 오지 못했어요"} error={err || undefined} />
          {canEdit ? <Button type="submit" full disabled={!text || busy}>{busy ? "저장하는 중" : "저장"}</Button>
            : <p className="text-tiny text-ink-sub">보기만 권한이라 환율을 바꿀 수 없어요</p>}
          <div className="flex justify-between">
            {canEdit && custom && auto ? <button type="button" disabled={busy} onClick={() => save(null)} className="press h-10 px-1 text-sub font-semibold text-ink-sub underline underline-offset-2">기본 환율로 되돌리기</button> : <span />}
            <button type="button" onClick={onClose} className="press h-10 px-2 text-sub font-semibold text-ink-sub">닫기</button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}

/*
  정산의 [환율 수정] (2026-11-17 마루님 "입력된 전체 환율이 하나의 창에") : 통화마다 한 칸. 예산 카드와 같은 여행 환율(trip_fx)을 고친다.
  바뀐 칸만 저장하고, 비운 칸은 직접 정한 값을 지워 오늘 환율로
*/
export function RatesDialog({ tripId, curs, rates, canEdit, onClose }: {
  tripId: string; curs: string[]; rates: Record<string, { krw: number; auto?: number | null; custom?: boolean } | undefined>; canEdit: boolean; onClose: () => void;
}) {
  const router = useRouter();
  const init = (c: string) => { const v = rates[c]?.krw; return v ? String(v < 10 ? Number(v.toFixed(4)) : Math.round(v * 100) / 100) : ""; };
  const [vals, setVals] = useState<Record<string, string>>(() => Object.fromEntries(curs.map((c) => [c, init(c)])));
  const [err, setErr] = useState("");
  const [busy, start] = useTransition();
  const save = () => start(async () => {
    setErr("");
    for (const c of curs) {
      const t = (vals[c] ?? "").replace(/,/g, "").trim();
      if (t === init(c)) continue;
      if (!t) { if (rates[c]?.custom) { const r = await safeCall(() => saveFxRate(tripId, c, null)); if (r?.error) return setErr(r.error); } continue; }
      const v = Number(t);
      if (!(v > 0) || v > 1_000_000) return setErr(`${curName(c)} 환율을 0보다 큰 숫자로 적어 주세요`);
      const r = await safeCall(() => saveFxRate(tripId, c, v));
      if (r?.error) return setErr(r.error);
    }
    router.refresh(); onClose();
  });
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="rates-title" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.key === "Escape" && onClose()}
        className="flex max-h-[85dvh] w-full max-w-[420px] flex-col rounded-t-[24px] bg-surface px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-5 sm:rounded-[24px]">
        <h2 id="rates-title" className="text-title font-extrabold text-ink">환율 수정</h2>
        <p className="mt-1 text-sub text-ink-sub">예산 카드와 같은 환율이에요. 여기서 바꾸면 예산과 정산 모두 이 환율로 계산해요</p>
        <form className="mt-4 flex min-h-0 flex-col gap-3" onSubmit={(e) => { e.preventDefault(); if (canEdit) save(); }}>
          <div className="-mx-1 flex min-h-0 flex-col gap-3 overflow-y-auto px-1">
            {curs.map((c) => {
              const r = rates[c];
              return (
                <Field key={c} label={`1 ${c} (${curName(c)}) = 원`} name={`rate-${c}`} inputMode="decimal" value={vals[c] ?? ""} placeholder={r?.auto ? rateText(r.auto) : "예 : 9.12"} disabled={!canEdit || busy}
                  onChange={(e) => { const v = e.target.value.replace(/[^\d.,]/g, ""); setVals((m) => ({ ...m, [c]: v })); setErr(""); }}
                  hint={r?.auto ? `오늘 환율 ${rateText(r.auto)}원${r.custom ? ", 지금은 직접 정한 값이에요. 비우면 오늘 환율로" : ""}` : "오늘 환율을 받아 오지 못했어요"} />
              );
            })}
          </div>
          {err && <p role="alert" className="text-sub font-semibold text-point-text">{err}</p>}
          {canEdit ? <Button type="submit" full disabled={busy}>{busy ? "저장하는 중" : "저장"}</Button>
            : <p className="text-tiny text-ink-sub">보기만 권한이라 환율을 바꿀 수 없어요</p>}
          <button type="button" onClick={onClose} className="press h-10 self-end px-2 text-sub font-semibold text-ink-sub">닫기</button>
        </form>
      </div>
    </div>,
    document.body,
  );
}
