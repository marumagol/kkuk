/*
  잠시 숨긴 기능
  - book : 여행 머리의 여행 한 권 단추, /trips/[id]/book (2026-11-16 마루님 "여행 계획 짜는 기능을 먼저 확실하게"). 다시 켜려면 true
  - 일기는 2026-11-17 마루님 "매력도가 없어서 삭제" : 화면과 코드를 지웠다 (DB 표 journal_* 는 남아 있음).
    예전 일기 주소(/diary, /j/링크, 여행 안 기록·일기)로 들어오면 middleware 가 여행 화면이나 홈으로 돌려보낸다
*/
export const FEATURES = { book: false } as const;

/* 숨긴(지운) 주소면 보낼 곳, 아니면 null */
export function hiddenRedirect(path: string): string | null {
  if (/^\/diary(\/|$)/.test(path)) return "/trips";
  if (/^\/j(\/|$)/.test(path)) return "/";
  const d = path.match(/^\/trips\/([^/]+)\/(diary|record)(\/|$)/);
  if (d) return `/trips/${d[1]}`;
  if (!FEATURES.book) {
    const m = path.match(/^\/trips\/([^/]+)\/book(\/|$)/);
    if (m) return `/trips/${m[1]}`;
  }
  return null;
}
