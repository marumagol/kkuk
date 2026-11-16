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
import { FEATURES } from "@/lib/features";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Icon, PinCard } from "@/components/kit";
import { GateFab, AlertDialog } from "@/components/gate";
import { BottomDock } from "@/components/screen";
import { DayMap, type DayPoint } from "@/components/day-map";
import { reorderPlaces, moveItem, deletePlace, fillTripCoords, setItemTimes } from "@/app/actions";
import { useRouter } from "next/navigation";
import { safeCall } from "@/lib/safe-call";
import { addDays, md, weekday, type Item } from "@/lib/mock";

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
/* 번호 : 위치가 있는 장소만, 메모와 공항·항공은 빼고 1부터. 지도 핀과 같은 번호 */
function numbering(items: Item[]) {
  let n = 0;
  return items.map((x) => (x.category === "메모" ? { mark: "dot" as const, n: 0 } : isFlight(x) ? { mark: "plane" as const, n: 0 } : hasPos(x) ? { n: ++n } : { n: 0 }));
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
  const [sel, setSel] = useState(jumpUndated && undated.length ? U : Math.min(Math.max(initialDay, 1), len) - 1);
  const [editing, setEditing] = useState(false);
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
  const [asking, setAsking] = useState<Item | null>(null); // 지우기 확인
  const [undo, setUndo] = useState<{ c: number; items: Item[] } | null>(null); // 동선 정렬 되돌리기

  /* 알림 줄은 5초 뒤 사라진다 (되돌리기가 있으면 8초) */
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => { setMsg(""); setUndo(null); }, undo ? 8000 : 5000);
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
  const [finding, setFinding] = useState(false);
  const noPin = cols.flat().filter((x) => x.id && x.lat == null && x.category !== "이동" && x.category !== "메모" && !/→|->/.test(x.title)).length;
  const findCoords = async () => {
    if (finding) return;
    setFinding(true); setUndo(null); setMsg("");
    let r: Awaited<ReturnType<typeof fillTripCoords>> | undefined;
    try { r = (await safeCall(() => fillTripCoords(tripId))) as typeof r; } catch { r = undefined; } finally { setFinding(false); }
    if (!r || r.error) { setMsg(r?.error ?? "위치를 찾지 못했어요"); return; }
    const parts = [`${r.filled ?? 0}곳 위치를 찾았어요`];
    if (r.missed) parts.push(`${r.missed}곳은 못 찾았어요`);
    if (r.limited) parts.push("오늘 찾기 횟수를 다 써서 나머지는 내일 다시 눌러 주세요");
    setMsg(parts.join(". "));
    router.refresh();
  };
  const sortRoute = (c: number) => {
    if (busy.current) return; // 앞의 저장이 끝나기 전에 또 누르면 무시
    const cur = colsRef.current[c];
    const next = routeOrder(cur);
    if (!next) { setUndo(null); setMsg("순서를 바꿀 수 있는 관광, 쇼핑 장소가 2곳 이상이어야 해요. 지도 위치가 없으면 [위치 찾기] 를 먼저 눌러 주세요"); return; }
    if (next.every((x, i) => x === cur[i])) { setUndo(null); setMsg("이미 가장 짧은 동선이에요"); return; }
    void applyDay(c, next, "가까운 순서로 동선을 정리했어요", { c, items: cur });
  };

  /* 목록에서 바로 지우기 (확인 창 한 번). 실패하면 되돌리고 안내 */
  const remove = async (it: Item) => {
    if (busy.current) return;
    const prev = colsRef.current;
    const next = prev.map((c) => c.filter((x) => x.id !== it.id));
    setCols(next); colsRef.current = next; setMsg(""); busy.current = true;
    const r = await safeCall(() => deletePlace(tripId, it.id!));
    busy.current = false;
    if (r?.error) { setCols(prev); setMsg(r.error); } else setMsg(`"${it.title}"을(를) 지웠어요`);
  };

  // 저장 뒤나 다른 사람이 고쳐서 새 목록이 오면 맞춘다 (끄는 중, 저장 중에는 그대로)
  useEffect(() => { if (!dragId && !busy.current) setCols(fromProps()); }, [fromProps]); // eslint-disable-line react-hooks/exhaustive-deps

  /* 고른 날 : 칩을 가운데로, 주소에 남기기 */
  useEffect(() => {
    nav.current?.querySelector<HTMLElement>(`[data-col="${sel}"]`)?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
    history.replaceState(history.state, "", `/trips/${tripId}?${sel === U ? "undated=1" : `day=${sel + 1}`}`);
  }, [sel, tripId, U]);

  const sheetTop = () => (sheet.current ? sheet.current.getBoundingClientRect().top + scrollY : 0);
  const pickDay = (c: number) => {
    setSel(c); setUndo(null);
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
    return () => { removeEventListener("pointermove", move); removeEventListener("pointerup", drop); removeEventListener("pointercancel", drop); };
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
  const cur = useMemo(() => cols[sel] ?? [], [cols, sel]);
  const marks = useMemo(() => numbering(cur), [cur]);
  const points = useMemo<DayPoint[]>(() => cur.flatMap((x, i) => (marks[i].n && hasPos(x) ? [{ lat: x.lat!, lng: x.lng!, n: marks[i].n, title: x.title }] : [])), [cur, marks]);
  const onPin = useCallback((n: number) => {
    const i = numbering(colsRef.current[sel] ?? []).findIndex((m) => m.n === n);
    const id = colsRef.current[sel]?.[i]?.id;
    const el = id ? rows.current.get(id) : null;
    if (!el) return;
    scrollTo({ top: Math.max(el.getBoundingClientRect().top + scrollY - (nav.current?.offsetHeight ?? 0) - 24, sheetTop()), behavior: "smooth" });
    el.animate?.([{ transform: "scale(1.02)" }, { transform: "scale(1)" }], { duration: 400 });
  }, [sel]);

  /* 장소 사이 거리 : 앞쪽에서 가장 가까운 위치 있는 장소와 (위치 없는 곳, 메모는 건너뜀) */
  const gapBefore = (i: number) => {
    const x = cur[i];
    if (!hasPos(x) || x.category === "메모") return null;
    for (let j = i - 1; j >= 0; j--) { const p = cur[j]; if (p.category !== "메모" && hasPos(p)) return distText(km(p, x)); }
    return null;
  };

  const d = sel === U ? null : addDays(start, sel);
  const chip = (c: number, label: string) => {
    const on = sel === c, over = overCol === c;
    return (
      <button key={c} type="button" data-col={c} onClick={() => pickDay(c)} aria-current={on ? "true" : undefined}
        aria-label={c === U ? `날짜 미정 ${cols[U].length}곳` : `${c + 1}일차, ${md(addDays(start, c))} ${weekday(addDays(start, c))}요일`}
        className={"press flex h-10 flex-none items-center rounded-full px-4 text-sub font-bold transition-colors " +
          (over ? "bg-point-soft text-point-text ring-2 ring-point" : on ? "bg-btn text-on-btn" : dragId ? "border border-dashed border-point bg-surface text-ink" : "border border-line-strong bg-surface text-ink-sub")}>
        {label}
      </button>
    );
  };

  return (
    <>
      {/* 지도 : 스크롤해도 그 자리에 있고, 시트가 그 위로 올라온다 */}
      <div className="sticky top-0 z-0 mt-3 h-[40dvh] min-h-[240px]">
        <DayMap points={points} onPick={onPin} className="size-full" />
        {editable && noPin > 0 && (
          <button type="button" onClick={findCoords} disabled={finding}
            className="press absolute bottom-10 left-1/2 inline-flex h-10 -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full bg-surface px-4 text-tiny font-bold text-ink shadow-float">
            <Icon name="map" size={16} />{finding ? "위치 찾는 중" : `위치 없는 장소 ${noPin}곳 찾기`}
          </button>
        )}
      </div>

      <section ref={sheet} aria-label="일정" className="relative z-10 -mt-6 flex min-h-[100dvh] flex-col rounded-t-[28px] bg-bg pb-8 shadow-[0_-6px_20px_rgb(0_0_0/0.06)]">
        <button type="button" onClick={toggleSheet} aria-label="일정 펼치기, 접기" className="flex h-6 w-full flex-none items-end justify-center">
          <span className="h-1 w-10 rounded-full bg-line-strong" />
        </button>
        <nav ref={nav} aria-label="날짜" className="sticky top-0 z-20 flex items-center gap-2 rounded-t-[28px] bg-bg py-3 pl-5 pr-3">
          <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto [scrollbar-width:none]">
            {days.map((_, c) => chip(c, `${c + 1}일차`))}
            {showUndated && chip(U, `미정 ${cols[U].length}`)}
          </div>
          {editable && (
            <button type="button" onClick={() => setEditing((v) => !v)} aria-pressed={editing}
              className={"press inline-flex h-10 flex-none items-center gap-1 rounded-full px-3.5 text-sub font-bold " + (editing ? "bg-point text-white" : "border border-line-strong bg-surface text-ink")}>
              {editing ? <><Icon name="check" size={16} />완료</> : <><Icon name="grip" size={16} />편집</>}
            </button>
          )}
        </nav>
        {dragId && <p className="px-5 pb-1 text-tiny font-semibold text-point-text">다른 날로 옮기려면 위 날짜에 놓아 주세요</p>}

        <div className="flex items-end justify-between gap-2 px-5 pb-3 pt-1">
          <h2 className="min-w-0 truncate text-title font-extrabold text-ink">
            {sel === U ? "날짜 미정" : <>{sel + 1}일차 <span className="font-semibold text-ink-sub">{md(d!)} ({weekday(d!)})</span></>}
            {sel !== U && days[sel]?.title && <span className="block truncate text-sub font-semibold text-ink-sub">{days[sel].title}</span>}
          </h2>
          <div className="flex flex-none gap-1.5">
            {editable && sel !== U && movableOf(cur) >= 2 && (
              <button type="button" onClick={() => sortRoute(sel)} disabled={!!dragId} aria-label={`${sel + 1}일차 동선 정리`}
                className="press inline-flex h-9 items-center gap-1 rounded-full bg-surface px-3 text-tiny font-bold text-ink">
                <Icon name="refresh" size={15} />동선
              </button>
            )}
            {user && FEATURES.diary && sel !== U && (
              <Link href={`/trips/${tripId}/diary?day=${sel + 1}`} className="press inline-flex h-9 items-center gap-1 rounded-full bg-surface px-3 text-tiny font-bold text-ink">
                <Icon name="book" size={15} />일기
              </Link>
            )}
          </div>
        </div>

        <div className="px-5">
          {cur.length ? (
            <ol className="flex flex-col" aria-label={sel === U ? "날짜 미정 장소" : `${sel + 1}일차 장소`}>
              {cur.map((it, i) => {
                const gap = gapBefore(i);
                return (
                  <li key={it.id ?? `${sel}-${i}`} ref={(el) => { if (el && it.id) rows.current.set(it.id, el); }}
                    className={"flex flex-col transition-transform " + (dragId === it.id ? "relative z-10 scale-[1.02] opacity-90 drop-shadow-lg" : "")}>
                    {gap && !dragId && (
                      <span className="-mt-2 mb-1 -ml-1 w-fit rounded-full border border-line bg-bg px-2 py-0.5 text-tiny font-bold leading-4 text-ink-sub">{gap}</span>
                    )}
                    <div className="flex items-start gap-1">
                      <div className="min-w-0 flex-1">
                        <PinCard index={marks[i].n} mark={marks[i].mark} time={it.time ?? ""} category={it.category} title={it.title} detail={it.detail}
                          desc={it.desc ?? ""} editedBy={it.editedBy} photo={it.photos?.[0]?.url} photoCount={it.photos?.length} last={i === cur.length - 1}
                          href={editable && it.id && !editing ? `/trips/${tripId}/places/${it.id}` : undefined} />
                      </div>
                      {editing && editable && it.id && (
                        <div className="flex flex-none flex-col items-center">
                          {canSort && (
                            <button type="button" data-grip aria-label={`${it.title} 옮기기. 위아래 화살표로 순서와 날짜를 바꿔요`}
                              className="press mt-2 flex size-11 flex-none cursor-grab touch-none items-center justify-center rounded-full text-ink-sub active:cursor-grabbing"
                              onKeyDown={(e) => onKey(e, it.id!)}
                              onPointerDown={(e) => { e.preventDefault(); before.current = colsRef.current; lastY.current = e.clientY; setDragId(it.id!); setMsg(""); }}>
                              <Icon name="grip" size={22} />
                            </button>
                          )}
                          <button type="button" aria-label={`${it.title} 지우기`} onClick={() => setAsking(it)} disabled={!!dragId}
                            className={"press flex size-10 items-center justify-center rounded-full text-ink-sub " + (canSort ? "" : "mt-2")}>
                            <Icon name="trash" size={18} />
                          </button>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : (
            <div className="flex min-h-16 items-center rounded-pin border-2 border-dashed border-line px-4 py-3">
              <span className="text-sub text-ink-sub">{sel === U ? "날짜를 못 정한 장소가 없어요" : "아직 장소가 없어요"}</span>
            </div>
          )}
          {canAdd && !dragId && user && (
            <div className="mt-1 flex gap-1.5 pl-10">
              <Link href={`/trips/${tripId}/places/new?day=${sel === U ? "none" : sel + 1}`} className="press inline-flex h-9 items-center gap-1 rounded-full bg-surface px-3 text-tiny font-bold text-ink">
                <Icon name="plus" size={14} />장소
              </Link>
              <Link href={`/trips/${tripId}/places/new?day=${sel === U ? "none" : sel + 1}&kind=memo`} className="press inline-flex h-9 items-center gap-1 rounded-full bg-surface px-3 text-tiny font-bold text-ink">
                <Icon name="pencil" size={14} />메모
              </Link>
            </div>
          )}
        </div>
      </section>

      <div role="status" aria-live="polite" className={msg ? "pointer-events-none fixed inset-x-0 bottom-[156px] z-30 mx-auto flex w-full max-w-[560px] justify-center px-5" : "sr-only"}>
        {msg && (
          <p className="pointer-events-auto flex items-center gap-3 rounded-full bg-deep py-2 pl-4 pr-2 text-tiny font-semibold text-on-deep shadow-float">
            <span className="min-w-0">{msg}</span>
            {undo && <button type="button" onClick={() => { if (busy.current) return; const u = undo; void applyDay(u.c, u.items, "원래 순서로 돌렸어요", null); }}
              className="press h-8 flex-none rounded-full bg-deep-soft px-3 font-bold">되돌리기</button>}
          </p>
        )}
      </div>

      {asking && <AlertDialog title={asking.category === "메모" ? "메모를 지울까요?" : "장소를 지울까요?"} desc={`"${asking.title}"이(가) 일정에서 사라져요. 예약 목록에 넣었다면 거기서도 빠져요`}
        confirmLabel="지우기" confirm={() => { const it = asking; setAsking(null); void remove(it); }} onClose={() => setAsking(null)} />}
      {canAdd && <BottomDock align="end"><GateFab href={user ? `/trips/${tripId}/places/new?day=${sel === U ? "none" : sel + 1}` : undefined} /></BottomDock>}
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
  const startAt = [...items.slice(0, slots[0])].reverse().find(has);
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
