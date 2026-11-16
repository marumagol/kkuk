/* 구글 지도 길찾기 주소 (2026-11-16 마루님). 앱이 있으면 앱으로, 없으면 웹으로 열린다 */
type P = { title: string; addr?: string; lat?: number; lng?: number; gpid?: string };
const q = (p: P) => (p.lat != null && p.lng != null ? `${p.lat},${p.lng}` : [p.title, p.addr].filter(Boolean).join(" "));
export const mapsDirUrl = (p: P) =>
  `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q(p))}${p.gpid ? `&destination_place_id=${encodeURIComponent(p.gpid)}` : ""}`;
export const mapsViewUrl = (p: P) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q(p))}${p.gpid ? `&query_place_id=${encodeURIComponent(p.gpid)}` : ""}`;
export const canMap = (p: P) => (p.lat != null && p.lng != null) || !!p.addr;
