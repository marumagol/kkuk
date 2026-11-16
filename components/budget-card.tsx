"use client";
/*
  경비 탭 예산 카드 (2026-11-17 마루님 "총예산 원화 + 통화별, 한번에 가자", "보기 좋게 정리")
  - 맨 위 : 총예산(원화) 중 얼마 남았는지 크게, 쓴 비율 막대. 예산이 없으면 쓴 돈만
  - 통화별로 쓴 돈 : 외화가 있을 때만. 통화별 예산(미리 환전한 돈)을 적었으면 "○ 남음" 과 작은 막대
  - 아래 : 일정에 적은 예상 경비, 환율 기준과 [수정]. 계산은 lib/budget.ts
*/
import { useState, useTransition } from "react";
import { Button, Field, Icon } from "@/components/kit";
import { RateDialog, rateText } from "@/components/rate-dialog";
import { saveBudgetPlan } from "@/app/actions";
import { safeCall } from "@/lib/safe-call";
import { budgetSummary } from "@/lib/budget";
import { curName, decimalsOf, formatMoney } from "@/lib/countries";
import type { ExpensesView } from "@/lib/trips";

export const won = (n: number) => `${Math.round(n).toLocaleString("ko-KR")}원`;
const OVER = "#FF8466", OK = "#6FD3A8";

export function BudgetCard({ view, Sheet }: { view: ExpensesView; Sheet: (p: { title: string; onClose: () => void; children: React.ReactNode }) => React.ReactNode }) {
  const canEdit = view.role !== "viewer";
  const s = budgetSummary({ expenses: view.expenses, planned: view.planned, budget: view.budget, cash: view.cash, rates: view.rates, decimals: decimalsOf });
  const [editing, setEditing] = useState(false);
  const [rateCur, setRateCur] = useState<string | null>(null);
  const over = s.remain != null && s.remain < 0;
  const hasForeign = s.rows.some((r) => r.currency !== "KRW");
  const approx = hasForeign ? "약 " : "";

  return (
    <section className="flex flex-col gap-4 rounded-deep bg-deep p-5 text-on-deep" aria-labelledby="budget-title">
      <div className="flex items-center justify-between gap-2">
        <h2 id="budget-title" className="text-sub font-semibold text-on-deep-sub">{s.total == null ? "지금까지 쓴 돈" : over ? "예산을 넘었어요" : "남은 예산"}</h2>
        {canEdit && (
          <button type="button" onClick={() => setEditing(true)} className="press inline-flex h-8 items-center gap-1 rounded-full bg-deep-soft px-3 text-tiny font-semibold text-on-deep">
            <Icon name="pencil" size={13} />{view.budget ? "예산 수정" : "예산 정하기"}
          </button>
        )}
      </div>

      {/* 큰 숫자 + 막대 */}
      <div className="flex flex-col gap-2">
        <p className="text-number font-extrabold tabular-nums" style={over ? { color: OVER } : undefined}>
          {approx}{won(s.total == null ? s.spent : Math.abs(s.remain!))}
        </p>
        {s.total != null ? (
          <>
            <div className="h-2 overflow-hidden rounded-full bg-deep-soft" role="img" aria-label={`예산의 ${s.pct}% 씀`}>
              <span className="block h-full rounded-full transition-[width]" style={{ width: `${s.pct}%`, background: over ? OVER : OK }} />
            </div>
            <p className="flex justify-between gap-2 text-tiny text-on-deep-sub tabular-nums">
              <span>예산 {won(s.total)} 중 {approx}{won(s.spent)} 썼어요</span>
              <span className="font-semibold text-on-deep">{over ? "100%+" : `${s.pct}%`}</span>
            </p>
          </>
        ) : (
          <p className="text-tiny text-on-deep-sub">{canEdit ? "예산을 정하면 얼마 남았는지 알려 줘요" : "아직 예산을 정하지 않았어요"}</p>
        )}
        {s.unknown.length > 0 && <p className="text-tiny" style={{ color: OVER }}>{s.unknown.map(curName).join(", ")}은 환율을 몰라 원화 합에서 뺐어요</p>}
      </div>

      {/* 통화별 */}
      {hasForeign && (
        <ul className="flex flex-col gap-3 border-t border-deep-soft pt-4" aria-label="통화별로 쓴 돈">
          {s.rows.map((r) => {
            const left = r.left, cashPct = r.cash ? Math.min(100, Math.round((r.spent / r.cash) * 100)) : 0;
            return (
              <li key={r.currency} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sub font-semibold">{curName(r.currency)}</span>
                  <span className="flex items-baseline gap-1.5 tabular-nums">
                    <span className="text-sub font-bold">{formatMoney(r.spent, r.currency)}</span>
                    {r.currency !== "KRW" && r.krw != null && r.spent > 0 && <span className="text-tiny text-on-deep-sub">약 {won(r.krw)}</span>}
                  </span>
                </div>
                {r.cash != null && left != null && (
                  <>
                    <div className="h-1.5 overflow-hidden rounded-full bg-deep-soft" role="img" aria-label={`${curName(r.currency)} 예산의 ${cashPct}% 씀`}>
                      <span className="block h-full rounded-full" style={{ width: `${cashPct}%`, background: left < 0 ? OVER : OK }} />
                    </div>
                    <p className="flex justify-between gap-2 text-tiny tabular-nums text-on-deep-sub">
                      <span>예산 {formatMoney(r.cash, r.currency)}</span>
                      <span className="font-semibold" style={{ color: left < 0 ? OVER : undefined }}>{left < 0 ? `${formatMoney(-left, r.currency)} 넘었어요` : `${formatMoney(left, r.currency)} 남음`}</span>
                    </p>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* 예상 경비, 환율 기준 */}
      {(s.planned > 0 || s.foreign.length > 0) && (
        <div className="flex flex-col gap-2 border-t border-deep-soft pt-4 text-tiny text-on-deep-sub">
          {s.planned > 0 && (
            <p className="flex justify-between gap-2"><span>일정에 적은 예상 경비</span><span className="font-semibold tabular-nums text-on-deep">{hasForeign || view.planned.some((p) => p.currency !== "KRW") ? "약 " : ""}{won(s.planned)}</span></p>
          )}
          {s.foreign.map((c) => {
            const r = view.rates[c];
            return (
              <div key={c} className="flex items-center justify-between gap-2">
                <span className="min-w-0 flex-1">{r ? <>환율 기준 1 {c} = {rateText(r.krw)}원 <span className="opacity-80">({r.custom ? "직접 정함" : "오늘 환율"})</span></> : `${c} 환율을 받아 오지 못했어요`}</span>
                <button type="button" onClick={() => setRateCur(c)} className="press inline-flex h-7 flex-none items-center rounded-full border border-deep-soft px-2.5 font-semibold text-on-deep">환율 수정</button>
              </div>
            );
          })}
        </div>
      )}

      {editing && <BudgetSheet view={view} Sheet={Sheet} onClose={() => setEditing(false)} />}
      {rateCur && <RateDialog tripId={view.tripId} cur={rateCur} current={view.rates[rateCur]?.krw ?? null} auto={view.rates[rateCur]?.auto ?? null}
        custom={!!view.rates[rateCur]?.custom} canEdit={canEdit} onClose={() => setRateCur(null)} />}
    </section>
  );
}

/* 예산 정하기 : 총예산(원) + 통화별 예산(선택, 미리 환전한 돈) */
function BudgetSheet({ view, Sheet, onClose }: { view: ExpensesView; Sheet: (p: { title: string; onClose: () => void; children: React.ReactNode }) => React.ReactNode; onClose: () => void }) {
  const totalWon = view.budget ? (view.budget.currency === "KRW" ? view.budget.total : budgetSummary({ expenses: [], planned: [], budget: view.budget, cash: {}, rates: view.rates, decimals: decimalsOf }).total) : null;
  const [total, setTotal] = useState(totalWon != null ? String(totalWon) : "");
  const curs = [...new Set([...view.currencies, ...Object.keys(view.cash), ...view.expenses.map((e) => e.currency)])].filter((c) => c !== "KRW");
  const [cash, setCash] = useState<Record<string, string>>(() => Object.fromEntries(curs.map((c) => [c, view.cash[c] ? String(view.cash[c] / 10 ** decimalsOf(c)) : ""])));
  const [err, setErr] = useState("");
  const [busy, start] = useTransition();
  const n = Number(total.replace(/,/g, ""));
  const save = () => start(async () => {
    setErr("");
    if (view.budget && !total.trim()) return setErr("총예산을 적어 주세요");
    const r = await safeCall(() => saveBudgetPlan(view.tripId, total, cash));
    if (r?.error) return setErr(r.error);
    onClose();
  });
  const fmt = (v: string) => { const x = Number(v.replace(/,/g, "")); return v && x > 0 ? x.toLocaleString("ko-KR") : ""; };
  return (
    <Sheet title={view.budget ? "예산 수정" : "예산 정하기"} onClose={onClose}>
      <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <Field label="총예산 (원)" name="total" inputMode="numeric" placeholder="예 : 3000000" value={total} disabled={busy} autoFocus
          onChange={(e) => { setTotal(e.target.value.replace(/[^\d]/g, "")); setErr(""); }}
          hint={n > 0 ? `${fmt(total)}원. 모든 통화로 쓴 돈을 원화로 바꿔 비교해요` : "모든 통화로 쓴 돈을 원화로 바꿔 비교해요"} />
        {view.budget && view.budget.currency !== "KRW" && <p className="rounded-field bg-surface px-3 py-2 text-tiny text-ink-sub">예전에 {curName(view.budget.currency)}로 정한 예산을 원화로 바꿔 채웠어요. 저장하면 원화로 바뀌어요</p>}
        {curs.length > 0 && (
          <div className="flex flex-col gap-3 rounded-card bg-surface p-4">
            <div>
              <p className="text-sub font-bold text-ink">통화별 예산 <span className="font-normal text-ink-sub">(선택)</span></p>
              <p className="text-tiny text-ink-sub">미리 환전한 돈을 적으면 그 통화로 얼마 남았는지 알려 줘요. 비우면 안 보여요</p>
            </div>
            {curs.map((c) => (
              <Field key={c} label={`${curName(c)} (${c})`} name={`cash-${c}`} inputMode={decimalsOf(c) ? "decimal" : "numeric"} placeholder="0" value={cash[c] ?? ""} disabled={busy}
                onChange={(e) => { const v = e.target.value.replace(/[^\d.,]/g, ""); setCash((m) => ({ ...m, [c]: v })); setErr(""); }}
                hint={view.rates[c] && Number((cash[c] ?? "").replace(/,/g, "")) > 0 ? `약 ${won(Number(cash[c].replace(/,/g, "")) * view.rates[c].krw)}` : undefined} />
            ))}
          </div>
        )}
        {err && <p role="alert" className="text-sub font-semibold text-point-text">{err}</p>}
        <Button type="submit" size="lg" full disabled={busy || (!total && !Object.values(cash).some(Boolean) && !Object.keys(view.cash).length)}>{busy ? "저장하는 중" : "저장"}</Button>
      </form>
    </Sheet>
  );
}
