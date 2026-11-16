/*
  경비 정산 계산 (6단계 3번). 서버와 화면이 같이 쓴다
  - 통화별로 따로 계산. 여러 통화가 섞이면 화면에서 toKrw 로 원화 하나로 바꾼 뒤 넘긴다 (2026-11-17)
  - 한 경비는 나눌 사람 수로 똑같이 나누고, 나누어떨어지지 않는 나머지(최소 단위)는 낸 사람이 떠안음
    (낸 사람이 나눌 사람에 없으면 나눌 사람 앞에서부터 1씩)
  - 보낼 돈은 "가장 많이 받을 사람 ← 가장 많이 낼 사람" 순서로 맞춰서 송금 횟수를 줄임
*/
export type ExpenseLike = { amount: number; currency: string; paidBy: string; splitWith: string[] };
export type Transfer = { from: string; to: string; amount: number; currency: string };
export type Balance = { userId: string; currency: string; paid: number; share: number; net: number }; // net > 0 받을 돈

/*
  여러 통화를 원화 하나로 (2026-11-17 마루님) : 환율이 있는 외화 경비를 원화로 바꾼다. 환율을 모르는 통화는 그대로 (통화별 따로 계산)
  rates : 통화 → 1 단위 = 몇 원. 금액은 최소 단위 정수라 소수 자리(decimals)를 같이 받는다
*/
export function toKrw<T extends ExpenseLike>(list: T[], rates: Record<string, { krw: number }>, decimals: (cur: string) => number): T[] {
  return list.map((e) => {
    const r = e.currency === "KRW" ? null : rates[e.currency];
    return r ? { ...e, currency: "KRW", amount: Math.round((e.amount / 10 ** decimals(e.currency)) * r.krw) } : e;
  });
}
/* 한 금액을 다른 통화로 (원화를 거쳐서). 환율을 모르면 null */
export function convertMinor(amount: number, from: string, to: string, rates: Record<string, { krw: number }>, decimals: (cur: string) => number): number | null {
  if (from === to) return amount;
  const fr = from === "KRW" ? 1 : rates[from]?.krw, tr = to === "KRW" ? 1 : rates[to]?.krw;
  if (!fr || !tr) return null;
  return Math.round(((amount / 10 ** decimals(from)) * fr / tr) * 10 ** decimals(to));
}
export const isMixed = (list: { currency: string }[]) => new Set(list.map((e) => e.currency)).size > 1;

export function balances(list: ExpenseLike[]): Balance[] {
  const m = new Map<string, Balance>();
  const get = (userId: string, currency: string) => {
    const k = `${currency}:${userId}`;
    let b = m.get(k);
    if (!b) { b = { userId, currency, paid: 0, share: 0, net: 0 }; m.set(k, b); }
    return b;
  };
  for (const e of list) {
    const people = [...new Set(e.splitWith)];
    if (!people.length || e.amount <= 0) continue;
    get(e.paidBy, e.currency).paid += e.amount;
    const each = Math.floor(e.amount / people.length);
    let rest = e.amount - each * people.length;
    const order = people.includes(e.paidBy) ? [e.paidBy, ...people.filter((p) => p !== e.paidBy)] : people;
    for (const p of order) {
      let s = each;
      if (rest > 0 && (p === e.paidBy || !people.includes(e.paidBy))) { const take = p === e.paidBy ? rest : 1; s += take; rest -= take; }
      get(p, e.currency).share += s;
    }
  }
  for (const b of m.values()) b.net = b.paid - b.share;
  return [...m.values()];
}

export function settle(list: ExpenseLike[]): Transfer[] {
  const out: Transfer[] = [];
  const byCur = new Map<string, Balance[]>();
  for (const b of balances(list)) byCur.set(b.currency, [...(byCur.get(b.currency) ?? []), b]);
  for (const [currency, bs] of byCur) {
    const get = bs.filter((b) => b.net > 0).map((b) => ({ id: b.userId, v: b.net })).sort((a, b) => b.v - a.v);
    const give = bs.filter((b) => b.net < 0).map((b) => ({ id: b.userId, v: -b.net })).sort((a, b) => b.v - a.v);
    let i = 0, j = 0;
    while (i < get.length && j < give.length) {
      const x = Math.min(get[i].v, give[j].v);
      if (x > 0) out.push({ from: give[j].id, to: get[i].id, amount: x, currency });
      get[i].v -= x; give[j].v -= x;
      if (get[i].v === 0) i++;
      if (give[j].v === 0) j++;
    }
  }
  return out;
}
