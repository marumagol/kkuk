/*
  경비 탭 예산 계산 (2026-11-17 마루님 "총예산 원화 + 통화별 남은 돈, 한번에 가자")
  - 총예산은 원화 하나. 예전에 외화로 정한 예산은 환율로 바꿔 보여 준다 (저장하면 원화로)
  - 쓴 돈은 모든 통화 경비를 여행 환율(0040)로 원화로 바꿔 더한다. 환율을 모르는 통화는 빼고 unknown 에 담는다
  - 통화별 줄 : 그 통화로 쓴 돈, 통화별 예산(0041 trip_cash, 미리 환전한 돈)을 적었으면 남은 돈
  금액은 모두 통화별 최소 단위 정수 (원은 1원)
*/
import { convertMinor } from "@/lib/settle";

export type CurRow = { currency: string; spent: number; cash: number | null; left: number | null; krw: number | null };
export type BudgetSummary = {
  total: number | null;  // 총예산 (원). 없거나 환율을 몰라 못 바꾸면 null
  spent: number;         // 쓴 돈 (원, 환율 아는 것만)
  remain: number | null; // 남은 돈 (원). 넘으면 음수
  pct: number;           // 쓴 비율 0~100 (넘어도 100)
  planned: number;       // 일정에 적은 예상 경비 (원, 환율 아는 것만)
  unknown: string[];     // 환율을 몰라 원화 합에서 뺀 통화
  rows: CurRow[];        // 통화별 (외화 먼저, 원화는 마지막)
  foreign: string[];     // 환율 기준에 보여 줄 외화
};

type Rates = Record<string, { krw: number }>;

export function budgetSummary(input: {
  expenses: { amount: number; currency: string }[];
  planned: { amount: number; currency: string }[];
  budget: { currency: string; total: number } | null;
  cash: Record<string, number>;
  rates: Rates;
  decimals: (cur: string) => number;
}): BudgetSummary {
  const { expenses, planned, budget, cash, rates, decimals } = input;
  const unknown = new Set<string>();
  const toWon = (amount: number, cur: string) => {
    const v = convertMinor(amount, cur, "KRW", rates, decimals);
    if (v == null) unknown.add(cur);
    return v ?? 0;
  };
  const by = new Map<string, number>();
  for (const e of expenses) by.set(e.currency, (by.get(e.currency) ?? 0) + e.amount);
  for (const c of Object.keys(cash)) if (!by.has(c)) by.set(c, 0);
  const spent = [...by].reduce((n, [c, v]) => n + (v ? toWon(v, c) : 0), 0);
  const plannedWon = planned.reduce((n, p) => n + (convertMinor(p.amount, p.currency, "KRW", rates, decimals) ?? 0), 0);
  const total = budget ? convertMinor(budget.total, budget.currency, "KRW", rates, decimals) : null;
  const remain = total == null ? null : total - spent;
  const pct = total ? Math.min(100, Math.round((spent / total) * 100)) : 0;
  const rows: CurRow[] = [...by]
    .sort(([a], [b]) => (a === "KRW" ? 1 : b === "KRW" ? -1 : 0))
    .map(([currency, s]) => {
      const c = cash[currency] ?? null;
      return { currency, spent: s, cash: c, left: c == null ? null : c - s, krw: convertMinor(s, currency, "KRW", rates, decimals) };
    });
  const foreign = [...new Set([...rows.map((r) => r.currency), ...(budget && budget.currency !== "KRW" ? [budget.currency] : [])])].filter((c) => c !== "KRW");
  return { total, spent, remain, pct, planned: plannedWon, unknown: [...unknown], rows, foreign };
}
