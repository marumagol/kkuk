/*
  도장 그림 (3단계, 2026-11-14). 기준은 마루님 피그마 "삿포로 도장" (디자인-가이드 2-1)
  - 86 x 86 칸, 지면 선 y=58.6. 그림은 흰색(currentColor) 한 가지, 구멍(창문 등)은 HOLE 색
  - 모두 직접 그린 단순 실루엣. 다른 서비스, 굿즈, 사진을 따라 그리지 않는다
  - 마루님이 피그마 "도장" 페이지에서 고치면 그 SVG 를 여기로 옮긴다
  - 키는 "나라코드:도시이름" (DB cities 와 같음). 없으면 글자 도장
*/
const G = '<path d="M18.4 58.6H67.1" stroke="currentColor" stroke-width="1" fill="none"/>';
const W = (y: number) => `<path d="M20 ${y}q3.5 -2.4 7 0t7 0t7 0t7 0t7 0t7 0" stroke="currentColor" stroke-width="1" fill="none"/>`;
const dots = (p: [number, number, number][]) => p.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="currentColor"/>`).join("");
const H = "var(--stamp-hole)";
const palm = (x: number, top: number) =>
  `<path d="M${x} 58.6Q${x - 2} ${top + 12} ${x + 3} ${top}" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round"/>` +
  `<path d="M${x + 3} ${top}q-7 -6 -14 -2q7 -1 14 2zM${x + 3} ${top}q7 -6 14 -1q-7 -1.5 -14 1zM${x + 3} ${top}q-3 -8 -10 -10q5 4 10 10zM${x + 3} ${top}q4 -8 11 -8q-6 3 -11 8zM${x + 3} ${top}q-8 0 -12 6q5 -5 12 -6zM${x + 3} ${top}q8 0 11 7q-4 -5 -11 -7z" fill="currentColor"/>`;
const castle = (shachi = false) =>
  '<path d="M31 58.6H55L52 50H34Z" fill="currentColor"/>' +
  '<rect x="36" y="44" width="14" height="6" fill="currentColor"/>' +
  '<path d="M31.5 45.5H54.5L49.5 40H36.5Z" fill="currentColor"/>' +
  '<rect x="38.5" y="35" width="9" height="5" fill="currentColor"/>' +
  '<path d="M34.5 36.5H51.5L47.5 31.5H38.5Z" fill="currentColor"/>' +
  '<rect x="40.5" y="27.5" width="5" height="4" fill="currentColor"/>' +
  '<path d="M37 28.5H49L43 22.5Z" fill="currentColor"/>' +
  `<rect x="39" y="46" width="2" height="2.5" fill="${H}"/><rect x="42" y="46" width="2" height="2.5" fill="${H}"/><rect x="45" y="46" width="2" height="2.5" fill="${H}"/>` +
  `<rect x="40.5" y="36.5" width="1.6" height="2" fill="${H}"/><rect x="43.9" y="36.5" width="1.6" height="2" fill="${H}"/>` +
  (shachi ? '<path d="M38.5 23q-1.5 -4 1 -6q-0.5 3 1.5 5zM47.5 23q1.5 -4 -1 -6q0.5 3 -1.5 5z" fill="currentColor"/>' : "");

export const STAMP_ART: Record<string, string> = {
  // 삿포로 : 눈 덮인 전나무와 눈송이 (마루님 원본)
  "JP:삿포로": G +
    '<path d="M42.8 22.4L50.3 34.3H35.2ZM42.9 26L53.1 42.1H32.7ZM43 30.4L55.4 49.9H30.6ZM43.1 35.2L55.9 55.4H30.3Z" fill="currentColor"/>' +
    '<rect x="42" y="50" width="2" height="8" fill="currentColor"/>' +
    '<path d="M57 58.55C57 56.59 50.8 55 43.2 55S29.4 56.59 29.4 58.55Z" fill="currentColor"/>' +
    dots([[47.5, 19.5, .6], [64.5, 35.5, .6], [62.5, 50.5, .6], [54.5, 28.5, .6], [26.5, 25.5, .6], [20.5, 47.5, .6], [29.5, 39.5, .6], [38, 20, 1], [49.5, 25.5, .6], [35.5, 30.5, .6], [24, 35, 1], [64, 27, 1], [59, 42, 1], [69, 52, 1], [28, 54, 1]]),
  // 도쿄 : 철골 전망탑
  "JP:도쿄": G +
    '<path d="M43 14V20" stroke="currentColor" stroke-width="1"/>' +
    '<path d="M42 20H44L46.5 36L50.5 58.6H47L43 44L39 58.6H35.5L39.5 36Z" fill="currentColor"/>' +
    '<rect x="37.5" y="35" width="11" height="2.6" fill="currentColor"/><rect x="40.2" y="26" width="5.6" height="2" fill="currentColor"/>' +
    `<path d="M41 39L43 42L45 39Z" fill="${H}"/>`,
  // 오사카 : 성
  "JP:오사카": G + castle(),
  // 나고야 : 지붕 위 물고기 장식이 있는 성
  "JP:나고야": G + castle(true),
  // 교토 : 신사 문
  "JP:교토": G +
    '<path d="M28 26.5Q43 30 58 26.5L57.2 30.6Q43 33.4 28.8 30.6Z" fill="currentColor"/>' +
    '<rect x="31" y="35" width="24" height="2.6" fill="currentColor"/>' +
    '<rect x="41.8" y="31" width="2.4" height="4" fill="currentColor"/>' +
    '<path d="M34 31.5H37.2L37.8 58.6H33.4ZM48.8 31.5H52L52.6 58.6H48.2Z" fill="currentColor"/>' +
    dots([[24, 44, .7], [62, 40, .7], [21, 52, .7], [65, 50, .7]]),
  // 후쿠오카 : 돼지뼈 국물 라면 한 그릇
  "JP:후쿠오카": G +
    '<path d="M28.5 43.5H57.5Q56.5 56 43 57Q29.5 56 28.5 43.5Z" fill="currentColor"/>' +
    '<rect x="37" y="57" width="12" height="1.6" fill="currentColor"/>' +
    '<path d="M47 41L58 29M50.5 42L61 32" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>' +
    '<path d="M36 39q-2 -3 0 -6t0 -6M41 39q-2 -3 0 -6t0 -6" stroke="currentColor" stroke-width="1" fill="none" stroke-linecap="round"/>' +
    `<path d="M32 47.5H54" stroke="${H}" stroke-width="1"/>`,
  // 오키나와 : 야자수와 바다
  "JP:오키나와": W(58.6) + palm(38, 30) + '<circle cx="58" cy="28" r="4.5" fill="currentColor"/>',
  // 오타루 : 운하 창고와 가스등
  "JP:오타루": G +
    '<path d="M21 46H37L29 40.5Z" fill="currentColor"/><rect x="22.5" y="46" width="13" height="12.6" fill="currentColor"/>' +
    `<rect x="27" y="50" width="4" height="8.6" fill="${H}"/>` +
    '<rect x="51.2" y="31" width="1.6" height="27.6" fill="currentColor"/>' +
    '<path d="M48 24.5H56L54.6 31H49.4ZM47.5 24.5H56.5L52 20.5Z" fill="currentColor"/>' +
    `<rect x="50.6" y="25.8" width="2.8" height="3.6" fill="${H}"/>` +
    dots([[40, 22, .7], [62, 36, .7], [44, 32, 1], [64, 46, .7], [24, 30, 1]]),
  // 서울 : 산 위 전망탑
  "KR:서울": '<path d="M18 58.6Q43 42 68 58.6Z" fill="currentColor"/>' +
    '<path d="M43 14V22" stroke="currentColor" stroke-width="1"/>' +
    '<rect x="41.8" y="25" width="2.4" height="26" fill="currentColor"/>' +
    '<ellipse cx="43" cy="26" rx="4.5" ry="2.6" fill="currentColor"/><rect x="40.5" y="22" width="5" height="2" fill="currentColor"/>',
  // 제주 : 한라산과 귤
  "KR:제주": G +
    '<path d="M18.5 58.6L36 37Q43 32.5 50 37L67.5 58.6Z" fill="currentColor"/>' +
    `<path d="M38.5 37.2Q43 39.5 47.5 37.2" stroke="${H}" stroke-width="1" fill="none"/>` +
    '<circle cx="58" cy="26" r="5" fill="currentColor"/><path d="M58 21q2 -3 5 -2q-2 2 -5 2z" fill="currentColor"/>',
  // 부산 : 바다 위 현수교
  "KR:부산": '<path d="M18 50H68" stroke="currentColor" stroke-width="2"/>' +
    '<rect x="30" y="30" width="2.6" height="24" fill="currentColor"/><rect x="53.4" y="30" width="2.6" height="24" fill="currentColor"/>' +
    '<path d="M18 46Q25 44 31.3 31Q43 52 54.7 31Q61 44 68 46" stroke="currentColor" stroke-width="1" fill="none"/>' +
    W(57),
  // 타이베이 : 마디가 겹친 초고층 탑
  "TW:타이베이": G +
    '<path d="M43 13V21" stroke="currentColor" stroke-width="1"/><rect x="41.6" y="21" width="2.8" height="5" fill="currentColor"/>' +
    [0, 1, 2, 3, 4, 5].map((i) => { const y = 50 - 4 * (i + 1); return `<path d="M39.3 ${y + 4}H46.7L48.2 ${y}H37.8Z" fill="currentColor"/>`; }).join("") +
    '<rect x="38.5" y="50" width="9" height="8.6" fill="currentColor"/>',
  // 홍콩 : 바닷가 빌딩 숲
  "HK:홍콩": W(58.6) +
    [[24, 42, 5], [30, 33, 5], [36, 38, 4], [41, 27, 5.5], [47.5, 36, 5], [53.5, 31, 4.5], [59, 44, 5]].map(([x, y, w]) => `<rect x="${x}" y="${y}" width="${w}" height="${56 - y}" fill="currentColor"/>`).join("") +
    '<path d="M43.75 27L43.75 21" stroke="currentColor" stroke-width="1"/>',
  // 방콕 : 사원 탑
  "TH:방콕": G +
    '<path d="M43 15L44.8 26Q49.5 30 49.5 36L52.5 43V58.6H33.5V43L36.5 36Q36.5 30 41.2 26Z" fill="currentColor"/>' +
    '<rect x="28" y="54" width="30" height="4.6" fill="currentColor"/>' +
    `<path d="M40.5 58.6V50Q43 46.5 45.5 50V58.6Z" fill="${H}"/><path d="M37 42H49M38 36H48" stroke="${H}" stroke-width="1"/>`,
  // 다낭 : 동그란 바구니 배와 노
  "VN:다낭": W(58) +
    '<path d="M27 46H59Q57 55 43 55.5Q29 55 27 46Z" fill="currentColor"/>' +
    '<path d="M50 50L60 26" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M58.8 24L62.5 25.6L60.8 31.5L57.6 30.2Z" fill="currentColor"/>' +
    `<path d="M31 49H55" stroke="${H}" stroke-width="1"/>` + '<circle cx="30" cy="27" r="4" fill="currentColor"/>',
  // 싱가포르 : 난초 꽃
  "SG:싱가포르": G +
    [0, 72, 144, 216, 288].map((a) => `<ellipse cx="43" cy="31" rx="5" ry="9" transform="rotate(${a} 43 40)" fill="currentColor"/>`).join("") +
    `<circle cx="43" cy="40" r="3.2" fill="${H}"/><circle cx="43" cy="40" r="1.4" fill="currentColor"/>` +
    '<path d="M43 49V58.6" stroke="currentColor" stroke-width="1.6"/>',
  // 파리 : 철탑
  "FR:파리": G +
    '<path d="M43 13V18" stroke="currentColor" stroke-width="1"/>' +
    '<path d="M42 18H44L45.6 27L48.6 41L54 58.6H49Q43 47 37 58.6H32L37.4 41L40.4 27Z" fill="currentColor"/>' +
    '<rect x="36.5" y="40" width="13" height="2.2" fill="currentColor"/><rect x="39.8" y="26.4" width="6.4" height="1.8" fill="currentColor"/>' +
    `<path d="M41 33H45" stroke="${H}" stroke-width="1"/>`,
  // 런던 : 시계탑
  "GB:런던": G +
    '<path d="M37 30H49L43 15Z" fill="currentColor"/><rect x="38" y="30" width="10" height="28.6" fill="currentColor"/>' +
    `<circle cx="43" cy="35.5" r="3.3" fill="${H}"/><path d="M43 35.5V33.3M43 35.5H44.8" stroke="currentColor" stroke-width=".8"/>` +
    `<rect x="37" y="41" width="12" height="1.6" fill="currentColor"/><path d="M41 46V56M45 46V56" stroke="${H}" stroke-width="1"/>` +
    '<rect x="25" y="48" width="10" height="10.6" fill="currentColor"/><rect x="51" y="50" width="10" height="8.6" fill="currentColor"/>',
  // 뉴욕 : 계단식 초고층 빌딩
  "US:뉴욕": G +
    '<path d="M43 12V19" stroke="currentColor" stroke-width="1"/>' +
    '<rect x="42" y="19" width="2" height="6" fill="currentColor"/><rect x="40.5" y="25" width="5" height="7" fill="currentColor"/>' +
    '<rect x="38.5" y="32" width="9" height="8" fill="currentColor"/><rect x="36" y="40" width="14" height="18.6" fill="currentColor"/>' +
    '<rect x="25" y="46" width="9" height="12.6" fill="currentColor"/><rect x="52" y="43" width="9" height="15.6" fill="currentColor"/>' +
    `<path d="M40 44V56M43 44V56M46 44V56" stroke="${H}" stroke-width=".8"/>`,
  // 로마 : 원형 경기장
  "IT:로마": G +
    '<path d="M21 58.6V40Q43 31 65 40V58.6Z" fill="currentColor"/>' +
    [24.5, 30.5, 36.5, 42.5, 48.5, 54.5, 60].map((x) => `<path d="M${x} 58.6V54Q${x + 1.6} 52 ${x + 3.2} 54V58.6Z" fill="${H}"/><path d="M${x} 49.5V46.5Q${x + 1.6} 44.8 ${x + 3.2} 46.5V49.5Z" fill="${H}"/>`).join("") +
    `<path d="M22 42Q43 34 64 42" stroke="${H}" stroke-width="1" fill="none"/>`,
  // 괌 : 바다 위 해와 야자수
  "GU:괌": W(58.6) + '<path d="M41 56A10 10 0 0 1 61 56Z" fill="currentColor"/>' + palm(28, 32),
};

export const stampArt = (country?: string | null, name?: string) => (country && name ? STAMP_ART[`${country.slice(0, 2)}:${name}`] : undefined);

/* 바깥 물결 모양 : 꼭지 7개, 안쪽 비율 0.7 을 둥글게 (피그마 별 모양 + 모서리 최대) */
export function blobPath(cx: number, cy: number, r: number, points = 7, inner = 0.7) {
  const v: [number, number][] = [];
  for (let i = 0; i < points * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    const rr = i % 2 ? r * inner : r;
    v.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]);
  }
  const mid = (a: [number, number], b: [number, number]) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2].map((n) => n.toFixed(2)).join(" ");
  let d = `M${mid(v[v.length - 1], v[0])}`;
  for (let i = 0; i < v.length; i++) d += `Q${v[i][0].toFixed(2)} ${v[i][1].toFixed(2)} ${mid(v[i], v[(i + 1) % v.length])}`;
  return d + "Z";
}
