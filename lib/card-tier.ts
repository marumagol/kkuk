/*
  도장 카드 (0.95.0~, 2026-11-19 마루님) : 방문 1회 = 여행 하나에서 받은 도장 하나 (같은 여행에서 다시 받아도 그대로)
  - 0.99.0 부터 방문마다 테마 하나를 랜덤으로 뽑는다 (아래). 목록에는 대표 카드(상세에서 설정), 없으면 가장 최근 카드
*/
/* 0.99.0 랜덤 카드 (2026-11-20 마루님) : 도장을 받을 때마다 8가지 테마 중 하나를 뽑는다
   - 같은 도시에서는 이미 나온 테마가 다시 나오지 않는다. 8가지를 다 모은 뒤에는 마지막 카드 그대로, 방문 횟수만 늘어난다
   - 레인보우만 다른 테마의 절반 확률
   - 뽑기는 (나, 도시)로 정해지는 순서라서 새로고침해도 바뀌지 않는다 (DB 저장 없음)
   번호는 globals.css 의 모양 번호 hc-t{n} / mc-t{n}. 10(눈꽃)은 hc-tw. 1(옛 일반)은 쓰지 않는다 */
export type Tier = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 10;
export const TIERS: { tier: Tier; name: string; weight: number }[] = [
  { tier: 4, name: "에메랄드", weight: 1 },
  { tier: 2, name: "골드", weight: 1 },
  { tier: 3, name: "자수정", weight: 1 },
  { tier: 5, name: "푸른 오팔", weight: 1 },
  { tier: 10, name: "눈꽃", weight: 1 },
  { tier: 7, name: "선셋 코랄", weight: 1 },
  { tier: 8, name: "실버", weight: 1 },
  { tier: 6, name: "레인보우", weight: 0.5 },
];
export const tierName = (t: Tier) => TIERS.find((x) => x.tier === t)?.name ?? "";
/* 효과 : 반짝이 별(앞면), 뒷면 별 */
export const twinkles = (t: Tier) => t !== 2 && t !== 8;
export const backStars = (t: Tier) => t === 5 || t === 6;
const ORD = ["첫", "두", "세", "네", "다섯", "여섯", "일곱", "여덟", "아홉", "열"];
export const visitLabel = (n: number) => (n <= ORD.length ? `${ORD[n - 1]} 번째 방문` : `${n}번째 방문`).replace("첫 번째", "첫");

/* 모은 카드들 : seed(나와 도시)로 섞은 순서대로, 방문마다 카드 하나. dates 는 받은 시각 오름차순 */
function rng(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let r = Math.imul(h ^ (h >>> 15), 1 | h);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
export function orderOf(seed: string) {
  const rand = rng(seed);
  const left = [...TIERS];
  const out: typeof TIERS = [];
  while (left.length) {
    let r = rand() * left.reduce((n, x) => n + x.weight, 0);
    const i = Math.max(0, left.findIndex((x) => (r -= x.weight) < 0));
    out.push(left.splice(i, 1)[0]);
  }
  return out;
}
export function cardsOf(dates: string[], seed: string) {
  return orderOf(seed).slice(0, dates.length).map((t, i) => ({ tier: t.tier, name: t.name, at: dates[i], visit: i + 1 }));
}

/* 카드 모양 : globals.css 의 hc-t{look} / mc-t{look}. 눈꽃은 "w" */
export type Look = Exclude<Tier, 10> | "w";
export const lookOf = (t: Tier): Look => (t === 10 ? "w" : t);
/* 테마별 도장 색 (components/kit.tsx StampFace finish) */
export const finishOf = (l: Look) => (l === "w" ? "diamond" : ([undefined, "rare", "epic", "royal", "opal", "legend", "coral", "silver"] as const)[l - 1]);
