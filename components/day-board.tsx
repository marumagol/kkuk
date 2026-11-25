"use client";
/*
  여행 일정 (2026-11-16 하루 단위로 바꿈. 마루님 "일정과 지도를 함께, 일정 단위로")
  - 위 : 그날 지도 (번호 핀 + 점선, components/day-map.tsx). 스크롤하면 지도는 그 자리에 있고 아래 시트가 지도 위로 올라온다
  - 시트 : 손잡이(누르면 펼치기/접기), [1일차][2일차]…[날짜 미정] + [편집], 고른 날 일정만 타임라인
  - 타임라인 : 위치 있는 장소만 번호(지도 핀과 같은 번호), 장소 사이 거리. 공항·항공은 비행기, 메모는 점 (번호 없음)
  - [편집] 을 누르면 손잡이와 지우기가 나온다. 손잡이를 끌어 순서를 바꾸고, 위 날짜 칩에 놓으면 그 날로 옮긴다
  - 키보드 : 손잡이에 초점을 두고 위/아래 화살표. 그 날 맨 위/아래에서 더 누르면 앞/뒤 날로 넘어간다
  - 저장에 실패하면 원래 자리로 되돌리고 안내
*/
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Icon, PinCard, CategoryChip } from "@/components/kit";
import { GateButton, AlertDialog } from "@/components/gate";
import { BottomDock } from "@/components/screen";
import { Toast, TOAST_MS } from "@/components/toast";
import { DayMap, type DayPoint } from "@/components/day-map";
import { reorderPlaces, moveItem, deletePlace, setItemTimes, setStayAt } from "@/app/actions";
import { useRouter } from "next/navigation";
import { safeCall } from "@/lib/safe-call";
import { addDays, md, weekday, type Item } from "@/lib/mock";
import { mapsDirUrl, canMap } from "@/lib/maps-link";
import { formatMoney } from "@/lib/countries";
import { hoursWarning } from "@/lib/hours";
import { modeIcon } from "@/lib/place-fields";
import { FileViewer, isPdf, type ViewFile } from "@/components/file-viewer";
import { Linkify } from "@/components/linkify";
import { useBackClose } from "@/lib/use-back-close";

type Props = {
  tripId: string; start: string; days: { title?: string; items: Item[] }[]; undated: Item[];
  editable: boolean; canAdd: boolean; user: boolean; initialDay: number; jump?: boolean; jumpUndated?: boolean;
};

/*
  비행기 표시 (번호 대신) : 실제 공항, 항공편만 (2026-11-16 마루님 "공항이 이름에 들어간다고 다 비행기는 아님")
  - 이름이 공항으로 끝나는 곳 (예 : 신치토세 공항, 인천국제공항 제1터미널, Narita Airport, 新千歳空港). "공항 라멘" 같은 곳은 아님
  - 이동 중 비행기를 고른 항목
*/
const AIRPORT = /(공항|airport|空港|機場|机场)(\s*(국제선|국내선|제?\s*\d\s*(여객)?터미널|터미널\s*\d?|T\d|terminal\s*\d?|ターミナル))?$/i;
const isFlight = (x: Item) => AIRPORT.test(x.title.trim()) || (x.category === "이동" && (x.detail ?? "").startsWith("비행기"));
const hasPos = (x: Item) => x.lat != null && x.lng != null;
/* 번호 : 위치가 있는 장소만, 메모와 이동(수단 아이콘)·공항은 빼고 1부터. 지도 핀과 같은 번호 */
const modeMark = (x: Item) => (isFlight(x) ? "plane" : x.category === "이동" ? modeIcon(x.mode) : undefined);
const ALL = -1; // 날짜 칩 [전체]
function numbering(items: Item[], from = 0) {
  let n = from;
  return items.map((x) => { if (x.virt) return { n: 0 }; const m = modeMark(x); return x.category === "메모" ? { mark: "dot" as const, n: 0 } : m ? { mark: m, n: 0 } : hasPos(x) ? { n: ++n } : { n: 0 }; });
}
function km(a: Item, b: Item) {
  const R = 6371, r = Math.PI / 180;
  const dLat = (b.lat! - a.lat!) * r, dLng = (b.lng! - a.lng!) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat! * r) * Math.cos(b.lat! * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
/* 거리 칩 ("직선" 표기는 2026-11-25 마루님이 뺌) */
const distText = (d: number) => (d < 1 ? `${Math.max(10, Math.round(d * 100) * 10)}m` : d < 100 ? `${d.toFixed(1)}km` : `${Math.round(d)}km`);

/*
  연박, 체크아웃 날 숙소 카드 (2026-11-17 마루님 "기본은 맨 위, 위치 조정 가능, 거리 계산에도 들어가게") :
  앞날 체크인한 숙소를 그날 목록에 화면용 카드로 끼운다. 자리는 숙소 details._at 의 "몇 박째 → 바로 앞 장소 id". 없으면 맨 위 (체크아웃 먼저)
*/
const real = (l: Item[]) => l.filter((x) => !x.virt);
function withStays(cols: Item[][], U: number): Item[][] {
  return cols.map((list, c) => {
    if (c === U) return list;
    const vs = cols.slice(0, c).flatMap((l, d) => l.filter((it) => it.category === "숙소" && it.nights && it.id && c - d <= it.nights).map((it): Item => {
      const out = c - d === it.nights;
      return { ...it, id: `stay:${it.id}:${c}`, time: undefined, timeEnd: undefined, editedKey: undefined, nights: undefined, desc: undefined, cost: undefined, cur: undefined, detail: out && it.checkout ? `체크아웃 ${it.checkout}` : undefined, virt: { id: it.id!, n: c - d + 1, out, key: String(c - d) } };
    })).sort((a, b) => Number(b.virt!.out) - Number(a.virt!.out));
    const rows = [...list], top: Item[] = [];
    for (const v of vs) {
      const after = v.stayAt?.[v.virt!.key];
      let at = after ? rows.findIndex((x) => x.id === after) : -1;
      if (at < 0) { top.push(v); continue; }
      while (rows[at + 1]?.virt) at++;
      rows.splice(at + 1, 0, v);
    }
    return [...top, ...rows];
  });
}
/* 목록에서 연박 카드 자리가 저장된 것과 다르면 바꿀 것 */
const stayMoves = (list: Item[]) => list.flatMap((v, i) => {
  if (!v.virt) return [];
  const after = real(list.slice(0, i)).pop()?.id ?? "";
  return (v.stayAt?.[v.virt.key] ?? "") === after ? [] : [{ v, after }];
});

/*
  일정 검색 (2026-11-17 마루님 "원하는 항목을 빨리 찾게") : 여행 전체(모든 일차 + 날짜 미정)에서
  장소 이름, 메모, 분류, 주소, 맞춤 칸 한 줄(편명, 예약번호, 메뉴 등), 이동 출발지와 도착지를 찾는다. 띄어쓰기와 대소문자는 무시
*/
const norm = (t: string) => t.toLowerCase().replace(/\s+/g, "");
function findIn(x: Item, q: string): string | null {
  const fields = [x.title, x.category, x.desc, x.detail, x.addr, x.posName, x.arrive?.name];
  const hit = fields.find((f) => f && norm(f).includes(q));
  if (hit === undefined) return null;
  return hit === x.title || hit === x.category ? (x.detail || x.addr || "") : hit;
}

export function DayBoard({ tripId, start, days, undated, editable, canAdd, user, initialDay, jumpUndated }: Props) {
  const len = days.length;
  const U = len; // 날짜 미정 칸 번호
  const fromProps = useCallback(() => withStays([...days.map((d) => d.items), undated], len), [days, undated, len]);
  const [cols, setCols] = useState<Item[][]>(fromProps);
  const [dragId, setDragId] = useState<string | null>(null);
  const [sel, setSel] = useState(jumpUndated && undated.length ? U : initialDay === 0 && days.length > 1 ? ALL : Math.min(Math.max(initialDay, 1), len) - 1); // ALL = 전체 (2026-11-16 마루님)
  const [editing, setEditing] = useState(false);
  const [finding, setFinding] = useState(false); // 검색 창
  const [q, setQ] = useState("");
  const [jump, setJump] = useState<string | null>(null); // 검색 결과를 누르면 그 카드로
  const closeFind = () => { setFinding(false); setQ(""); };
  const [viewing, setViewing] = useState<{ files: ViewFile[]; start: number } | null>(null); // 카드 사진 크게 보기
  const [memo, setMemo] = useState<{ it: Item; warn?: string } | null>(null); // 카드 미리보기 창 (메모 → 모든 카드, 2026-11-17 마루님)
  const [more, setMore] = useState(false); // 점 세 개 메뉴 (검색, 편집)
  const moreRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!more) return;
    const away = (e: PointerEvent) => { if (!moreRef.current?.contains(e.target as Node)) setMore(false); };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setMore(false);
    addEventListener("pointerdown", away); addEventListener("keydown", esc);
    return () => { removeEventListener("pointerdown", away); removeEventListener("keydown", esc); };
  }, [more]);
  const swipe = useRef<{ x: number; y: number } | null>(null); // 일정 좌우로 밀어 날짜 넘기기 (2026-11-16 마루님)
  const [overCol, setOverCol] = useState<number | null>(null); // 끄는 중 날짜 칩 위
  const [msg, setMsg] = useState("");
  const colsRef = useRef(cols);
  colsRef.current = cols;
  const before = useRef<Item[][]>(cols);
  const rows = useRef(new Map<string, HTMLLIElement>());
  const nav = useRef<HTMLElement>(null);
  const sheet = useRef<HTMLElement>(null);
  const lastY = useRef(0);
  const overRef = useRef<number | null>(null);
  const busy = useRef(false);
  /*
    길게 눌러 옮기기 (2026-11-25 마루님, 0.62.2 에서 뺐던 것을 스크롤과 안 겹치게 다시) :
    - 0.4초 동안 8px 넘게 움직이거나 화면이 스크롤되면 스크롤로 보고 취소. 가만히 누르고 있을 때만 카드가 떠오르며 시작
    - 시작한 뒤에만 스크롤을 막는다. 막는 touchmove 는 목록에 처음부터 (passive: false) 달아 둔다 (아이폰은 도중에 단 것을 안 듣는다)
    - 화면 아래, 위 끝에서는 아래 자동 스크롤 effect 가 목록을 움직인다. 위 날짜 칩에 놓으면 그 날로
    - 길게 누를 때 뜨는 글자 선택, 사진 저장 메뉴는 카드 줄에서 끈다
  */
  const dragging = useRef<"touch" | "pointer" | null>(null);
  const press = useRef<{ id: string; x: number; y: number; timer: ReturnType<typeof setTimeout>; src: "touch" | "pointer" } | null>(null);
  const noClickUntil = useRef(0);
  const listRef = useRef<HTMLDivElement>(null);
  const cancelPress = () => { if (press.current) { clearTimeout(press.current.timer); press.current = null; } };
  const startPress = (id: string, x: number, y: number, src: "touch" | "pointer") => {
    cancelPress();
    const timer = setTimeout(() => {
      press.current = null;
      if (busy.current) return; // 앞의 저장이 끝나기 전
      before.current = colsRef.current; lastY.current = y; dragging.current = src;
      try { navigator.vibrate?.(15); } catch { /* 진동이 없는 기기 (아이폰) */ }
      try { getSelection()?.removeAllRanges(); } catch { /* 없음 */ }
      setDragId(id); setMsg(""); setUndo(null);
    }, 400);
    press.current = { id, x, y, timer, src };
  };
  const pressMoved = (x: number, y: number) => { const p = press.current; if (p && Math.hypot(x - p.x, y - p.y) > 8) cancelPress(); };
  /* 편집 모드 (2026-11-17 마루님 참고 화면) : 동그라미로 여러 개 고르고 아래 바에서 [날짜 이동] [삭제하기] */
  const [picked, setPicked] = useState<string[]>([]);
  const [moving, setMoving] = useState(false); // 옮길 날 고르기 창
  const [askDel, setAskDel] = useState(false); // 삭제 확인
  const togglePick = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const endEdit = () => { setEditing(false); setPicked([]); setMoving(false); };
  // 편집 중에는 아래 탭바를 숨기고 편집 바만 (globals.css body[data-editing])
  useEffect(() => {
    document.body.toggleAttribute("data-editing", editing);
    return () => document.body.removeAttribute("data-editing");
  }, [editing]);
  const [undo, setUndo] = useState<{ c: number; items: Item[] } | null>(null); // 동선 정렬 되돌리기

  /*
    고친 사람 표시는 한 번만 (2026-11-16 마루님 "새로고침하면 안 뜨게") : 이 기기에서 처음 본 수정만 얼굴을 보이고,
    보이자마자 기억해 둔다(localStorage, 최근 300개). 지금 화면에서는 그대로 두고 다음에 열 때부터 안 보인다
  */
  const [seen, setSeen] = useState<Set<string> | null>(null);
  useEffect(() => {
    const KEY = "kkuk-seen-edits";
    let old: string[] = [];
    try { old = JSON.parse(localStorage.getItem(KEY) ?? "[]"); if (!Array.isArray(old)) old = []; } catch { old = []; }
    setSeen((s) => s ?? new Set(old));
    const now = [...days.flatMap((d) => d.items), ...undated].flatMap((x) => (x.editedKey ? [x.editedKey] : []));
    if (!now.length) return;
    try { localStorage.setItem(KEY, JSON.stringify([...new Set([...old, ...now])].slice(-300))); } catch { /* 저장이 막혀도 표시만 계속된다 */ }
  }, [days, undated]);
  const showEditor = (it: Item) => !!it.editedKey && !!seen && !seen.has(it.editedKey);

  /* 알림은 4초 뒤 사라진다 (되돌리기가 있으면 6초) */
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => { setMsg(""); setUndo(null); }, undo ? 6000 : TOAST_MS);
    return () => clearTimeout(t);
  }, [msg, undo]);

  /* 한 날의 순서를 통째로 바꿔 저장 (동선 정렬, 되돌리기) */
  const applyDay = async (c: number, items: Item[], ok: string, keepUndo: { c: number; items: Item[] } | null) => {
    const prev = colsRef.current;
    const next = prev.map((x, i) => (i === c ? items : x));
    setCols(next); colsRef.current = next; setMsg(""); setUndo(null); busy.current = true;
    const was = new Map(prev[c].map((x) => [x.id, x.time ?? null]));
    const times = real(items).filter((x) => (x.time ?? null) !== was.get(x.id)).map((x) => ({ id: x.id!, time: x.time ?? null }));
    const t = times.length ? await safeCall(() => setItemTimes(tripId, times)) : undefined;
    const ids = real(items).map((x) => x.id!);
    const r = t?.error ? t : (await saveStays(items)) ?? (ids.length ? await safeCall(() => reorderPlaces(tripId, ids)) : undefined);
    busy.current = false;
    if (r?.error) { setCols(prev); setMsg(r.error); } else { setMsg(ok); setUndo(keepUndo); }
  };
  /* 연박 카드 자리 저장. 실패하면 그 결과를 돌려준다 */
  const saveStays = async (list: Item[]) => {
    for (const { v, after } of stayMoves(list)) {
      const r = await safeCall(() => setStayAt(tripId, v.virt!.id, v.virt!.key, after));
      if (r?.error) return r;
      v.stayAt = { ...v.stayAt, [v.virt!.key]: after };
    }
    return undefined;
  };
  const router = useRouter();
  /* 영업시간 경고 (그날 날짜 기준). 날짜 미정이면 없음 */
  const hoursOf = (it: Item, c: number) => (c === U || c === ALL || !it.hours ? undefined : hoursWarning(it.hours, addDays(start, c), it.time));
  const hoursCount = (list: Item[], c: number) => real(list).filter((x) => hoursOf(x, c)).length;
  const sortRoute = (c: number) => {
    if (busy.current) return; // 앞의 저장이 끝나기 전에 또 누르면 무시
    const cur = colsRef.current[c];
    const next = routeOrder(cur);
    if (!next) { setUndo(null); setMsg("시간을 정하지 않은 관광, 쇼핑 장소가 2곳 이상이어야 순서를 바꿀 수 있어요. 시간을 정한 곳과 지도 위치가 없는 곳은 그대로 둬요"); return; }
    if (next.every((x, i) => x === cur[i])) { setUndo(null); setMsg("이미 가장 짧은 동선이에요"); return; }
    // 정리한 날에 영업시간이 안 맞는 곳이 있으면 같이 알린다 (2026-11-25)
    const n = hoursCount(next, c);
    void applyDay(c, next, `가까운 순서로 동선을 정리했어요${n ? `. 영업시간이 안 맞는 곳이 ${n}곳 있어요` : ""}`, { c, items: cur });
  };

  /* 고른 것 한꺼번에 삭제 (확인 창 한 번). 하나씩 저장하고, 실패하면 새로 불러와 맞춘다 */
  const removeMany = async () => {
    if (busy.current || !picked.length) return;
    const ids = picked;
    const prev = colsRef.current;
    const next = prev.map((c) => c.filter((x) => !ids.includes(x.id!)));
    setCols(next); colsRef.current = next; setMsg(""); setUndo(null); busy.current = true;
    let err = "";
    for (const id of ids) {
      const r = await safeCall(() => deletePlace(tripId, id));
      if (r?.error) { err = r.error; break; }
    }
    busy.current = false; setPicked([]);
    if (err) { setMsg(err); router.refresh(); } else setMsg(`${ids.length}개를 삭제했어요`);
  };
  /* 고른 것을 다른 날 맨 뒤로 (지금 순서 그대로) */
  const moveMany = async (target: number) => {
    setMoving(false);
    if (busy.current || !picked.length) return;
    const prev = colsRef.current;
    const moved = prev.flat().filter((x) => picked.includes(x.id!));
    const base = prev[target].filter((x) => !picked.includes(x.id!));
    const next = prev.map((c, i) => (i === target ? [...base, ...moved] : c.filter((x) => !picked.includes(x.id!))));
    setCols(next); colsRef.current = next; setMsg(""); setUndo(null); busy.current = true;
    let err = "";
    for (let k = 0; k < moved.length; k++) {
      const ids = real([...base, ...moved.slice(0, k + 1)]).map((x) => x.id!);
      const r = await safeCall(() => moveItem(tripId, moved[k].id!, target === U ? null : target, ids));
      if (r?.error) { err = r.error; break; }
    }
    busy.current = false; setPicked([]);
    const n = hoursCount(moved, target);
    if (err) { setMsg(err); router.refresh(); } else setMsg(`${moved.length}개를 ${target === U ? "날짜 미정" : `${target + 1}일차`}로 옮겼어요${n ? `. 영업시간이 안 맞는 곳이 ${n}곳 있어요` : ""}`);
  };

  // 저장 뒤나 다른 사람이 고쳐서 새 목록이 오면 맞춘다 (끄는 중, 저장 중에는 그대로)
  useEffect(() => { if (!dragId && !busy.current) setCols(fromProps()); }, [fromProps]); // eslint-disable-line react-hooks/exhaustive-deps

  /*
    뒤로 왔을 때 보던 날 그대로 (2026-11-17 마루님 "3일차에서 장소 상세 갔다 뒤로가면 1일차") :
    앱이 기억해 둔 예전 화면(초기값 1일차)이 다시 그려져도, 주소(?day=)나 이 탭에서 마지막으로 본 날로 맞춘다
  */
  const dayKey = `kkuk:day:${tripId}`;
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    const q = new URLSearchParams(location.search);
    let v: string | null = q.get("undated") ? "u" : q.get("day");
    if (!v) { try { v = sessionStorage.getItem(dayKey); } catch { v = null; } }
    const c = v === "u" ? (undated.length ? U : null) : v === "all" ? (len > 1 ? ALL : null) : v && /^\d+$/.test(v) ? Math.min(Math.max(Number(v), 1), len) - 1 : null;
    if (c != null && c !== sel) setSel(c);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* 고른 날 : 칩을 가운데로, 주소에 남기기 */
  useEffect(() => {
    try { sessionStorage.setItem(dayKey, sel === U ? "u" : sel === ALL ? "all" : String(sel + 1)); } catch { /* 기억 못 해도 주소에 남는다 */ }
    nav.current?.querySelector<HTMLElement>(`[data-col="${sel}"]`)?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
    history.replaceState(history.state, "", `/trips/${tripId}?${sel === U ? "undated=1" : sel === ALL ? "day=all" : `day=${sel + 1}`}`);
  }, [sel, tripId, U, dayKey]);

  // 위에 고정된 여행 탭 줄만큼 덜 올린다 (2026-11-17)
  const tabsH = () => (document.querySelector<HTMLElement>("[data-trip-tabs]")?.offsetHeight ?? 0);
  const sheetTop = () => (sheet.current ? sheet.current.getBoundingClientRect().top + scrollY - tabsH() : 0);
  const pickDay = (c: number) => {
    setSel(c); setUndo(null); setPicked([]); if (c === ALL) endEdit(); // 전체에서는 편집하지 않는다
    // 시트를 끌어 올려 둔 상태면 새 날의 맨 위부터
    if (scrollY > sheetTop()) scrollTo({ top: sheetTop(), behavior: "smooth" });
  };
  const toggleSheet = () => scrollTo({ top: scrollY < sheetTop() - 8 ? sheetTop() : 0, behavior: "smooth" });

  const where = (list: Item[][], id: string) => {
    for (let c = 0; c < list.length; c++) { const i = list[c].findIndex((x) => x.id === id); if (i >= 0) return { c, i }; }
    return null;
  };

  const save = async (id: string) => {
    const prev = before.current;
    const now = colsRef.current;
    const a = where(prev, id); const b = where(now, id);
    if (!a || !b) return;
    if (now[b.c][b.i].virt && a.c !== b.c) { setCols(prev); colsRef.current = prev; setMsg("연박 숙소 카드는 그날 안에서만 옮길 수 있어요"); return; }
    const ids = real(now[b.c]).map((x) => x.id!);
    const same = a.c === b.c && ids.join() === real(prev[a.c]).map((x) => x.id).join();
    const stays = [...stayMoves(now[b.c]), ...(a.c !== b.c ? stayMoves(now[a.c]) : [])];
    if (same && !stays.length) return;
    setMsg(""); busy.current = true;
    const r = (await saveStays(now[b.c])) ?? (a.c !== b.c ? await saveStays(now[a.c]) : undefined) ?? (same ? undefined : a.c === b.c
      ? await safeCall(() => reorderPlaces(tripId, ids))
      : await safeCall(() => moveItem(tripId, id, b.c === U ? null : b.c, ids)));
    busy.current = false;
    if (r?.error) { setCols(prev); setMsg(r.error); }
    else {
      // 다른 날로 옮겼는데 그날 쉬거나 문 닫는 시간이면 같이 알린다 (2026-11-25)
      const w = a.c !== b.c ? hoursOf(now[b.c][b.i], b.c) : undefined;
      setMsg(a.c === b.c ? "순서를 바꿨어요" : `${b.c === U ? "날짜 미정" : `${b.c + 1}일차`}로 옮겼어요${w ? `. ${w}` : ""}`);
    }
  };

  /* 끄는 자리 계산 : 고른 날 안에서 몇 번째인지 */
  const place = (id: string, y: number) => {
    const list = colsRef.current;
    const at = where(list, id);
    if (!at) return;
    const others = list[at.c].filter((x) => x.id !== id);
    let idx = 0;
    for (const o of others) {
      const el = rows.current.get(o.id!);
      if (el) { const r = el.getBoundingClientRect(); if (y > r.top + r.height / 2) idx++; }
    }
    const row = [...others.slice(0, idx), list[at.c][at.i], ...others.slice(idx)];
    if (row.some((x, j) => x !== list[at.c][j])) setCols(list.map((c, i) => (i === at.c ? row : c)));
  };
  /* 날짜 칩에 놓으면 그 날 맨 뒤로 */
  const moveTo = (id: string, target: number) => {
    const list = colsRef.current;
    const at = where(list, id);
    if (!at || at.c === target) return false;
    const me = list[at.c][at.i];
    if (me.virt) return false; // 연박 카드는 다른 날로 못 옮긴다
    const next = list.map((c, i) => (i === at.c ? c.filter((x) => x.id !== id) : i === target ? [...c, me] : c));
    setCols(next); colsRef.current = next;
    return true;
  };

  /* 끄는 동안의 움직임과 놓기는 창(window)에서 받는다 (2026-11-15 버그 : 버튼에서 받으면 놓기를 놓친다) */
  const moveAt = (id: string, x: number, y: number) => {
    lastY.current = y;
    const chip = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-col]");
    const c = chip ? Number(chip.dataset.col) : null;
    overRef.current = c; setOverCol(c);
    if (c == null) place(id, y);
  };
  useEffect(() => {
    if (!dragId) return;
    const id = dragId;
    const drop = () => {
      const c = overRef.current;
      overRef.current = null; setOverCol(null); setDragId(null); dragging.current = null;
      noClickUntil.current = Date.now() + 500; // 놓자마자 카드 상세가 열리지 않게
      if (c != null) moveTo(id, c);
      void save(id);
    };
    /* 길게 눌러 시작한 손가락 끌기 : 움직임은 목록의 touchmove(아래 effect)가 받고, 놓기만 여기서. 포인터 취소는 무시 (2026-11-25) */
    if (dragging.current === "touch") {
      addEventListener("touchend", drop);
      addEventListener("touchcancel", drop);
      return () => { removeEventListener("touchend", drop); removeEventListener("touchcancel", drop); };
    }
    const move = (e: PointerEvent) => moveAt(id, e.clientX, e.clientY);
    addEventListener("pointermove", move);
    addEventListener("pointerup", drop);
    addEventListener("pointercancel", drop);
    // 길게 눌러 옮기는 중에는 화면이 스크롤되지 않게 (휴대폰)
    const noScroll = (e: TouchEvent) => e.preventDefault();
    addEventListener("touchmove", noScroll, { passive: false });
    return () => { removeEventListener("pointermove", move); removeEventListener("pointerup", drop); removeEventListener("pointercancel", drop); removeEventListener("touchmove", noScroll); };
  }, [dragId]); // eslint-disable-line react-hooks/exhaustive-deps

  /* 끄는 동안 화면 아래 끝 근처면 저절로 스크롤 (위쪽은 날짜 칩이 있어 시트 맨 위까지만) */
  useEffect(() => {
    if (!dragId) return;
    let raf = 0;
    const tick = () => {
      const y = lastY.current; const h = innerHeight; const edge = 96;
      const navBottom = nav.current?.getBoundingClientRect().bottom ?? 0;
      const up = y < navBottom + 48 && y > navBottom && scrollY > sheetTop() ? -6 : 0;
      const v = up || (y > h - edge ? Math.ceil((y - (h - edge)) / 6) : 0);
      if (v) { scrollBy(0, v); if (overRef.current == null) place(dragId, y); }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [dragId]); // eslint-disable-line react-hooks/exhaustive-deps

  const onKey = (e: React.KeyboardEvent, id: string) => {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    e.preventDefault();
    const list = colsRef.current;
    const at = where(list, id);
    if (!at) return;
    const up = e.key === "ArrowUp";
    const next = list.map((c) => [...c]);
    const [me] = next[at.c].splice(at.i, 1);
    if (up && at.i > 0) next[at.c].splice(at.i - 1, 0, me);
    else if (!up && at.i < list[at.c].length - 1) next[at.c].splice(at.i + 1, 0, me);
    else if (me.virt) return; // 연박 카드는 그날 안에서만
    else if (up && at.c > 0) next[at.c - 1].push(me);
    else if (!up && at.c < U) next[at.c + 1].unshift(me);
    else return;
    before.current = list;
    setCols(next); colsRef.current = next;
    void save(id);
    requestAnimationFrame(() => rows.current.get(id)?.querySelector<HTMLButtonElement>("button[data-grip]")?.focus());
  };

  const canSort = editable && cols.flat().every((i) => i.id);
  const canPress = canSort && !editing && sel !== ALL && !finding; // 길게 눌러 옮기기 (전체 보기, 편집, 검색 중에는 안 함)
  const touchMove = useRef<(e: TouchEvent) => void>(() => {});
  touchMove.current = (e) => {
    const t = e.touches[0];
    if (!t) return;
    if (dragging.current === "touch" && dragId) { if (e.cancelable) e.preventDefault(); moveAt(dragId, t.clientX, t.clientY); return; }
    pressMoved(t.clientX, t.clientY);
  };
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const tm = (e: TouchEvent) => touchMove.current(e);
    const sc = () => { if (press.current) cancelPress(); }; // 기다리는 동안 스크롤이 시작되면 취소
    el.addEventListener("touchmove", tm, { passive: false });
    addEventListener("scroll", sc, { passive: true });
    return () => { el.removeEventListener("touchmove", tm); removeEventListener("scroll", sc); cancelPress(); };
  }, []);
  const showUndated = cols[U].length > 0 || sel === U || (editable && !!dragId);
  // 전체 : 날마다 묶어 이어서 보인다. 번호는 1일차부터 이어서 (지도 핀과 같은 번호)
  const groups = useMemo(() => (sel === ALL ? [...cols.map((items, c) => ({ c, items }))].filter((g) => g.c < U || g.items.length) : [{ c: sel, items: cols[sel] ?? [] }]), [cols, sel, U]);
  const groupMarks = useMemo(() => { let n = 0; return groups.map((g) => { const m = numbering(g.items, n); n = Math.max(n, ...m.map((x) => x.n)); return m; }); }, [groups]);
  const cur = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  // d : 몇 일차인지. 전체 보기에서 날마다 점선을 끊는다 (2026-11-25)
  const points = useMemo<DayPoint[]>(() => groups.flatMap((g, gi) => g.items.flatMap((x, i) => { const n = groupMarks[gi][i].n; return n && hasPos(x) ? [{ lat: x.lat!, lng: x.lng!, n, title: x.title, d: g.c }, ...(x.arrive ? [{ lat: x.arrive.lat, lng: x.arrive.lng, n, title: `${x.arrive.name || "도착"} (도착)`, d: g.c }] : [])] : []; })), [groups, groupMarks]);
  /* 지도에 안 보이는 장소 (위치 없음. 메모, 이동, 연박 카드는 원래 지도에 없어서 뺀다) (2026-11-25) */
  const offMap = useMemo(() => cur.filter((x) => x.id && !x.virt && x.category !== "메모" && !modeMark(x) && !hasPos(x)), [cur]);
  const onPin = useCallback((n: number) => {
    const list = sel === ALL ? colsRef.current.flat() : colsRef.current[sel] ?? [];
    const i = numbering(list).findIndex((m) => m.n === n);
    const id = list[i]?.id;
    const el = id ? rows.current.get(id) : null;
    if (!el) return;
    scrollTo({ top: Math.max(el.getBoundingClientRect().top + scrollY - (nav.current?.offsetHeight ?? 0) - tabsH() - 24, sheetTop()), behavior: "smooth" });
    el.animate?.([{ transform: "scale(1.02)" }, { transform: "scale(1)" }], { duration: 400 });
  }, [sel]);
  /* 검색 결과로 고른 카드까지 내려가 살짝 흔들어 보인다 */
  useEffect(() => {
    if (!jump) return;
    const t = setTimeout(() => {
      const el = rows.current.get(jump);
      setJump(null);
      if (!el) return;
      scrollTo({ top: Math.max(el.getBoundingClientRect().top + scrollY - (nav.current?.offsetHeight ?? 0) - tabsH() - 24, 0), behavior: "smooth" });
      el.animate?.([{ transform: "scale(1.03)" }, { transform: "scale(1)" }], { duration: 500 });
    }, 80);
    return () => clearTimeout(t);
  }, [jump, sel]);
  const results = useMemo(() => {
    const k = norm(q);
    if (!k) return [];
    return cols.map((list, c) => ({ c, hits: list.flatMap((x) => { if (x.virt || !x.id) return []; const m = findIn(x, k); return m === null ? [] : [{ x, m }]; }) })).filter((g) => g.hits.length);
  }, [q, cols]);

  /*
    카드 경고 (2026-11-25) : 영업시간 + 앞 장소보다 이른 시간 (손으로 순서를 바꿔 시간이 거꾸로 된 것)
    밤 8시 넘은 곳 뒤의 새벽 6시 전은 다음 날 새벽으로 보고 넘어간다
  */
  const warnAt = (list: Item[], i: number, c: number) => {
    const x = list[i];
    const out: string[] = [];
    const h = hoursOf(x, c);
    if (h) out.push(h);
    if (x.time && !x.virt) {
      const p = list.slice(0, i).reverse().find((y) => y.time && !y.virt);
      if (p && p.time! > x.time && !(p.time! >= "20:00" && x.time < "06:00")) out.push("앞 장소보다 이른 시간이에요");
    }
    return out.length ? out.join(", ") : undefined;
  };

  /* 장소 사이 거리 : 앞쪽에서 가장 가까운 위치 있는 장소와 (위치 없는 곳, 메모는 건너뜀) */
  const gapBefore = (list: Item[], i: number) => {
    const x = list[i];
    if (!hasPos(x) || x.category === "메모") return null;
    // 이동 앞은 출발지까지, 이동 뒤는 도착지에서 (도착지가 없으면 출발지) (2026-11-17 마루님)
    for (let j = i - 1; j >= 0; j--) { const p = list[j]; if (p.category !== "메모" && hasPos(p)) return distText(km(p.arrive ? { ...p, lat: p.arrive.lat, lng: p.arrive.lng } : p, x)); }
    return null;
  };

  const d = sel === U || sel === ALL ? null : addDays(start, sel);
  const chip = (c: number, label: string) => {
    const on = sel === c, over = overCol === c;
    const empty = c !== U && c !== ALL && !cols[c]?.length; // 빈 날은 흐린 점선 칩 (2026-11-16 마루님 "빈 날 접기")
    return (
      <button key={c} type="button" data-col={c} onClick={() => pickDay(c)} aria-current={on ? "true" : undefined}
        aria-label={c === ALL ? "전체 일정" : c === U ? `날짜 미정 ${cols[U].length}곳` : `${c + 1}일차, ${md(addDays(start, c))} ${weekday(addDays(start, c))}요일`}
        className={"press flex h-10 flex-none items-center rounded-full px-4 text-sub font-bold transition-colors " +
          (over ? "bg-point-soft text-point-text ring-2 ring-point" : on ? "bg-btn text-on-btn" : dragId ? "border border-dashed border-point bg-surface text-ink" : empty ? "border border-dashed border-line-strong bg-transparent text-ink-sub/70" : "border border-line-strong bg-surface text-ink-sub")}>
        {label}
      </button>
    );
  };

  /* 날짜별 예상 비용 (2026-11-16 마루님). 통화가 섞이면 통화마다 따로 */
  const dayCost = (() => {
    const sum = new Map<string, number>();
    for (const it of cur) if (it.cost != null && it.cur) sum.set(it.cur, (sum.get(it.cur) ?? 0) + it.cost);
    return [...sum].map(([c, n]) => formatMoney(n, c)).join(", ");
  })();


  return (
    <>
      {/* 지도 : 스크롤해도 그 자리에 있고, 시트가 그 위로 올라온다 */}
      <div className="sticky top-[var(--tabs-h,0px)] z-0 mt-3 h-[40dvh] min-h-[240px]">
        <DayMap points={points} onPick={onPin} className="size-full" />
        {/* 지도에 없는 장소 알림 (2026-11-25 마루님) : 누르면 첫 번째 카드로 */}
        {offMap.length > 0 && !finding && (
          <button type="button" onClick={() => { const id = offMap[0].id!; setJump(id); }}
            className="press absolute left-3 top-3 z-[1] flex h-8 items-center gap-1 rounded-full bg-surface/95 px-3 text-tiny font-bold text-ink-sub shadow-float">
            <Icon name="pin" size={14} />지도에 없는 장소 {offMap.length}곳
          </button>
        )}
        {/* "위치 없는 장소 n곳 찾기" 단추는 2026-11-17 마루님 "필요 없을 것 같아" 로 뺌 (fillTripCoords 는 남김) */}
      </div>

      <section ref={sheet} aria-label="일정" className="relative z-10 -mt-6 flex min-h-[100dvh] flex-col rounded-t-[28px] bg-bg pb-8 shadow-[0_-6px_20px_rgb(0_0_0/0.06)]">
        <button type="button" onClick={toggleSheet} aria-label="일정 펼치기, 접기" className="flex h-6 w-full flex-none items-end justify-center">
          <span className="h-1 w-10 rounded-full bg-line-strong" />
        </button>
        <nav ref={nav} aria-label="날짜" className="sticky top-[var(--tabs-h,0px)] z-20 flex items-center gap-1 rounded-t-[28px] bg-bg py-3 pl-1 pr-3">
          {/* 칩 줄 양 끝은 바탕으로 부드럽게 사라지게 (2026-11-16 마루님 "칼같이 잘린다"). 여백을 안쪽에 두어 처음과 끝 칩은 흐려지지 않는다 */}
          {finding ? (
            /* 검색 (2026-11-17 마루님 "다른 페이지 말고 지금 화면에서") : 날짜 칩 자리에 검색창, 결과는 아래 일정 자리에 */
            <div className="flex min-w-0 flex-1 items-center gap-1 pl-4">
              <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-full border border-line-strong bg-surface px-3.5">
                <Icon name="search" size={17} className="flex-none text-ink-sub" />
                <input autoFocus type="search" name="q" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Escape" && closeFind()}
                  placeholder="장소, 메모, 주소, 편명 찾기" aria-label="일정에서 찾기" className="h-full min-w-0 flex-1 bg-transparent text-[16px] text-ink outline-none placeholder:text-ink-sub" />
                {q && <button type="button" onClick={() => setQ("")} aria-label="지우기" className="press -mr-1 flex size-7 flex-none items-center justify-center rounded-full bg-surface-soft text-ink-sub"><Icon name="x" size={14} /></button>}
              </label>
              <button type="button" onClick={closeFind} className="press h-10 flex-none px-2 text-sub font-semibold text-ink-sub">닫기</button>
            </div>
          ) : <>
          <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] [mask-image:linear-gradient(to_right,transparent,black_16px,black_calc(100%-28px),transparent)]">
            {len > 1 && chip(ALL, "전체")}
            {days.map((_, c) => chip(c, `${c + 1}일차`))}
            {showUndated && chip(U, `미정 ${cols[U].length}`)}
          </div>
          {/* 검색, 편집을 점 세 개 하나로 (2026-11-17 마루님). 메뉴 모양은 홈 프로필 메뉴와 같게 */}
          {editing ? (
            <button type="button" onClick={endEdit} className="press flex h-10 flex-none items-center rounded-full px-3 text-sub font-bold text-point-text">완료</button>
          ) : sel === ALL || !editable ? (
            /* 전체(또는 고칠 수 없을 때)는 편집이 없으니 점 세 개 대신 검색 버튼만 (2026-11-18 마루님) */
            <button type="button" onClick={() => { setFinding(true); if (scrollY > sheetTop()) scrollTo({ top: sheetTop() }); }} aria-label="일정 검색"
              className="press flex size-10 flex-none items-center justify-center rounded-full border border-line-strong bg-surface text-ink">
              <Icon name="search" size={18} />
            </button>
          ) : (
            <div ref={moreRef} className="relative flex-none">
              <button type="button" onClick={() => setMore((v) => !v)} aria-label="일정 메뉴" aria-haspopup="menu" aria-expanded={more}
                className="press flex size-10 items-center justify-center rounded-full border border-line-strong bg-surface text-ink">
                <Icon name="more" size={18} />
              </button>
              {more && (
                <div role="menu" className="absolute right-0 top-full z-40 mt-1 w-max min-w-28 rounded-[14px] bg-surface p-1 shadow-float">
                  <button role="menuitem" type="button" onClick={() => { setMore(false); setFinding(true); if (scrollY > sheetTop()) scrollTo({ top: sheetTop() }); }}
                    className="press flex h-9 w-full items-center gap-2 rounded-[10px] px-2.5 pr-4 text-left text-sub font-medium text-ink">
                    <Icon name="search" size={16} className="text-ink-sub" />검색
                  </button>
                  <button role="menuitem" type="button" onClick={() => { setMore(false); setEditing(true); setPicked([]); }}
                    className="press flex h-9 w-full items-center gap-2 rounded-[10px] px-2.5 pr-4 text-left text-sub font-medium text-ink">
                    <Icon name="pencil" size={16} className="text-ink-sub" />편집
                  </button>
                </div>
              )}
            </div>
          )}
          </>}
        </nav>
        {viewing && <FileViewer files={viewing.files} start={viewing.start} onClose={() => setViewing(null)} />}
        {finding && (
          <div role="region" aria-label="일정 검색 결과" className="min-h-[40dvh]">
            <div className="px-5 pb-10 pt-1">
              {!q.trim() ? (
                <p className="px-1 py-6 text-center text-sub text-ink-sub">여행 전체 일정에서 장소 이름, 메모, 주소,<br />편명, 예약번호, 메뉴로 찾아요</p>
              ) : results.length === 0 ? (
                <p className="px-1 py-6 text-center text-sub text-ink-sub">&ldquo;{q.trim()}&rdquo;이(가) 들어간 일정이 없어요</p>
              ) : results.map((g) => (
                <section key={g.c} className="mb-4" aria-label={g.c === U ? "날짜 미정" : `${g.c + 1}일차`}>
                  <h3 className="px-1 pb-1.5 text-tiny font-bold text-ink-sub">{g.c === U ? "날짜 미정" : `${g.c + 1}일차 · ${md(addDays(start, g.c))} (${weekday(addDays(start, g.c))})`}</h3>
                  <ul className="divide-y divide-line overflow-hidden rounded-card bg-surface">
                    {g.hits.map(({ x, m }) => (
                      <li key={x.id}>
                        <button type="button" onClick={() => { closeFind(); pickDay(g.c); setJump(x.id!); }}
                          className="press flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left">
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-1.5">
                              {x.time && <span className="flex-none text-tiny font-bold tabular-nums text-ink">{x.time}</span>}
                              <span className="flex-none text-tiny font-semibold text-ink-sub">{x.category}</span>
                            </span>
                            <span className="block truncate text-body font-bold text-ink">{x.category === "메모" ? (x.desc || x.title) : x.title}</span>
                            {m && x.category !== "메모" && <span className="block truncate text-tiny text-ink-sub">{m}</span>}
                          </span>
                          <Icon name="right" size={16} className="flex-none text-ink-sub" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </div>
        )}
        {dragId && <p className="px-5 pb-1 text-tiny font-semibold text-point-text">다른 날로 옮기려면 위 날짜에 놓아 주세요</p>}

        <div className={"flex items-end justify-between gap-2 px-5 pb-3 pt-1 " + (finding ? "hidden" : "")}>
          <h2 className="min-w-0 truncate text-title font-extrabold text-ink">
            {sel === ALL ? <>전체 일정 <span className="font-semibold text-ink-sub">{len}일</span></> : sel === U ? "날짜 미정" : <>{md(d!)} ({weekday(d!)})</> /* 위 칩에 몇 일차인지 보이니 날짜만 (2026-11-17 마루님) */}
            {sel !== U && sel !== ALL && days[sel]?.title && <span className="block truncate text-sub font-semibold text-ink-sub">{days[sel].title}</span>}
            {/* 예상 비용 알약 (2026-11-17 마루님 "이날" 빼고 다듬기) */}
            {dayCost && (
              <span className="mt-1.5 flex w-fit max-w-full items-center gap-1 rounded-full bg-surface-soft px-2.5 py-1 text-tiny font-semibold text-ink-sub">
                예상 경비
                <span className="min-w-0 truncate font-medium text-ink tabular-nums">{dayCost}</span>
              </span>
            )}
          </h2>
          <div className="flex flex-none gap-1.5">
            {editable && sel !== U && sel !== ALL && movableOf(cur) >= 2 && (
              <button type="button" onClick={() => sortRoute(sel)} disabled={!!dragId} aria-label={`${sel + 1}일차 동선 정리`}
                className="press inline-flex h-9 items-center gap-1 rounded-full bg-surface px-3 text-tiny font-bold text-ink">
                <Icon name="refresh" size={15} />동선 정리
              </button>
            )}
          </div>
        </div>

        <div ref={listRef} className={"px-5 " + (finding ? "hidden" : "")}
          onTouchStart={(e) => {
            const t = e.touches[0];
            swipe.current = e.touches.length === 1 && !(e.target as Element).closest("input, textarea, select, [data-grip]") ? { x: t.clientX, y: t.clientY } : null;
          }}
          onTouchEnd={(e) => {
            const s = swipe.current, t = e.changedTouches[0];
            swipe.current = null;
            if (!s || !t || dragId || dragging.current || editing) return;
            const dx = t.clientX - s.x, dy = t.clientY - s.y;
            if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return; // 세로 스크롤과 헷갈리지 않게 가로로 충분히 밀었을 때만
            // 칩 순서 그대로 : 전체 → 1일차 → … → 날짜 미정 (2026-11-16 마루님 "1일차에서 넘기면 전체로")
            const order = [...(len > 1 ? [ALL] : []), ...Array.from({ length: len }, (_, i) => i), ...(showUndated ? [U] : [])];
            const next = order[order.indexOf(sel) + (dx < 0 ? 1 : -1)];
            if (next !== undefined) pickDay(next);
          }}>
          {groups.map((g, gi) => {
            const list = g.items, gm = groupMarks[gi];
            const dayDate = g.c === U ? null : addDays(start, g.c);
            return (
          <section key={g.c} aria-label={g.c === U ? "날짜 미정" : `${g.c + 1}일차`} className={sel === ALL && gi > 0 ? "mt-4" : ""}>
          {/* 전체 : 날마다 머리글 (2026-11-16 마루님) */}
          {sel === ALL && (
            <h3 className="mb-3 flex items-baseline gap-1.5 text-body font-extrabold text-ink">
              {g.c === U ? "날짜 미정" : <>{g.c + 1}일차 <span className="text-sub font-semibold text-ink-sub">{md(dayDate!)} ({weekday(dayDate!)})</span></>}
            </h3>
          )}
          {list.length ? (
            <ol className="flex flex-col" aria-label={g.c === U ? "날짜 미정 장소" : `${g.c + 1}일차 장소`}>
              {list.map((it, i) => {
                const gap = gapBefore(list, i);
                return (
                  <li key={it.id ?? `${g.c}-${i}`} ref={(el) => { if (el && it.id) rows.current.set(it.id, el); }}
                    className={"flex flex-col transition-transform " + (canPress && it.id ? "select-none [-webkit-touch-callout:none] " : "") + (dragId === it.id ? "relative z-10 scale-[1.02] opacity-90 drop-shadow-lg" : "")}
                    {...(canPress && it.id ? {
                      onTouchStart: (e: React.TouchEvent) => { if (e.touches.length !== 1 || (e.target as Element).closest("a, summary")) { cancelPress(); return; } const t = e.touches[0]; startPress(it.id!, t.clientX, t.clientY, "touch"); },
                      onTouchEnd: cancelPress, onTouchCancel: cancelPress,
                      onPointerDown: (e: React.PointerEvent) => { if (e.pointerType === "mouse" && e.button === 0 && !(e.target as Element).closest("a, summary")) startPress(it.id!, e.clientX, e.clientY, "pointer"); },
                      onPointerMove: (e: React.PointerEvent) => { if (e.pointerType === "mouse") pressMoved(e.clientX, e.clientY); },
                      onPointerUp: (e: React.PointerEvent) => { if (e.pointerType === "mouse") cancelPress(); },
                      onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
                      onDragStart: (e: React.DragEvent) => e.preventDefault(),
                    } : {})}
                    onClickCapture={(e) => { if (Date.now() < noClickUntil.current) { e.preventDefault(); e.stopPropagation(); } }}>
                    {gap && !dragId && (
                      <span className={"-mt-2 mb-1 w-fit rounded-full border border-line bg-bg px-2 py-0.5 text-tiny font-bold leading-4 text-ink-sub " + (editing && editable && it.id ? "ml-9" : "-ml-1") /* 편집 중에는 왼쪽 동그라미만큼 카드와 같이 밀림 (2026-11-17 마루님) */}>{gap}</span>
                    )}
                    <div className="flex items-center gap-1">
                      {/* 편집 : 왼쪽 동그라미로 고르기 (카드를 눌러도 골라짐) */}
                      {editing && editable && it.virt && <span aria-hidden className="-ml-2 size-11 flex-none" />}
                      {editing && editable && it.id && !it.virt && (
                        <button type="button" role="checkbox" aria-checked={picked.includes(it.id)} aria-label={`${it.title} 고르기`} disabled={!!dragId}
                          onClick={() => togglePick(it.id!)} className="press -ml-2 flex size-11 flex-none items-center justify-center">
                          <span className={"flex size-6 items-center justify-center rounded-full border-2 transition-colors " + (picked.includes(it.id) ? "border-point bg-point text-white" : "border-line-strong bg-surface")}>
                            {picked.includes(it.id) && <Icon name="check" size={14} strokeWidth={3} />}
                          </span>
                        </button>
                      )}
                      <div className={"min-w-0 flex-1 " + (editing && it.id && !it.virt ? "cursor-pointer select-none" : "")} onClick={editing && editable && it.id && !it.virt ? () => togglePick(it.id!) : undefined}>
                        <PinCard index={gm[i].n} mark={gm[i].mark} time={it.time ?? ""} timeEnd={it.timeEnd} badge={it.virt ? (it.virt.out ? "체크아웃" : `${it.virt.n}박째`) : it.category === "숙소" && it.nights ? `체크인 · ${it.nights}박` : undefined} category={it.category} title={it.title} detail={it.detail}
                          desc={it.desc ?? ""} editedBy={showEditor(it) ? it.editedBy : undefined} editedFace={it.editedFace} editedAgo={it.editedAgo} photo={it.photos?.find((x) => !x.path.endsWith(".pdf"))?.url} onPhoto={it.photos?.length && !editing ? () => setViewing({ files: it.photos!.map((x) => ({ url: x.url, pdf: isPdf(x.path) })), start: Math.max(0, it.photos!.findIndex((x) => !isPdf(x.path))) }) : undefined} photoCount={it.photos?.length} last={i === list.length - 1}
                          href={editable && it.id && !editing ? `/trips/${tripId}/places/${it.virt?.id ?? it.id}` : undefined}
                          onOpen={!editing ? () => setMemo({ it, warn: warnAt(list, i, g.c) }) : undefined}
                          warn={warnAt(list, i, g.c)}
                          corner={!editing && it.category !== "메모" && canMap(it) ? (
                            <a href={mapsDirUrl(it)} target="_blank" rel="noopener noreferrer" aria-label={`${it.title} 길찾기 (구글 지도)`}
                              className="press flex size-8 items-center justify-center rounded-full bg-bg"><Icon name="pin" size={16} className="text-point" /></a>
                          ) : undefined} />
                      </div>
                      {/* 편집 : 오른쪽 손잡이를 끌어 순서 바꾸기, 위 날짜 칩에 놓으면 그 날로 */}
                      {editing && canSort && it.id && (
                        <button type="button" data-grip aria-label={`${it.title} 옮기기. 위아래 화살표로 순서와 날짜를 바꿔요`}
                          className="press -mr-2 flex size-11 flex-none cursor-grab touch-none items-center justify-center rounded-full text-ink-sub active:cursor-grabbing"
                          onKeyDown={(e) => onKey(e, it.id!)}
                          onPointerDown={(e) => { e.preventDefault(); before.current = colsRef.current; lastY.current = e.clientY; dragging.current = "pointer"; setDragId(it.id!); setMsg(""); }}>
                          <Icon name="menu" size={22} />
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : canAdd && user && g.c !== U ? (
            /* 빈 날 칸을 누르면 그날 장소 추가 (2026-11-17) */
            <Link href={`/trips/${tripId}/places/new?day=${g.c + 1}`}
              className={"press flex items-center justify-between gap-2 rounded-pin border-2 border-dashed border-line px-4 " + (sel === ALL ? "min-h-12 py-2" : "min-h-16 py-3")}>
              <span className="text-sub text-ink-sub">아직 장소가 없어요</span>
              <span className="inline-flex flex-none items-center gap-1 text-sub font-bold text-ink"><Icon name="plus" size={16} />장소 추가</span>
            </Link>
          ) : (
            <div className={"flex items-center rounded-pin border-2 border-dashed border-line px-4 " + (sel === ALL ? "min-h-12 py-2" : "min-h-16 py-3")}>
              <span className="text-sub text-ink-sub">{g.c === U ? "날짜를 못 정한 장소가 없어요" : "아직 장소가 없어요"}</span>
            </div>
          )}
          </section>
            );
          })}
        </div>
      </section>

      {msg ? <Toast action={undo ? "되돌리기" : undefined} onAction={() => { if (busy.current || !undo) return; const u = undo; void applyDay(u.c, u.items, "원래 순서로 돌렸어요", null); }}>{msg}</Toast>
        : <span role="status" aria-live="polite" className="sr-only" />}

      {memo && <ItemPreview it={memo.it} warn={memo.warn} editHref={editable && memo.it.id ? `/trips/${tripId}/places/${memo.it.virt?.id ?? memo.it.id}` : undefined} onClose={() => setMemo(null)}
        onPhoto={(i) => setViewing({ files: memo.it.photos!.map((x) => ({ url: x.url, pdf: isPdf(x.path) })), start: i })} />}

      {askDel && <AlertDialog title={`${picked.length}개를 삭제할까요?`} desc="고른 장소와 메모가 일정에서 사라져요. 예약 목록에 넣었다면 거기서도 빠져요"
        confirmLabel="삭제" confirm={() => { setAskDel(false); void removeMany(); }} onClose={() => setAskDel(false)} />}
      {/* 편집 중 아래 바 (2026-11-17 마루님) : 고른 것을 다른 날로, 또는 삭제 */}
      {editing && editable && !dragId && (
        <div className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-[560px] bg-btn text-on-btn pb-[env(safe-area-inset-bottom)]">
          <p className="sr-only" aria-live="polite">{picked.length ? `${picked.length}개 골랐어요` : "고른 것이 없어요"}</p>
          <div className="flex">
            <button type="button" disabled={!picked.length} onClick={() => setMoving(true)}
              className="press flex h-16 flex-1 items-center justify-center gap-2 text-body font-bold disabled:opacity-40">
              <Icon name="swap" size={20} />날짜 이동
            </button>
            <button type="button" disabled={!picked.length} onClick={() => setAskDel(true)}
              className="press flex h-16 flex-1 items-center justify-center gap-2 text-body font-bold disabled:opacity-40">
              <Icon name="trash" size={20} />삭제하기{picked.length ? ` ${picked.length}` : ""}
            </button>
          </div>
        </div>
      )}
      {moving && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setMoving(false)}>
          <div role="dialog" aria-modal="true" aria-label="옮길 날짜" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.key === "Escape" && setMoving(false)}
            className="w-full max-w-[560px] rounded-t-[24px] bg-surface px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-5">
            <h2 className="text-title font-extrabold text-ink">어느 날로 옮길까요?</h2>
            <p className="mt-1 text-sub text-ink-sub">고른 {picked.length}개를 그날 맨 뒤로 옮겨요</p>
            <div className="mt-4 grid max-h-[50vh] grid-cols-3 gap-2 overflow-y-auto">
              {[...Array.from({ length: len }, (_, c) => c), U].filter((c) => c !== sel).map((c, k) => (
                <button key={c} type="button" autoFocus={k === 0} onClick={() => void moveMany(c)}
                  className="press flex h-14 flex-col items-center justify-center rounded-field bg-bg text-ink">
                  {c === U ? <span className="text-sub font-bold">날짜 미정</span> : <>
                    <span className="text-sub font-bold">{c + 1}일차</span>
                    <span className="text-tiny text-ink-sub">{md(addDays(start, c))} ({weekday(addDays(start, c))})</span>
                  </>}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setMoving(false)} className="press mt-3 h-12 w-full rounded-btn text-body font-bold text-ink-sub">취소</button>
          </div>
        </div>
      )}
      {canAdd && !dragId && !editing && <BottomDock align="end"><AddFab user={user} base={`/trips/${tripId}/places/new?day=${sel === U ? "none" : sel === ALL ? 1 : sel + 1}`}
        pick={sel === ALL ? [...Array.from({ length: len }, (_, i) => ({ day: String(i + 1), label: `${i + 1}일차`, sub: `${md(addDays(start, i))} (${weekday(addDays(start, i))})` })), { day: "none", label: "날짜 미정" }] : undefined} /></BottomDock>}
    </>
  );
}

/*
  동선 정리 (2026-11-15) : 가까운 곳부터 차례로 + 엇갈린 길 풀기(2-opt)
  - 움직이지 않는 칸 : 맨 처음(출발점), 맨 끝 숙소(도착점), 이동, 식사, 숙소, 메모, 지도 위치가 없는 곳, 시간을 정한 곳
  - 시간을 정하지 않은 관광, 쇼핑(위치 있음)만 그 칸들 사이 빈자리에서 순서를 바꾼다
  - 시간을 정한 곳은 제자리 (2026-11-25 마루님 : 예전엔 시간이 칸에 남아 14:00 예약이 다른 장소로 넘어갔다)
  - 바꿀 곳이 2곳 미만이면 null
*/
const has = (x: Item) => x.lat != null && x.lng != null;
const isFixed = (x: Item, i: number, last: number) =>
  i === 0 || (i === last && x.category === "숙소") || x.category === "이동" || x.category === "식사" || x.category === "숙소" || x.category === "메모" || !has(x) || !!x.time || !!x.timeEnd;
export const movableOf = (items: Item[]) => items.filter((x, i) => !isFixed(x, i, items.length - 1)).length;

function routeOrder(items: Item[]): Item[] | null {
  const last = items.length - 1;
  const slots = items.map((_, i) => i).filter((i) => !isFixed(items[i], i, last));
  const free = slots.map((i) => items[i]);
  if (free.length < 2) return null;
  const before = [...items.slice(0, slots[0])].reverse().find(has);
  const startAt = before?.arrive ? { ...before, lat: before.arrive.lat, lng: before.arrive.lng } : before; // 이동이면 도착지에서 출발
  const endAt = items.slice(slots[slots.length - 1] + 1).find(has);
  const d = (a: Item, b: Item) => {
    const k = Math.cos(((a.lat! + b.lat!) / 2) * Math.PI / 180);
    return Math.hypot(a.lat! - b.lat!, (a.lng! - b.lng!) * k);
  };
  // 가까운 곳부터
  const left = [...free];
  const path: Item[] = [];
  let at = startAt ?? left.shift()!;
  if (!startAt) path.push(at);
  while (left.length) {
    let bi = 0;
    left.forEach((x, i) => { if (d(at, x) < d(at, left[bi])) bi = i; });
    at = left.splice(bi, 1)[0]; path.push(at);
  }
  // 엇갈린 길 풀기
  const full = () => [...(startAt ? [startAt] : []), ...path, ...(endAt ? [endAt] : [])];
  const len = (p: Item[]) => p.slice(1).reduce((n, x, i) => n + d(p[i], x), 0);
  for (let pass = 0, better = true; better && pass < 50; pass++) {
    better = false;
    for (let i = 0; i < path.length - 1; i++) for (let j = i + 1; j < path.length; j++) {
      const before = len(full());
      const seg = path.slice(i, j + 1).reverse();
      path.splice(i, seg.length, ...seg);
      if (len(full()) + 1e-12 < before) better = true;
      else path.splice(i, seg.length, ...seg.reverse());
    }
  }
  const out = [...items];
  slots.forEach((slot, k) => { out[slot] = path[k]; });
  return out;
}

/*
  오른쪽 아래 + 버튼 (2026-11-16 마루님 "날짜별 장소/메모 버튼과 겹친다") : 누르면 [장소] [메모] 를 골라 지금 보는 날에 넣는다
  [전체] 를 보고 있으면 장소/메모를 고른 뒤 넣을 날을 한 번 더 고른다 (2026-11-17, 무조건 1일차로 들어가던 것)
  로그인 전에는 문지기(로그인 필요 안내)를 거친다
*/
function AddFab({ user, base, pick }: { user: boolean; base: string; pick?: { day: string; label: string; sub?: string }[] }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"" | "place" | "memo">("");
  const round = "press flex size-14 items-center justify-center rounded-full bg-btn text-on-btn shadow-float";
  if (!user) return <GateButton label="장소 추가" className={round}><Icon name="plus" size={26} strokeWidth={2.5} /></GateButton>;
  const item = "press flex h-12 items-center gap-2.5 rounded-full bg-surface pl-4 pr-5 text-body font-bold text-ink shadow-float";
  const close = () => { setOpen(false); setKind(""); };
  const href = (k: "place" | "memo", day?: string) => `${day ? base.replace(/day=[^&]*/, `day=${day}`) : base}${k === "memo" ? "&kind=memo" : ""}`;
  const choose = (k: "place" | "memo") => (e: React.MouseEvent) => { if (pick) { e.preventDefault(); setKind(k); } else close(); };
  return (
    <div className="relative flex flex-col items-end gap-2">
      {open && (
        <>
          <div className="fixed inset-0 -z-10" onClick={close} aria-hidden />
          {kind && pick ? (
            <div role="menu" aria-label={`${kind === "memo" ? "메모" : "장소"}를 넣을 날`} onKeyDown={(e) => e.key === "Escape" && close()}
              className="flex max-h-[55vh] w-56 flex-col gap-1 overflow-y-auto rounded-card bg-surface p-2 shadow-float">
              <p className="px-2 pb-1 pt-1 text-tiny font-bold text-ink-sub">어느 날에 넣을까요?</p>
              {pick.map((d, i) => (
                <Link key={d.day} href={href(kind, d.day)} role="menuitem" autoFocus={i === 0} onClick={close}
                  className="press flex min-h-11 items-center justify-between gap-2 rounded-field px-3 text-sub font-bold text-ink hover:bg-bg">
                  {d.label}{d.sub && <span className="text-tiny font-semibold text-ink-sub">{d.sub}</span>}
                </Link>
              ))}
            </div>
          ) : (
            <div role="menu" aria-label="추가할 것" onKeyDown={(e) => e.key === "Escape" && close()} className="flex flex-col items-end gap-2">
              <Link href={href("place")} role="menuitem" autoFocus className={item} onClick={choose("place")}><Icon name="pin" size={18} className="text-point" />장소</Link>
              <Link href={href("memo")} role="menuitem" className={item} onClick={choose("memo")}><Icon name="pencil" size={18} className="text-ink-sub" />메모</Link>
            </div>
          )}
        </>
      )}
      <button type="button" aria-label={open ? "닫기" : "장소나 메모 추가"} aria-haspopup="menu" aria-expanded={open} onClick={() => (open ? close() : setOpen(true))} className={round}>
        <Icon name="plus" size={26} strokeWidth={2.5} className={"transition-transform " + (open ? "rotate-45" : "")} />
      </button>
    </div>
  );
}

/*
  카드 미리보기 창 (2026-11-17 마루님 "메모를 누르면 모달로 미리보기" → "일정 카드도 메모처럼")
  - 목록 카드에서 줄인 정보 전체 : 시간, 맞춤 칸(예약번호, 편명 등), 주소, 예상 경비, 메모, 첨부
  - 바로 쓰는 버튼 : 번호 복사, 첨부 크게 보기, 길찾기. 맨 아래 [수정] 은 고칠 수 있는 사람에게만 (지금 수정 화면으로)
  - 적어 둔 게 거의 없는 카드(이동 등)도 비어 보이지 않게 안내 한 줄
*/
function ItemPreview({ it, warn, editHref, onClose, onPhoto }: { it: Item; warn?: string; editHref?: string; onClose: () => void; onPhoto: (i: number) => void }) {
  const [copied, setCopied] = useState("");
  useBackClose(onClose); // 휴대폰 뒤로가기는 창만 닫기
  useEffect(() => {
    const back = document.activeElement as HTMLElement | null;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => { window.removeEventListener("keydown", esc); back?.focus?.(); };
  }, [onClose]);
  const isMemo = it.category === "메모";
  const text = isMemo ? it.desc || it.title : it.note; // 장소 메모는 목록에 첫 줄만 들어 있어 전체를 따로 (2026-11-18 마루님 "두 줄이면 안 나와")
  const rows = [
    ...(it.rows ?? []),
    ...(it.addr && !isMemo ? [{ label: "주소", value: it.addr, copy: true }] : []),
    ...(it.cost != null && it.cur ? [{ label: "예상 경비", value: formatMoney(it.cost, it.cur) }] : []),
  ];
  const copy = async (v: string) => {
    try { await navigator.clipboard.writeText(v); setCopied(v); setTimeout(() => setCopied((c) => (c === v ? "" : c)), 1500); } catch { /* 복사를 못 하는 브라우저 */ }
  };
  const when = it.time && it.timeEnd ? `${it.time} → ${it.timeEnd}` : it.time || (it.timeEnd ? `${it.timeEnd} 도착` : "");
  const badge = it.virt ? (it.virt.out ? "체크아웃" : `${it.virt.n}박째`) : it.category === "숙소" && it.nights ? `체크인 · ${it.nights}박` : "";
  const empty = !rows.length && !text && !it.photos?.length && !warn;
  const map = !isMemo && canMap(it);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-scrim px-5 sm:px-8" onClick={onClose}>
      {/* 0.89.3 : 아래 시트 → 화면 가운데 창 (마루님 "시선이 밑으로 가서 불편") */}
      <div role="dialog" aria-modal="true" aria-label={isMemo ? "메모" : it.title} onClick={(e) => e.stopPropagation()}
        className="modal-pop flex max-h-[80dvh] w-full max-w-[420px] flex-col rounded-card bg-surface px-5 pb-5 pt-5 shadow-float">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {isMemo ? <span className="text-sub font-bold text-ink-sub">메모</span> : <CategoryChip category={it.category} />}
            {when && <span className="text-sub text-ink-sub tabular-nums">{when}</span>}
            {badge && <span className="inline-flex h-6 items-center rounded-full border border-accent-text/30 px-2 text-[12px] font-bold text-accent-text">{badge}</span>}
          </div>
          <div className="flex flex-none items-center gap-1">
            {/* 0.92.4 마루님 "수정이 너무 강조" : 수정은 머리 줄 오른쪽 작은 버튼으로 */}
            {editHref && <Link href={editHref} replace /* 창 기록 자리를 수정 화면으로 바꿔, 수정에서 뒤로 한 번이면 일정으로 */ className="press -mr-1 inline-flex h-8 flex-none items-center gap-1 rounded-full bg-surface-soft px-3 text-tiny font-bold text-ink-sub"><Icon name="pencil" size={15} />수정</Link>}
            <button type="button" onClick={onClose} aria-label="닫기" autoFocus className="press -mr-2 flex size-10 flex-none items-center justify-center rounded-full text-ink-sub"><Icon name="x" size={20} /></button>
          </div>
        </div>
        <div className="mt-2 min-h-0 overflow-y-auto">
          {!isMemo && <h2 className="text-title font-extrabold leading-snug text-ink">{it.title}</h2>}
          {warn && <p className="mt-2 flex items-center gap-1 text-sub text-point-text"><Icon name="alert" size={15} />{warn}</p>}
          {!!rows.length && (
            <dl className="mt-4 flex flex-col divide-y divide-line rounded-field bg-bg px-4">
              {rows.map((r) => (
                <div key={r.label} className="flex min-h-12 items-center gap-3 py-2.5">
                  <dt className="w-[4.5rem] flex-none text-tiny text-ink-sub">{r.label}</dt>
                  <dd className="min-w-0 flex-1 break-words text-sub text-ink">{r.value}</dd>
                  {r.copy && (
                    <button type="button" onClick={() => void copy(r.value)} aria-label={`${r.label} 복사`}
                      className="press flex-none rounded-full bg-surface px-2.5 py-1 text-tiny font-bold text-ink">{copied === r.value ? "복사됨" : "복사"}</button>
                  )}
                </div>
              ))}
            </dl>
          )}
          {text && <p className={"whitespace-pre-line break-words text-body text-ink " + (isMemo ? "" : "mt-4")}><Linkify text={text} /></p>}
          {!!it.photos?.length && (
            <div className="mt-4 flex flex-wrap gap-2">
              {it.photos.map((x, i) => (
                <button key={x.path} type="button" onClick={() => onPhoto(i)} aria-label={`첨부 ${i + 1} 크게 보기`} className="press size-20 overflow-hidden rounded-field bg-surface-soft">
                  {isPdf(x.path) ? <span className="flex size-full items-center justify-center text-tiny font-bold text-ink-sub">PDF</span>
                    /* eslint-disable-next-line @next/next/no-img-element */
                    : <img src={x.url} alt="" className="size-full object-cover" />}
                </button>
              ))}
            </div>
          )}
          {empty && !isMemo && (
            <p className="mt-4 rounded-field bg-bg px-4 py-4 text-sub text-ink-sub">
              {editHref ? "아직 적어 둔 정보가 없어요. 수정에서 예약번호, 메모, 사진을 넣을 수 있어요" : "아직 적어 둔 정보가 없어요"}
            </p>
          )}
        </div>
        {map && (
          <a href={mapsDirUrl(it)} target="_blank" rel="noopener noreferrer"
            className="press mt-5 flex h-11 flex-none items-center justify-center gap-1.5 rounded-btn border border-line-strong bg-surface text-sub font-bold text-ink">
            <Icon name="pin" size={17} className="text-point" />길찾기
          </a>
        )}
      </div>
    </div>
  );
}
