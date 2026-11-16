/*
  3단계용 가짜 데이터 (만들기 순서 3단계). 6단계에서 DB 를 붙이면 이 파일 대신 Supabase 에서 읽는다.
  실제 개인정보 없음. 인원을 정하는 표현(신혼, 아내 등) 쓰지 않음.
*/
import type { Category } from "@/components/kit";

export type Item = { id?: string; time?: string; category: Category; title: string; desc?: string; detail?: string /* 맞춤 칸 한 줄 (편명, 예약번호) */; editedBy?: string; editedFace?: string /* 고친 사람 프로필 사진 */; editedAgo?: string /* "2시간 전" */; editedKey?: string /* 한 번 본 수정은 다시 안 보이게 (id@updated_at) */; lat?: number; lng?: number; photos?: { path: string; url: string }[] /* 장소 사진 (url 은 1시간짜리 주소) */; addr?: string; gpid?: string /* 구글 장소 id (길찾기) */; cost?: number; cur?: string; hours?: string /* 영업시간 (lib/hours.ts 형식) */; arrive?: { lat: number; lng: number; name: string } /* 이동의 도착지 (지도에 점 하나 더, 2026-11-16) */ };
export type Trip = {
  id: string; title: string; start: string; end: string; // YYYY-MM-DD
  cities: string[]; members: { initial: string; name?: string; tone: "point" | "accent"; userId?: string; avatar?: string }[];
  ready?: number; // 준비 % (2단계 기능, 지금은 가짜)
  timeZone?: string; // 여행 시간대 (DB 여행). 없으면 한국 시간
  country?: string; // 첫 도시의 나라 코드 (목록 국기). ETC 나 없으면 핀
  countryIcon?: string; // 첫 도시에 직접 입력한 나라의 올린 아이콘 주소
  places?: number;   // 목록에서 쓰는 장소 수 (DB 여행은 days 를 다 읽지 않고 개수만)
  days: { title?: string; items: Item[] }[]; // 일차별 (0 = 1일차)
  undated: Item[];
};

export const TRIPS: Trip[] = [
  {
    id: "sapporo", country: "JP", title: "삿포로 겨울 여행", start: "2026-12-28", end: "2027-01-04",
    cities: ["삿포로", "오타루", "노보리베츠", "비에이"], members: [{ initial: "도", tone: "point" }, { initial: "윤", tone: "accent" }], ready: 68,
    days: [
      { title: "삿포로 도착", items: [
        { time: "13:20", category: "이동", title: "신치토세 공항 → 삿포로역", desc: "JR 쾌속 에어포트, 약 40분" },
        { time: "15:00", category: "숙소", title: "삿포로역 근처 호텔 체크인" },
        { time: "18:30", category: "식사", title: "징기스칸 다루마 본점", desc: "줄이 길어 일찍 가기" },
      ] },
      { title: "오타루 당일치기", items: [
        { time: "08:40", category: "이동", title: "JR 쾌속 에어포트, 삿포로 → 오타루", desc: "약 40분, 오른쪽 창가 자리가 바다 쪽" },
        { time: "09:30", category: "쇼핑", title: "오타루 오르골당 본관", desc: "예상 2,000엔, 오전에 덜 붐빔", editedBy: "윤" },
        { time: "12:30", category: "식사", title: "나루토 반마리 닭튀김", desc: "예상 1,500엔, 현금만" },
        { time: "15:00", category: "관광", title: "Otaru Canal Gas Lamp Evening Walking Course", desc: "16시 전후 가스등 점등" },
      ] },
      { title: "노보리베츠 온천", items: [
        { time: "10:00", category: "이동", title: "삿포로 → 노보리베츠 버스" },
        { time: "14:00", category: "관광", title: "지옥계곡 산책" },
      ] },
      { items: [] }, { items: [] }, { items: [] }, { items: [] }, { items: [] },
    ],
    undated: [{ category: "식사", title: "징기스칸 다루마 본점" }, { category: "관광", title: "시로이 코이비토 파크" }],
  },
  {
    id: "fukuoka", country: "JP", title: "후쿠오카 봄 여행", start: "2026-05-03", end: "2026-05-06",
    cities: ["후쿠오카", "다자이후"], members: [{ initial: "도", tone: "point" }],
    days: [
      { title: "도착하고 나카스", items: [{ time: "17:00", category: "식사", title: "나카스 포장마차 거리" }] },
      { title: "다자이후", items: [{ time: "10:00", category: "관광", title: "다자이후 텐만구" }, { time: "13:00", category: "식사", title: "우메가에모치 가게" }] },
      { items: [{ time: "11:00", category: "쇼핑", title: "캐널시티 하카타" }] },
      { items: [{ time: "09:00", category: "이동", title: "후쿠오카 공항" }] },
    ],
    undated: [],
  },
  {
    id: "kyoto", country: "JP", title: "교토 단풍 여행", start: "2025-11-08", end: "2025-11-11",
    cities: ["교토"], members: [{ initial: "도", tone: "point" }, { initial: "윤", tone: "accent" }],
    days: [{ items: [{ time: "09:00", category: "관광", title: "후시미 이나리 신사" }] }, { items: [{ time: "10:00", category: "관광", title: "아라시야마 대나무숲" }] }, { items: [] }, { items: [] }],
    undated: [],
  },
  {
    id: "taipei", country: "TW", title: "타이베이 주말 여행", start: "2025-02-14", end: "2025-02-16",
    cities: ["타이베이"], members: [{ initial: "도", tone: "point" }],
    days: [{ items: [{ time: "19:00", category: "식사", title: "라오허제 야시장" }] }, { items: [] }, { items: [] }],
    undated: [],
  },
];

/* ---------- 날짜 계산. "오늘"은 여행 시간대 기준 ---------- */
const day = (s: string) => { const [y, m, d] = s.split("-").map(Number); return Date.UTC(y, m - 1, d); };
export const todayKST = () => { const n = new Date(Date.now() + 9 * 3600 * 1000); return n.toISOString().slice(0, 10); };
export const todayIn = (tz: string) => {
  try { return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
  catch { return todayKST(); }
};
export const todayOf = (t: Pick<Trip, "timeZone">) => (t.timeZone ? todayIn(t.timeZone) : todayKST());
export const daysBetween = (a: string, b: string) => Math.round((day(b) - day(a)) / 86400000);
export const tripLength = (t: Trip) => daysBetween(t.start, t.end) + 1;
export const statusOf = (t: Trip, today = todayKST()) => (today < t.start ? "upcoming" : today > t.end ? "past" : "ongoing") as "upcoming" | "ongoing" | "past";
export const placeCount = (t: Trip) => t.places ?? t.days.reduce((n, d) => n + d.items.length, 0) + t.undated.length;

const WD = ["일", "월", "화", "수", "목", "금", "토"];
export const weekday = (s: string) => WD[new Date(day(s)).getUTCDay()];
export const md = (s: string) => { const [, m, d] = s.split("-").map(Number); return `${m}.${d}`; };
export const addDays = (s: string, n: number) => new Date(day(s) + n * 86400000).toISOString().slice(0, 10);
export const periodText = (t: Trip) => `${md(t.start)} (${weekday(t.start)}) ~ ${md(t.end)} (${weekday(t.end)}), ${tripLength(t) - 1}박 ${tripLength(t)}일`;
export const yearOf = (s: string) => s.slice(0, 4);

export const getTrip = (id: string) => TRIPS.find((t) => t.id === id);
/* 목록 나누기 : 오늘은 여행마다 그 여행 시간대로 */
export const upcomingOf = (list: Trip[]) => list.filter((t) => statusOf(t, todayOf(t)) !== "past").sort((a, b) => a.start.localeCompare(b.start));
export const pastOf = (list: Trip[]) => list.filter((t) => statusOf(t, todayOf(t)) === "past").sort((a, b) => b.start.localeCompare(a.start));
export const upcomingTrips = (today = todayKST()) => TRIPS.filter((t) => statusOf(t, today) !== "past").sort((a, b) => a.start.localeCompare(b.start));
export const pastTrips = (today = todayKST()) => TRIPS.filter((t) => statusOf(t, today) === "past").sort((a, b) => b.start.localeCompare(a.start));

/* 디데이 배지 (여행 목록, 홈 다른 다가오는 여행). 색 : 여행 중과 D-7 이내 hot, D-30 이내 near, 그보다 멀면 far */
export function ddayOf(t: Trip): { label: string; tone: "hot" | "near" | "far" } {
  const today = todayOf(t);
  if (statusOf(t, today) === "ongoing") return { label: "여행 중", tone: "hot" };
  const left = daysBetween(today, t.start);
  return { label: left === 0 ? "D-DAY" : `D-${left}`, tone: left <= 7 ? "hot" : left <= 30 ? "near" : "far" };
}
