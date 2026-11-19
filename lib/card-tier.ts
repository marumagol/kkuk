/*
  도장 카드 등급 (0.95.0, 2026-11-19 마루님) : 같은 도시를 여러 여행에서 받을수록 등급이 올라간다
  - 방문 1회 = 여행 하나에서 받은 도장 하나 (같은 여행에서 다시 받아도 그대로)
  - 0.97.2 5단계 (마루님) : 일반 1회(나라색), 레어 2회(금), 에픽 3회(자수정, 겨울 도시는 눈꽃 얼음), 유니크 5회(푸른 오팔), 레전드 10회(레인보우, 마지막). 11회부터는 레전드 그대로, 상세 방문 횟수만 늘어난다
  - 등급별 모양은 app/globals.css 의 hc-t1/2/3/5/6/w (큰 카드), mc-t… (목록 카드)
*/
export type Tier = 1 | 2 | 3 | 5 | 6; // 4(로열)는 0.97.2 에서 뺐다. 모양 번호(hc-t5, t6)를 그대로 쓰려고 번호는 비워 둔다
export const TIERS: { tier: Tier; name: string; need: number }[] = [
  { tier: 1, name: "일반", need: 1 },
  { tier: 2, name: "레어", need: 2 },
  { tier: 3, name: "에픽", need: 3 },
  { tier: 5, name: "유니크", need: 5 },
  { tier: 6, name: "레전드", need: 10 },
];
export const tierOf = (visits: number): Tier => ([...TIERS].reverse().find((t) => visits >= t.need)?.tier ?? 1);
export const tierName = (t: Tier) => TIERS.find((x) => x.tier === t)!.name;
const ORD = ["첫", "두", "세", "네", "다섯", "여섯", "일곱", "여덟", "아홉", "열"];
export const visitLabel = (n: number) => (n <= ORD.length ? `${ORD[n - 1]} 번째 방문` : `${n}번째 방문`).replace("첫 번째", "첫");

/* 모은 카드들 : 등급마다 그 등급에 닿은 방문(날짜)을 붙인다. dates 는 받은 시각 오름차순 */
export function cardsOf(dates: string[]) {
  return TIERS.filter((t) => dates.length >= t.need).map((t) => ({ ...t, at: dates[t.need - 1], visit: t.need }));
}

/* 겨울 도시 에픽 (0.97.2 마루님, 0.97.0 로열에서 옮김) : 겨울로 유명한 곳은 에픽(3회) 카드가 자수정 대신 눈꽃 얼음 크리스털. 등급 이름은 그대로 "에픽" */
const WINTER = new Set(["JP:삿포로", "JP:오타루", "CN:하얼빈", "CA:밴프", "CA:퀘벡", "CH:체르마트", "CH:인터라켄", "AT:할슈타트"]);
export const isWinter = (country: string | null | undefined, name: string) => WINTER.has(`${(country ?? "").toUpperCase()}:${name}`);
/* 카드 모양 : 등급 번호(1~6), 겨울 에픽은 "w". globals.css 의 hc-t{look} / mc-t{look} */
export type Look = Tier | "w";
export const lookOf = (t: Tier, country: string | null | undefined, name: string): Look => (t === 3 && isWinter(country, name) ? "w" : t);
/* 등급별 도장 색 (components/kit.tsx StampFace finish) */
export const finishOf = (l: Look) => (l === "w" ? "diamond" : ([undefined, "rare", "epic", "royal", "opal", "legend"] as const)[l - 1]);
