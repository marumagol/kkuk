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
import { Icon, PinCard } from "@/components/kit";
import { GateButton, AlertDialog } from "@/components/gate";
import { BottomDock } from "@/components/screen";
import { Toast, TOAST_MS } from "@/components/toast";
import { DayMap, type DayPoint } from "@/components/day-map";
import { reorderPlaces, moveItem, deletePlace, setItemTimes } from "@/app/actions";
import { useRouter } from "next/navigation";
import { safeCall } from "@/lib/safe-call";
import { addDays, md, weekday, type Item } from "@/lib/mock";
import { mapsDirUrl, canMap } from "@/lib/maps-link";
import { formatMoney } from "@/lib/countries";
import { hoursWarning } from "@/lib/hours";
import { modeIcon } from "@/lib/place-fields";

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
  return items.map((x) => { const m = modeMark(x); return x.category === "메모" ? { mark: "dot" as const, n: 0 } : m ? { mark: m, n: 0 } : hasPos(x) ? { n: ++n } : { n: 0 }; });
}
function km(a: Item, b: Item) {
  const R = 6371, r = Math.PI / 180;
  const dLat = (b.lat! - a.lat!) * r, dLng = (b.lng! - a.lng!) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat! * r) * Math.cos(b.lat! * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
const distText = (d: number) => (d < 1 ? `${Math.max(10, Math.round(d * 100) * 10)}m` : d < 100 ? `${d.toFixed(1)}km` : `${Math.round(d)}km`);

export function DayBoard({ tripId, start, days, undated, editable, canAdd, user, initialDay, jumpUndated }: Props) {
  const len = days.length;
  const U = len; // 날짜 미정 칸 번호
  const fromProps = useCallback(() => [...days.map((d) => d.items), undated], [days, undated]);
  const [cols, setCols] = useState<Item[][]>(fromProps);
  const [dragId, setDragId] = useState<string | null>(null);
  const [sel, setSel] = useState(jumpUndated && undated.length ? U : initialDay === 0 && days.length > 1 ? ALL : Math.min(Math.max(initialDay, 1), len) - 1); // ALL = 전체 (2026-11-16 마루님)
  const [editing, setEditing] = useState(false);
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
    const times = items.filter((x) => (x.time ?? null) !== was.get(x.id)).map((x) => ({ id: x.id!, time: x.time ?? null }));
    const t = times.length ? await safeCall(() => setItemTimes(tripId, times)) : undefined;
    const r = t?.error ? t : await safeCall(() => reorderPlaces(tripId, items.map((x) => x.id!)));
    busy.current = false;
    if (r?.error) { setCols(prev); setMsg(r.error); } else { setMsg(ok); setUndo(keepUndo); }
  };
  const router = useRouter();
  const sortRoute = (c: number) => {
    if (busy.current) return; // 앞의 저장이 끝나기 전에 또 누르면 무시
    const cur = colsRef.current[c];
    const next = routeOrder(cur);
    if (!next) { setUndo(null); setMsg("순서를 바꿀 수 있는 관광, 쇼핑 장소가 2곳 이상이어야 해요. 지도 위치가 없으면 [위치 찾기] 를 먼저 눌러 주세요"); return; }
    if (next.every((x, i) => x === cur[i])) { setUndo(null); setMsg("이미 가장 짧은 동선이에요"); return; }
    void applyDay(c, next, "가까운 순서로 동선을 정리했어요", { c, items: cur });
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
      const ids = [...base, ...moved.slice(0, k + 1)].map((x) => x.id!);
      const r = await safeCall(() => moveItem(tripId, moved[k].id!, target === U ? null : target, ids));
      if (r?.error) { err = r.error; break; }
    }
    busy.current = false; setPicked([]);
    if (err) { setMsg(err); router.refresh(); } else setMsg(`${moved.length}개를 ${target === U ? "날짜 미정" : `${target + 1}일차`}로 옮겼어요`);
  };

  // 저장 뒤나 다른 사람이 고쳐서 새 목록이 오면 맞춘다 (끄는 중, 저장 중에는 그대로)
  useEffect(() => { if (!dragId && !busy.current) setCols(fromProps()); }, [fromProps]); // eslint-disable-line react-hooks/exhaustive-deps

  /* 고른 날 : 칩을 가운데로, 주소에 남기기 */
  useEffect(() => {
    nav.current?.querySelector<HTMLElement>(`[data-col="${sel}"]`)?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
    history.replaceState(history.state, "", `/trips/${tripId}?${sel === U ? "undated=1" : sel === ALL ? "day=all" : `day=${sel + 1}`}`);
  }, [sel, tripId, U]);

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
    const ids = now[b.c].map((x) => x.id!);
    if (a.c === b.c && ids.join() === prev[a.c].map((x) => x.id).join()) return;
    setMsg(""); busy.current = true;
    const r = a.c === b.c
      ? await safeCall(() => reorderPlaces(tripId, ids))
      : await safeCall(() => moveItem(tripId, id, b.c === U ? null : b.c, ids));
    busy.current = false;
    if (r?.error) { setCols(prev); setMsg(r.error); }
    else setMsg(a.c === b.c ? "순서를 바꿨어요" : `${b.c === U ? "날짜 미정" : `${b.c + 1}일차`}로 옮겼어요`);
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
    const next = list.map((c, i) => (i === at.c ? c.filter((x) => x.id !== id) : i === target ? [...c, me] : c));
    setCols(next); colsRef.current = next;
    return true;
  };

  /* 끄는 동안의 움직임과 놓기는 창(window)에서 받는다 (2026-11-15 버그 : 버튼에서 받으면 놓기를 놓친다) */
  useEffect(() => {
    if (!dragId) return;
    const id = dragId;
    const move = (e: PointerEvent) => {
      lastY.current = e.clientY;
      const chip = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>("[data-col]");
      const c = chip ? Number(chip.dataset.col) : null;
      overRef.current = c; setOverCol(c);
      if (c == null) place(id, e.clientY);
    };
    const drop = () => {
      const c = overRef.current;
      overRef.current = null; setOverCol(null); setDragId(null);
      if (c != null) moveTo(id, c);
      void save(id);
    };
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
    else if (up && at.c > 0) next[at.c - 1].push(me);
    else if (!up && at.c < U) next[at.c + 1].unshift(me);
    else return;
    before.current = list;
    setCols(next); colsRef.current = next;
    void save(id);
    requestAnimationFrame(() => rows.current.get(id)?.querySelector<HTMLButtonElement>("button[data-grip]")?.focus());
  };

  const canSort = editable && cols.flat().every((i) => i.id);
  const showUndated = cols[U].length > 0 || sel === U || (editable && !!dragId);
  // 전체 : 날마다 묶어 이어서 보인다. 번호는 1일차부터 이어서 (지도 핀과 같은 번호)
  const groups = useMemo(() => (sel === ALL ? [...cols.map((items, c) => ({ c, items }))].filter((g) => g.c < U || g.items.length) : [{ c: sel, items: cols[sel] ?? [] }]), [cols, sel, U]);
  const groupMarks = useMemo(() => { let n = 0; return groups.map((g) => { const m = numbering(g.items, n); n = Math.max(n, ...m.map((x) => x.n)); return m; }); }, [groups]);
  const cur = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const marks = useMemo(() => groupMarks.flat(), [groupMarks]);
  const points = useMemo<DayPoint[]>(() => cur.flatMap((x, i) => (marks[i].n && hasPos(x) ? [{ lat: x.lat!, lng: x.lng!, n: marks[i].n, title: x.title }, ...(x.arrive ? [{ lat: x.arrive.lat, lng: x.arrive.lng, n: marks[i].n, title: `${x.arrive.name || "도착"} (도착)` }] : [])] : [])), [cur, marks]);
  const onPin = useCallback((n: number) => {
    const list = sel === ALL ? colsRef.current.flat() : colsRef.current[sel] ?? [];
    const i = numbering(list).findIndex((m) => m.n === n);
    const id = list[i]?.id;
    const el = id ? rows.current.get(id) : null;
    if (!el) return;
    scrollTo({ top: Math.max(el.getBoundingClientRect().top + scrollY - (nav.current?.offsetHeight ?? 0) - tabsH() - 24, sheetTop()), behavior: "smooth" });
    el.animate?.([{ transform: "scale(1.02)" }, { transform: "scale(1)" }], { duration: 400 });
  }, [sel]);

  /* 장소 사이 거리 : 앞쪽에서 가장 가까운 위치 있는 장소와 (위치 없는 곳, 메모는 건너뜀) */
  const gapBefore = (list: Item[], i: number) => {
    const x = list[i];
    if (!hasPos(x) || x.category === "메모") return null;
    // 앞이 이동(도착지 있음)이면 도착지에서 잰다 (2026-11-17 마루님 "도착지 기준이 맞다")
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
        {/* "위치 없는 장소 n곳 찾기" 단추는 2026-11-17 마루님 "필요 없을 것 같아" 로 뺌 (fillTripCoords 는 남김) */}
      </div>

      <section ref={sheet} aria-label="일정" className="relative z-10 -mt-6 flex min-h-[100dvh] flex-col rounded-t-[28px] bg-bg pb-8 shadow-[0_-6px_20px_rgb(0_0_0/0.06)]">
        <button type="button" onClick={toggleSheet} aria-label="일정 펼치기, 접기" className="flex h-6 w-full flex-none items-end justify-center">
          <span className="h-1 w-10 rounded-full bg-line-strong" />
        </button>
        <nav ref={nav} aria-label="날짜" className="sticky top-[var(--tabs-h,0px)] z-20 flex items-center gap-1 rounded-t-[28px] bg-bg py-3 pl-1 pr-3">
          {/* 칩 줄 양 끝은 바탕으로 부드럽게 사라지게 (2026-11-16 마루님 "칼같이 잘린다"). 여백을 안쪽에 두어 처음과 끝 칩은 흐려지지 않는다 */}
          <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] [mask-image:linear-gradient(to_right,transparent,black_16px,black_calc(100%-28px),transparent)]">
            {len > 1 && chip(ALL, "전체")}
            {days.map((_, c) => chip(c, `${c + 1}일차`))}
            {showUndated && chip(U, `미정 ${cols[U].length}`)}
          </div>
          {editable && sel !== ALL && (
            /* 아이콘만 (2026-11-17 마루님). 글자는 화면 읽기용 이름으로. 점 6개(옮기기 손잡이와 같아 보임) 대신 연필 (2026-11-17) */
            editing ? (
              <button type="button" onClick={endEdit} className="press flex h-10 flex-none items-center rounded-full px-3 text-sub font-bold text-point-text">완료</button>
            ) : (
              <button type="button" onClick={() => { setEditing(true); setPicked([]); }} aria-label="일정 편집"
                className="press flex size-10 flex-none items-center justify-center rounded-full border border-line-strong bg-surface text-ink">
                <Icon name="pencil" size={18} strokeWidth={2} />
              </button>
            )
          )}
        </nav>
        {dragId && <p className="px-5 pb-1 text-tiny font-semibold text-point-text">다른 날로 옮기려면 위 날짜에 놓아 주세요</p>}

        <div className="flex items-end justify-between gap-2 px-5 pb-3 pt-1">
          <h2 className="min-w-0 truncate text-title font-extrabold text-ink">
            {sel === ALL ? <>전체 일정 <span className="font-semibold text-ink-sub">{len}일</span></> : sel === U ? "날짜 미정" : <>{sel + 1}일차 <span className="font-semibold text-ink-sub">{md(d!)} ({weekday(d!)})</span></>}
            {sel !== U && sel !== ALL && days[sel]?.title && <span className="block truncate text-sub font-semibold text-ink-sub">{days[sel].title}</span>}
            {/* 예상 비용 알약 (2026-11-17 마루님 "이날" 빼고 다듬기) */}
            {dayCost && (
              <span className="mt-1.5 flex w-fit max-w-full items-center gap-1 rounded-full bg-surface-soft px-2.5 py-1 text-tiny font-semibold text-ink-sub">
                예상 경비
                <span className="min-w-0 truncate font-extrabold text-ink tabular-nums">{dayCost}</span>
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

        <div className="px-5"
          onTouchStart={(e) => {
            const t = e.touches[0];
            swipe.current = e.touches.length === 1 && !(e.target as Element).closest("input, textarea, select, [data-grip]") ? { x: t.clientX, y: t.clientY } : null;
          }}
          onTouchEnd={(e) => {
            const s = swipe.current, t = e.changedTouches[0];
            swipe.current = null;
            if (!s || !t || dragId || editing) return;
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
                    className={"flex flex-col transition-transform " + (dragId === it.id ? "relative z-10 scale-[1.02] opacity-90 drop-shadow-lg" : "")}>
                    {gap && !dragId && (
                      <span className={"-mt-2 mb-1 w-fit rounded-full border border-line bg-bg px-2 py-0.5 text-tiny font-bold leading-4 text-ink-sub " + (editing && editable && it.id ? "ml-9" : "-ml-1") /* 편집 중에는 왼쪽 동그라미만큼 카드와 같이 밀림 (2026-11-17 마루님) */}>{gap}</span>
                    )}
                    <div className="flex items-center gap-1">
                      {/* 편집 : 왼쪽 동그라미로 고르기 (카드를 눌러도 골라짐) */}
                      {editing && editable && it.id && (
                        <button type="button" role="checkbox" aria-checked={picked.includes(it.id)} aria-label={`${it.title} 고르기`} disabled={!!dragId}
                          onClick={() => togglePick(it.id!)} className="press -ml-2 flex size-11 flex-none items-center justify-center">
                          <span className={"flex size-6 items-center justify-center rounded-full border-2 transition-colors " + (picked.includes(it.id) ? "border-point bg-point text-white" : "border-line-strong bg-surface")}>
                            {picked.includes(it.id) && <Icon name="check" size={14} strokeWidth={3} />}
                          </span>
                        </button>
                      )}
                      <div className={"min-w-0 flex-1 " + (editing && it.id ? "cursor-pointer select-none" : "")} onClick={editing && editable && it.id ? () => togglePick(it.id!) : undefined}>
                        <PinCard index={gm[i].n} mark={gm[i].mark} time={it.time ?? ""} timeEnd={it.timeEnd} category={it.category} title={it.title} detail={it.detail}
                          desc={it.desc ?? ""} editedBy={showEditor(it) ? it.editedBy : undefined} editedFace={it.editedFace} editedAgo={it.editedAgo} photo={it.photos?.find((x) => !x.path.endsWith(".pdf"))?.url} photoCount={it.photos?.length} last={i === list.length - 1}
                          href={editable && it.id && !editing ? `/trips/${tripId}/places/${it.id}` : undefined}
                          warn={dayDate && it.hours ? hoursWarning(it.hours, dayDate, it.time) : undefined}
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
                          onPointerDown={(e) => { e.preventDefault(); before.current = colsRef.current; lastY.current = e.clientY; setDragId(it.id!); setMsg(""); }}>
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
  - 움직이지 않는 칸 : 맨 처음(출발점), 맨 끝 숙소(도착점), 이동, 식사, 숙소, 메모, 지도 위치가 없는 곳
  - 관광, 쇼핑(위치 있음)만 그 칸들 사이 빈자리에서 순서를 바꾼다
  - 시간은 칸에 남는다 : 10:00 칸에 들어간 장소가 10:00 이 된다 (시간 순서가 흐트러지지 않게)
  - 바꿀 곳이 2곳 미만이면 null
*/
const has = (x: Item) => x.lat != null && x.lng != null;
const isFixed = (x: Item, i: number, last: number) =>
  i === 0 || (i === last && x.category === "숙소") || x.category === "이동" || x.category === "식사" || x.category === "숙소" || x.category === "메모" || !has(x);
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
  slots.forEach((slot, k) => { out[slot] = path[k] === items[slot] ? path[k] : { ...path[k], time: items[slot].time }; });
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
