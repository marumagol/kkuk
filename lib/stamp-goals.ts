/* 도장 목표 배지 (0.57.0). 도장 탭과 홈 수집 현황 줄이 같이 쓴다 */
export type Goal = { key: string; label: string; need: number; of: "stamp" | "country" };
export const GOALS: Goal[] = [
  { key: "first", label: "첫 도장", need: 1, of: "stamp" },
  { key: "s5", label: "도장 5개", need: 5, of: "stamp" },
  { key: "c3", label: "나라 3곳", need: 3, of: "country" },
  { key: "s10", label: "도장 10개", need: 10, of: "stamp" },
  { key: "c5", label: "나라 5곳", need: 5, of: "country" },
  { key: "s30", label: "도장 30개", need: 30, of: "stamp" },
];
export const goalValue = (g: Goal, stamps: number, countries: number) => (g.of === "stamp" ? stamps : countries);
export const nextGoal = (stamps: number, countries: number) => GOALS.find((g) => goalValue(g, stamps, countries) < g.need);
