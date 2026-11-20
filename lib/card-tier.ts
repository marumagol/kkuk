/*
  도장 카드 등급 (0.95.0, 2026-11-19 마루님) : 같은 도시를 여러 여행에서 받을수록 등급이 올라간다
  - 방문 1회 = 여행 하나에서 받은 도장 하나 (같은 여행에서 다시 받아도 그대로)
  - 0.98.0 컬렉션 (마루님) : 1번째 에메랄드(겨울 도시는 눈꽃), 2 골드, 3 자수정, 4 푸른 오팔, 5 레인보우(마지막). 6회부터는 레인보우 그대로, 상세 방문 횟수만 늘어난다
  - 등급별 모양은 app/globals.css 의 hc-t1/2/3/5/6/w (큰 카드), mc-t… (목록 카드)
*/
/* 0.98.0 등급 대신 컬렉션 (마루님) : 첫 카드부터 예쁜 카드. 다시 갈 때마다 다른 카드를 모은다 (위아래 이름 없음)
   번호는 globals.css 의 모양 번호(hc-t2 골드, t3 자수정, t4 에메랄드, t5 푸른 오팔, t6 레인보우). 1(옛 일반)은 쓰지 않는다 */
export type Tier = 2 | 3 | 4 | 5 | 6;
export const TIERS: { tier: Tier; name: string; need: number }[] = [
  { tier: 4, name: "에메랄드", need: 1 },
  { tier: 2, name: "골드", need: 2 },
  { tier: 3, name: "자수정", need: 3 },
  { tier: 5, name: "푸른 오팔", need: 4 },
  { tier: 6, name: "레인보우", need: 5 },
];
export const tierOf = (visits: number): Tier => ([...TIERS].reverse().find((t) => visits >= t.need)?.tier ?? 4);
export const tierName = (t: Tier, winter = false) => (t === 4 && winter ? "눈꽃" : TIERS.find((x) => x.tier === t)!.name);
const ORD = ["첫", "두", "세", "네", "다섯", "여섯", "일곱", "여덟", "아홉", "열"];
export const visitLabel = (n: number) => (n <= ORD.length ? `${ORD[n - 1]} 번째 방문` : `${n}번째 방문`).replace("첫 번째", "첫");

/* 모은 카드들 : 등급마다 그 등급에 닿은 방문(날짜)을 붙인다. dates 는 받은 시각 오름차순 */
export function cardsOf(dates: string[]) {
  return TIERS.filter((t) => dates.length >= t.need).map((t) => ({ ...t, at: dates[t.need - 1], visit: t.need }));
}

/* 겨울 도시 (0.98.0) : 겨울로 유명한 곳은 첫 카드가 에메랄드 대신 눈꽃 얼음 카드, 이름도 "눈꽃" */
const WINTER = new Set(["JP:삿포로", "JP:오타루", "CN:하얼빈", "CA:밴프", "CA:퀘벡", "CH:체르마트", "CH:인터라켄", "AT:할슈타트"]);
export const isWinter = (country: string | null | undefined, name: string) => WINTER.has(`${(country ?? "").toUpperCase()}:${name}`);
/* 카드 모양 : 등급 번호(1~6), 겨울 첫 카드는 "w". globals.css 의 hc-t{look} / mc-t{look} */
export type Look = Tier | "w";
export const lookOf = (t: Tier, country: string | null | undefined, name: string): Look => (t === 4 && isWinter(country, name) ? "w" : t);
/* 등급별 도장 색 (components/kit.tsx StampFace finish) */
export const finishOf = (l: Look) => (l === "w" ? "diamond" : ([undefined, "rare", "epic", "royal", "opal", "legend"] as const)[l - 1]);
