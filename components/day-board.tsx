"use client";
/*
  여행 일정 한 화면 (2026-11-15 여행 메뉴 개편)
  - 모든 날짜가 위에서 아래로 이어진다. 위 날짜 탭을 누르면 그 날로 스크롤, 스크롤하면 지금 보는 날이 탭에 표시
  - 손잡이(점 6개)를 끌어서 같은 날 안 순서를 바꾸거나 다른 날(날짜 미정 포함)로 옮긴다. 화면 끝에 가까이 끌면 저절로 스크롤
  - 날마다 아래 [+ 장소] [메모] 로 그 날에 바로 추가 (메모는 장소가 아닌 글, 2026-11-15)
  - 키보드 : 손잡이에 초점을 두고 위/아래 화살표. 그 날 맨 위/아래에서 더 누르면 앞/뒤 날로 넘어간다
  - 저장에 실패하면 원래 자리로 되돌리고 안내
*/
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Icon, PinCard } from "@/components/kit";
import { GateFab, AlertDialog } from "@/components/gate";
import { BottomDock } from "@/components/screen";
import { reorderPlaces, moveItem, deletePlace } from "@/app/actions";
import { safeCall } from "@/lib/safe-call";
import { addDays, md, weekday, type Item } from "@/lib/mock";

type Props = {
  tripId: string; start: string; days: { title?: string; items: Item[] }[]; undated: Item[];
  editable: boolean; canAdd: boolean; user: boolean; initialDay: number; jump: boolean; jumpUndated?: boolean;
};

export function DayBoard({ tripId, start, days, undated, editable, canAdd, user, initialDay, jump, jumpUndated }: Props) {
  const len = days.length;
  const U = len; // 날짜 미정 칸 번호
  const fromProps = useCallback(() => [...days.map((d) => d.items), undated], [days, undated]);
  const [cols, setCols] = useState<Item[][]>(fromProps);
  const [dragId, setDragId] = useState<string | null>(null);
  const [active, setActive] = useState(initialDay);
  const [msg, setMsg] = useState("");
  const colsRef = useRef(cols);
  colsRef.current = cols;
  const before = useRef<Item[][]>(cols);
  const sections = useRef(new Map<number, HTMLElement>());
  const rows = useRef(new Map<string, HTMLLIElement>());
  const nav = useRef<HTMLElement>(null);
  const lastY = useRef(0);
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
    const r = await safeCall(() => reorderPlaces(tripId, items.map((x) => x.id!)));
    busy.current = false;
    if (r?.error) { setCols(prev); setMsg(r.error); } else { setMsg(ok); setUndo(keepUndo); }
  };
  const sortRoute = (c: number) => {
    const cur = colsRef.current[c];
    const next = routeOrder(cur);
    if (!next) { setUndo(null); setMsg("지도 위치가 있는 장소가 3곳 이상이어야 동선을 정리할 수 있어요. 장소 검색으로 넣은 곳만 위치가 있어요"); return; }
    if (next.every((x, i) => x === cur[i])) { setUndo(null); setMsg("이미 가장 짧은 동선이에요"); return; }
    void applyDay(c, next, "가까운 순서로 동선을 정리했어요", { c, items: cur });
  };

  /* 목록에서 바로 지우기 (확인 창 한 번). 실패하면 되돌리고 안내 */
  const remove = async (it: Item) => {
    const prev = colsRef.current;
    const next = prev.map((c) => c.filter((x) => x.id !== it.id));
    setCols(next); colsRef.current = next; setMsg(""); busy.current = true;
    const r = await safeCall(() => deletePlace(tripId, it.id!));
    busy.current = false;
    if (r?.error) { setCols(prev); setMsg(r.error); } else setMsg(`"${it.title}"을(를) 지웠어요`);
  };

  // 저장 뒤나 다른 사람이 고쳐서 새 목록이 오면 맞춘다 (끄는 중, 저장 중에는 그대로)
  useEffect(() => { if (!dragId && !busy.current) setCols(fromProps()); }, [fromProps]); // eslint-disable-line react-hooks/exhaustive-deps

  /* 처음 열 때 고른 날(또는 오늘)로 */
  useEffect(() => {
    const el = jumpUndated ? sections.current.get(U) : jump ? sections.current.get(initialDay - 1) : null;
    el?.scrollIntoView({ block: "start" });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* 지금 보는 날 : 탭 아래 선을 지난 마지막 날 */
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const line = (nav.current?.getBoundingClientRect().bottom ?? 0) + 24;
        let cur = 1;
        for (let i = 0; i < len; i++) {
          const el = sections.current.get(i);
          if (el && el.getBoundingClientRect().top <= line) cur = i + 1;
        }
        setActive(cur);
      });
    };
    onScroll();
    addEventListener("scroll", onScroll, { passive: true });
    return () => { removeEventListener("scroll", onScroll); cancelAnimationFrame(raf); };
  }, [len]);

  /* 고른 날을 탭 줄 가운데로 */
  useEffect(() => {
    const chip = nav.current?.querySelector<HTMLElement>(`[data-day="${active}"]`);
    chip?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
    history.replaceState(history.state, "", `/trips/${tripId}?day=${active}`);
  }, [active, tripId]);

  const goDay = (d: number) => sections.current.get(d - 1)?.scrollIntoView({ behavior: "smooth", block: "start" });

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

  /* 끄는 자리 계산 : y 가 어느 날 칸에 있는지, 그 칸에서 몇 번째인지 */
  const place = (id: string, y: number) => {
    const list = colsRef.current;
    const keys = [...sections.current.keys()].sort((x, z) => x - z);
    let target = keys[keys.length - 1];
    for (const k of keys) { const r = sections.current.get(k)!.getBoundingClientRect(); if (y < r.bottom) { target = k; break; } }
    const me = list.flat().find((x) => x.id === id);
    if (!me || target == null) return;
    const others = list[target].filter((x) => x.id !== id);
    let idx = 0;
    for (const o of others) {
      const el = rows.current.get(o.id!);
      if (el) { const r = el.getBoundingClientRect(); if (y > r.top + r.height / 2) idx++; }
    }
    const next = list.map((c) => c.filter((x) => x.id !== id));
    next[target] = [...others.slice(0, idx), me, ...others.slice(idx)];
    if (next.some((c, i) => c.length !== list[i].length || c.some((x, j) => x !== list[i][j]))) setCols(next);
  };

  /*
    끄는 동안의 움직임과 놓기는 창(window)에서 받는다
    (다른 날로 넘어가면 카드가 다른 목록으로 옮겨 그려져 손잡이 버튼이 새로 생기므로, 버튼에서 받으면 놓기를 놓친다. 2026-11-15 버그)
  */
  useEffect(() => {
    if (!dragId) return;
    const id = dragId;
    const move = (e: PointerEvent) => { lastY.current = e.clientY; place(id, e.clientY); };
    const drop = () => { setDragId(null); void save(id); };
    addEventListener("pointermove", move);
    addEventListener("pointerup", drop);
    addEventListener("pointercancel", drop);
    return () => { removeEventListener("pointermove", move); removeEventListener("pointerup", drop); removeEventListener("pointercancel", drop); };
  }, [dragId]); // eslint-disable-line react-hooks/exhaustive-deps

  /* 끄는 동안 화면 위/아래 끝 근처면 저절로 스크롤 */
  useEffect(() => {
    if (!dragId) return;
    let raf = 0;
    const tick = () => {
      const y = lastY.current; const h = innerHeight; const edge = 96;
      const v = y < edge ? -Math.ceil((edge - y) / 6) : y > h - edge ? Math.ceil((y - (h - edge)) / 6) : 0;
      if (v) { scrollBy(0, v); place(dragId, y); }
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
  const showUndated = cols[U].length > 0 || (editable && !!dragId);

  const list = (c: number) => (
    <ol className="flex flex-col" aria-label={c === U ? "날짜 미정 장소" : `${c + 1}일차 장소`}>
      {cols[c].map((it, i) => (
        <li key={it.id ?? `${c}-${i}`} ref={(el) => { if (el && it.id) rows.current.set(it.id, el); }}
          className={"flex items-start gap-1 transition-transform " + (dragId === it.id ? "relative z-10 scale-[1.02] opacity-90 drop-shadow-lg" : "")}>
          <div className="min-w-0 flex-1">
            <PinCard index={c === U ? 0 : i + 1} time={it.time ?? ""} category={it.category} title={it.title} detail={it.detail}
              desc={it.desc ?? ""} editedBy={it.editedBy} photo={it.photos?.[0]?.url} photoCount={it.photos?.length} last={i === cols[c].length - 1}
              href={editable && it.id ? `/trips/${tripId}/places/${it.id}` : undefined} />
          </div>
          {editable && it.id && (
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
        </li>
      ))}
    </ol>
  );

  const empty = (c: number) => (
    <div className={"flex min-h-16 items-center justify-between gap-2 rounded-pin border-2 border-dashed px-4 py-3 " + (dragId ? "border-point bg-point-soft" : "border-line")}>
      <span className="text-sub text-ink-sub">{dragId ? "여기에 놓으면 이 날로 옮겨요" : c === U ? "날짜를 못 정한 장소를 여기로 옮길 수 있어요" : "아직 장소가 없어요"}</span>
    </div>
  );

  return (
    <>
      <nav ref={nav} aria-label="날짜" className="sticky top-0 z-20 -mt-1 bg-bg pb-2 pt-3">
        <div className="flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
          {days.map((_, i) => {
            const d = addDays(start, i);
            const on = i + 1 === active;
            return (
              <button key={d} type="button" data-day={i + 1} onClick={() => goDay(i + 1)}
                aria-current={on ? "true" : undefined} aria-label={`${i + 1}일차, ${md(d)} ${weekday(d)}요일로 가기`}
                className={"press flex h-[60px] w-[52px] flex-none flex-col items-center justify-center rounded-field " + (on ? "bg-btn text-on-btn" : "bg-surface text-ink")}>
                <span className={"text-tiny " + (on ? "" : "text-ink-sub")}>{weekday(d)}</span>
                <span className="text-title font-bold">{Number(d.slice(8))}</span>
              </button>
            );
          })}
          {(cols[U].length > 0) && (
            <button type="button" onClick={() => sections.current.get(U)?.scrollIntoView({ behavior: "smooth", block: "start" })}
              className="press flex h-[60px] flex-none flex-col items-center justify-center rounded-field bg-surface px-3 text-ink">
              <span className="text-tiny text-ink-sub">미정</span><span className="text-title font-bold">{cols[U].length}</span>
            </button>
          )}
        </div>
      </nav>

      <div className="flex flex-col gap-7 px-5 pt-3">
        {days.map((plan, c) => {
          const d = addDays(start, c);
          return (
            <section key={c} ref={(el) => { if (el) sections.current.set(c, el); }} id={`day-${c + 1}`} aria-label={`${c + 1}일차 일정`}
              className="flex scroll-mt-[96px] flex-col gap-3">
              <div className="flex items-end justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-sub font-bold text-point-text">{c + 1}일차</span>
                  <h2 className="truncate text-title-lg font-extrabold text-ink">{plan.title ?? `${md(d)} (${weekday(d)})`}</h2>
                </div>
                <div className="flex flex-none gap-1.5">
                  {editable && cols[c].filter((x) => x.lat != null).length >= 3 && (
                    <button type="button" onClick={() => sortRoute(c)} disabled={!!dragId} aria-label={`${c + 1}일차 동선 정리`}
                      className="press inline-flex h-10 items-center gap-1 rounded-full bg-surface px-3 text-tiny font-bold text-ink">
                      <Icon name="refresh" size={16} />동선
                    </button>
                  )}
                  <Link href={`/trips/${tripId}/map?day=${c + 1}`} aria-label={`${c + 1}일차 지도`} className="press inline-flex h-10 items-center gap-1 rounded-full bg-surface px-3 text-tiny font-bold text-ink">
                    <Icon name="map" size={16} />지도
                  </Link>
                  {user && (
                    <Link href={`/trips/${tripId}/diary?day=${c + 1}`} aria-label={`${c + 1}일차 일기 쓰기`} className="press inline-flex h-10 items-center gap-1 rounded-full bg-surface px-3 text-tiny font-bold text-ink">
                      <Icon name="book" size={16} />일기
                    </Link>
                  )}
                </div>
              </div>
              {cols[c].length ? list(c) : empty(c)}
              {canAdd && !dragId && user && (
                <div className="-mt-1 flex gap-1.5 pl-10">
                  <Link href={`/trips/${tripId}/places/new?day=${c + 1}`} className="press inline-flex h-9 items-center gap-1 rounded-full bg-surface px-3 text-tiny font-bold text-ink">
                    <Icon name="plus" size={14} />장소
                  </Link>
                  <Link href={`/trips/${tripId}/places/new?day=${c + 1}&kind=memo`} className="press inline-flex h-9 items-center gap-1 rounded-full bg-surface px-3 text-tiny font-bold text-ink">
                    <Icon name="pencil" size={14} />메모
                  </Link>
                </div>
              )}
            </section>
          );
        })}
        {showUndated && (
          <section ref={(el) => { if (el) sections.current.set(U, el); else sections.current.delete(U); }} id="undated" aria-label="날짜 미정"
            className="flex scroll-mt-[96px] flex-col gap-3">
            <div className="flex items-end justify-between">
              <h2 className="text-title-lg font-extrabold text-ink">날짜 미정</h2>
              <span className="text-sub text-ink-sub">{cols[U].length}곳</span>
            </div>
            {cols[U].length ? list(U) : empty(U)}
          </section>
        )}
      </div>
      <div role="status" aria-live="polite" className={msg ? "pointer-events-none fixed inset-x-0 bottom-[156px] z-30 mx-auto flex w-full max-w-[560px] justify-center px-5" : "sr-only"}>
        {msg && (
          <p className="pointer-events-auto flex items-center gap-3 rounded-full bg-deep py-2 pl-4 pr-2 text-tiny font-semibold text-on-deep shadow-float">
            <span className="min-w-0">{msg}</span>
            {undo && <button type="button" onClick={() => { const u = undo; void applyDay(u.c, u.items, "원래 순서로 돌렸어요", null); }}
              className="press h-8 flex-none rounded-full bg-deep-soft px-3 font-bold">되돌리기</button>}
          </p>
        )}
      </div>

      {asking && <AlertDialog title={asking.category === "메모" ? "메모를 지울까요?" : "장소를 지울까요?"} desc={`"${asking.title}"이(가) 일정에서 사라져요. 예약 목록에 넣었다면 거기서도 빠져요`}
        confirmLabel="지우기" confirm={() => { const it = asking; setAsking(null); void remove(it); }} onClose={() => setAsking(null)} />}
      {canAdd && <BottomDock align="end"><GateFab href={user ? `/trips/${tripId}/places/new?day=${active}` : undefined} /></BottomDock>}
    </>
  );
}

/*
  동선 정리 (2026-11-15) : 가까운 곳부터 차례로 + 엇갈린 길 풀기(2-opt)
  - 움직이지 않는 칸 : 맨 처음 장소(출발점), 맨 끝의 숙소(도착점), 시간이 정해진 곳, 메모, 지도 위치가 없는 곳
  - 나머지(위치 있고 시간 없는 곳)만 그 칸들 사이 빈자리에서 순서를 바꾼다
  - 바꿀 곳이 2곳 미만이면 null
*/
function routeOrder(items: Item[]): Item[] | null {
  const has = (x: Item) => x.lat != null && x.lng != null;
  if (items.filter(has).length < 3) return null;
  const last = items.length - 1;
  const fixed = items.map((x, i) => i === 0 || (i === last && x.category === "숙소") || !!x.time || x.category === "메모" || !has(x));
  const slots = items.map((_, i) => i).filter((i) => !fixed[i]);
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
  slots.forEach((slot, k) => { out[slot] = path[k]; });
  return out;
}
