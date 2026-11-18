/*
  잠시 숨긴 기능
  - book : 여행 머리의 여행 한 권 단추, /trips/[id]/book (2026-11-16 마루님 "여행 계획 짜는 기능을 먼저 확실하게"). 다시 켜려면 true
*/
export const FEATURES = { book: false } as const;

/* 숨긴(지운) 주소면 보낼 곳, 아니면 null */
export function hiddenRedirect(path: string): string | null {
  if (!FEATURES.book) {
    const m = path.match(/^\/trips\/([^/]+)\/book(\/|$)/);
    if (m) return `/trips/${m[1]}`;
  }
  return null;
}
