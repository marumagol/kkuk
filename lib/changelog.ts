/*
  업데이트 내역 (마이 > 업데이트 내역). 배포할 때마다 맨 위에 하나씩 추가한다
  - at : 업데이트 일시 (한국 시간, "YYYY-MM-DD HH:mm")
  - items : 사용자에게 보이는 변경 내용. 화면 용어(장소, 도장 등)로 쓴다
*/
export type Update = { at: string; version: string; items: string[] };

export const CHANGELOG: Update[] = [
  { at: "2026-11-14 22:50", version: "0.3.0", items: ["여행을 만들 수 있어요. 도시, 기간, 이름 순서로 정해요", "여행 탭과 홈에 내가 만든 여행이 보여요", "로그인하면 가짜 여행 대신 내 여행만 보여요"] },
  { at: "2026-11-14 22:20", version: "0.2.0", items: ["처음 로그인하면 앱에서 쓸 이름을 정해요", "마이에서 내 이름을 보고 바꿀 수 있어요"] },
  { at: "2026-11-14 22:10", version: "0.1.0", items: ["메일로 받은 로그인 코드가 8자리여도 넣을 수 있어요"] },
  { at: "2026-11-14 22:05", version: "0.1.0", items: ["마이에서 업데이트 내역을 볼 수 있어요"] },
  { at: "2026-11-14 21:48", version: "0.1.0", items: ["새 로고로 바뀌었어요"] },
  {
    at: "2026-11-14 17:00",
    version: "0.1.0",
    items: [
      "KKuK 첫 버전을 열었어요",
      "홈, 여행, 도장, 마이 탭을 오갈 수 있어요",
      "여행을 일차별 일정으로 볼 수 있어요",
      "이메일로 받은 6자리 코드로 로그인할 수 있어요",
    ],
  },
];

/* "2026-11-14 22:05" → "2026.11.14 (토) 22:05" */
const WD = ["일", "월", "화", "수", "목", "금", "토"];
export function formatAt(at: string) {
  const [d, t] = at.split(" ");
  const [y, m, day] = d.split("-").map(Number);
  const wd = WD[new Date(Date.UTC(y, m - 1, day)).getUTCDay()];
  return `${d.replaceAll("-", ".")} (${wd}) ${t}`;
}
