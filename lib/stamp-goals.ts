/* 2026-11-25 용어 정리 (마루님 A안) : 도장은 받는 행동, 셀 때는 카드와 도시. of "stamp" 는 도시 수 (이름만 바꿈, 기준 그대로) */
/* 도장 목표 배지 (0.57.0). 도장 탭과 홈 수집 현황 줄이 같이 쓴다. tier 는 배지 테두리 금속 (0.94.0) */
export type Tier = "bronze" | "silver" | "gold" | "legend";
export type Goal = { key: string; label: string; need: number; of: "stamp" | "country"; tier: Tier; desc: string };
export const TIER_NAME: Record<Tier, string> = { bronze: "BRONZE", silver: "SILVER", gold: "GOLD", legend: "LEGEND" };
export const GOALS: Goal[] = [
  { key: "first", label: "첫 도장", need: 1, of: "stamp", tier: "bronze", desc: "처음으로 여행지에서 도장을 꾹 받았어요" },
  { key: "s5", label: "도시 5곳", need: 5, of: "stamp", tier: "silver", desc: "다섯 도시에서 도장을 받았어요" },
  { key: "c3", label: "나라 3곳", need: 3, of: "country", tier: "silver", desc: "세 나라에서 도장을 받았어요" },
  { key: "s10", label: "도시 10곳", need: 10, of: "stamp", tier: "gold", desc: "열 도시에서 도장을 받았어요" },
  { key: "c5", label: "나라 5곳", need: 5, of: "country", tier: "gold", desc: "다섯 나라에서 도장을 받았어요" },
  { key: "s30", label: "도시 30곳", need: 30, of: "stamp", tier: "legend", desc: "서른 도시에서 도장을 받은 진짜 여행가" },
];
export const goalValue = (g: Goal, stamps: number, countries: number) => (g.of === "stamp" ? stamps : countries);
export const nextGoal = (stamps: number, countries: number) => GOALS.find((g) => goalValue(g, stamps, countries) < g.need);
