/*
  잠시 숨긴 기능 (2026-11-16 마루님 "일기, 여행 한 권은 일단 숨김. 여행 계획 짜는 기능을 먼저 확실하게")
  - 코드와 DB 는 그대로 둔다. 다시 켜려면 값을 true 로만 바꾸면 된다
  - diary : 아래 탭 "일기", 여행 안 "기록" 탭, 일정의 날짜별 [일기], 일기 화면들(/diary, /trips/[id]/diary, /trips/[id]/record)
  - book : 여행 머리의 여행 한 권 단추, /trips/[id]/book
  숨긴 주소로 들어오면 middleware 가 여행 화면으로 돌려보낸다
*/
export const FEATURES = { diary: false, book: false } as const;

/* 숨긴 주소면 보낼 곳, 아니면 null */
export function hiddenRedirect(path: string): string | null {
  if (!FEATURES.diary) {
    if (/^\/diary(\/|$)/.test(path)) return "/trips";
    const m = path.match(/^\/trips\/([^/]+)\/(diary|record)(\/|$)/);
    if (m) return `/trips/${m[1]}`;
  }
  if (!FEATURES.book) {
    const m = path.match(/^\/trips\/([^/]+)\/book(\/|$)/);
    if (m) return `/trips/${m[1]}`;
  }
  return null;
}
