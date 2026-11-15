/*
  경비 정산 계산 (6단계 3번). 서버와 화면이 같이 쓴다
  - 통화별로 따로 계산 (환율 계산 안 함)
  - 한 경비는 나눌 사람 수로 똑같이 나누고, 나누어떨어지지 않는 나머지(최소 단위)는 낸 사람이 떠안음
    (낸 사람이 나눌 사람에 없으면 나눌 사람 앞에서부터 1씩)
  - 보낼 돈은 "가장 많이 받을 사람 ← 가장 많이 낼 사람" 순서로 맞춰서 송금 횟수를 줄임
*/
export type ExpenseLike = { amount: number; currency: string; paidBy: string; splitWith: string[] };
export type Transfer = { from: string; to: string; amount: number; currency: string };
export type Balance = { userId: string; currency: string; paid: number; share: number; net: number }; // net > 0 받을 돈

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
