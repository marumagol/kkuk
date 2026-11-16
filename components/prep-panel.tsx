"use client";
/* 준비 탭 내용 : 체크리스트, 예약 (예산 카드는 2026-11-16 경비 탭으로 옮김, BudgetSection). 저장은 app/actions.ts (RLS 가 권한 검사) */
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { SwipeRow } from "@/components/swipe-row";
import { useRouter } from "next/navigation";
import { Button, Field, Icon } from "@/components/kit";
import { addPrepItem, addPrepDefaults, updatePrepItem, saveBudget, reorderPrep } from "@/app/actions";
import { safeCall } from "@/lib/safe-call";
import { decimalsOf, formatMoney } from "@/lib/countries";
import { md } from "@/lib/mock";
import type { PrepView, PrepItem } from "@/lib/trips";

export function PrepPanel({ view }: { view: PrepView }) {
  const canEdit = view.role !== "viewer";
  const [error, setError] = useState("");
  const [busy, start] = useTransition();
  const run = (fn: () => Promise<{ error?: string } | undefined | void>) => start(async () => {
    setError("");
    const r = await safeCall(fn);
    if (r && "error" in r && r.error) setError(r.error);
  });
  /* 밀어서 삭제 (2026-11-16 마루님) : 바로 숨기고 5초 동안 [되돌리기]. 지나거나 화면을 떠나면 실제로 삭제 */
  const [hidden, setHidden] = useState<string | null>(null);
  const pending = useRef<{ id: string; timer: number } | null>(null);
  const flush = () => { const p = pending.current; pending.current = null; if (!p) return; clearTimeout(p.timer); run(() => updatePrepItem(view.tripId, p.id, { remove: true })); };
  const swipeDelete = (it: PrepItem) => {
    flush();
    pending.current = { id: it.id, timer: window.setTimeout(() => { flush(); }, 5000) };
    setHidden(it.id);
  };
  const undo = () => { const p = pending.current; if (p) clearTimeout(p.timer); pending.current = null; setHidden(null); };
  useEffect(() => {
    const leave = () => flush();
    addEventListener("pagehide", leave);
    return () => { removeEventListener("pagehide", leave); flush(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const shown = hidden ? { ...view, items: view.items.filter((x) => x.id !== hidden) } : view;
  const gone = hidden ? view.items.find((x) => x.id === hidden) : undefined;

  return (
    <div className="flex flex-col gap-6 px-5 pt-5">
      <PrepSummary view={view} />
      {error && <p role="alert" className="text-sub font-semibold text-point-text">{error}</p>}
      <List title="예약" kind="reservation" view={shown} canEdit={canEdit} busy={busy} run={run} onSwipe={swipeDelete} />
      <List title="체크리스트" kind="item" view={shown} canEdit={canEdit} busy={busy} run={run} onSwipe={swipeDelete} />
      {!canEdit && <p className="text-tiny text-ink-sub">보기만 권한이라 준비 목록을 고칠 수 없어요</p>}
      {canEdit && <p className="text-tiny text-ink-sub">줄을 왼쪽으로 밀면 삭제, 길게 누르면 순서를 옮길 수 있어요</p>}
      {gone && (
        <div role="status" className="pointer-events-none fixed inset-x-0 bottom-[156px] z-30 mx-auto flex w-full max-w-[560px] justify-center px-5">
          <p className="pointer-events-auto flex items-center gap-3 rounded-full bg-deep py-2 pl-4 pr-2 text-tiny font-semibold text-on-deep shadow-float">
            <span className="min-w-0 truncate">&ldquo;{gone.title}&rdquo;을(를) 삭제했어요</span>
            <button type="button" onClick={undo} className="press h-8 flex-none rounded-full bg-deep-soft px-3 font-bold">되돌리기</button>
          </p>
        </div>
      )}
    </div>
  );
}

/* 준비 요약 (2026-11-16 마루님 "예약 몇 건, 준비물 몇 건 같은 대시보드") : 예약, 챙길 것, 전체 준비율 */
function PrepSummary({ view }: { view: PrepView }) {
  const count = (k: "item" | "reservation") => { const l = view.items.filter((x) => x.kind === k); return { all: l.length, done: l.filter((x) => x.done).length }; };
  const res = count("reservation"), item = count("item");
  const all = res.all + item.all, done = res.done + item.done;
  const pct = all ? Math.round((done / all) * 100) : 0;
  const tile = (label: string, c: { all: number; done: number }, unit: string) => (
    <div className="flex flex-col gap-0.5">
      <dt className="text-tiny font-semibold text-on-deep-sub">{label}</dt>
      <dd className="text-title font-extrabold tabular-nums">{c.all ? <>{c.done}<span className="text-sub font-bold text-on-deep-sub">/{c.all}{unit}</span></> : <span className="text-sub font-bold text-on-deep-sub">없음</span>}</dd>
    </div>
  );
  return (
    <section className="flex flex-col gap-3 rounded-deep bg-deep p-5 text-on-deep" aria-label="준비 요약">
      <dl className="grid grid-cols-3 gap-2">
        {tile("예약", res, "건")}
        {tile("체크리스트", item, "개")}
        <div className="flex flex-col gap-0.5">
          <dt className="text-tiny font-semibold text-on-deep-sub">준비</dt>
          <dd className="text-title font-extrabold tabular-nums">{pct}%</dd>
        </div>
      </dl>
      <div className="h-2 overflow-hidden rounded-full bg-deep-soft" role="img" aria-label={`준비 ${pct}% 끝냄`}>
        <span className="block h-full rounded-full bg-point" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-tiny text-on-deep-sub">{all === 0 ? "아래에서 예약과 체크리스트를 추가해 보세요" : all === done ? "준비를 모두 끝냈어요" : `${all - done}개 남았어요`}</p>
    </section>
  );
}

/* 경비 탭 맨 위 예산 카드 (2026-11-16 마루님 "예산 섹션이 경비로"). actual : 예산 통화로 적은 실제 경비 합 */
export function BudgetSection({ view, actual }: { view: PrepView; actual: number }) {
  const [error, setError] = useState("");
  const [busy, start] = useTransition();
  const run: RunFn = (fn) => start(async () => {
    setError("");
    const r = await safeCall(fn);
    if (r && "error" in r && r.error) setError(r.error);
  });
  return (
    <div className="flex flex-col gap-2">
      <Budget view={view} canEdit={view.role !== "viewer"} busy={busy} run={run} actual={actual} />
      {error && <p role="alert" className="text-sub font-semibold text-point-text">{error}</p>}
    </div>
  );
}


const DEFAULT_ITEMS = ["여권", "충전기", "보조배터리", "상비약", "환전", "여행자 보험", "유심 또는 eSIM", "세면도구"];

type RunFn = (fn: () => Promise<{ error?: string } | undefined | void>) => void;

function Budget({ view, canEdit, busy, run, actual }: { view: PrepView; canEdit: boolean; busy: boolean; run: RunFn; actual: number }) {
  const cur = view.budget?.currency ?? view.currency;
  const d = decimalsOf(cur);
  const [edit, setEdit] = useState(false);
  const [amount, setAmount] = useState(view.budget ? String(view.budget.total / 10 ** d) : "");
  const total = view.budget?.total ?? 0;
  /* [원화로 보기] (2026-11-16 마루님) : 누르면 카드의 외화 금액이 모두 원화로 바뀐다. 다시 누르면 원래 통화 */
  const [inKrw, setInKrw] = useState(false);
  const money = (minor: number) => (inKrw && view.krw ? `₩${Math.round((minor / 10 ** d) * view.krw).toLocaleString("ko-KR")}` : formatMoney(minor, cur));
  const editBtn = canEdit && (
    <button type="button" onClick={() => setEdit(true)} className="press inline-flex h-8 items-center rounded-full bg-deep-soft px-3 text-tiny font-semibold text-on-deep">{view.budget ? "예산 수정" : "예산 정하기"}</button>
  );
  if (edit) return (
    <section className="flex flex-col gap-3 rounded-card bg-surface p-5" aria-label="예산 수정">
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <Field label={`전체 예산 (${cur})`} name="budget" inputMode={d ? "decimal" : "numeric"} value={amount} placeholder="0"
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))} disabled={busy} />
        </div>
        <Button type="button" size="lg" disabled={busy || !amount} onClick={() => run(async () => { const r = await saveBudget(view.tripId, cur, amount); if (!r?.error) setEdit(false); return r; })}>저장</Button>
      </div>
      <button type="button" onClick={() => setEdit(false)} className="press h-9 self-start px-1 text-tiny font-semibold text-ink-sub underline underline-offset-2">닫기</button>
    </section>
  );
  /*
    예산 카드 (2026-11-16 마루님 "예산, 경비, 정산을 명확히") : 실제로 쓴 돈(경비) 기준
    - 큰 숫자 : 남은 예산 (예산이 없으면 쓴 돈), 막대 하나 = 쓴 돈 / 예산
    - 장소 예상 비용은 "예상" 한 줄로만 작게
  */
  const remain = total - actual;
  const used = total ? Math.min(100, Math.round((actual / total) * 100)) : 0;
  const over = !!view.budget && remain < 0;
  return (
    <section className="flex flex-col gap-3 rounded-deep bg-deep p-5 text-on-deep" aria-labelledby="budget-title">
      <div className="flex items-center justify-between gap-2">
        <h2 id="budget-title" className="text-sub font-semibold text-on-deep-sub">{view.budget ? (over ? "예산을 넘었어요" : "남은 예산") : "쓴 돈"}</h2>
        <span className="flex items-center gap-1.5">
          {view.krw && <button type="button" onClick={() => setInKrw((v) => !v)} aria-pressed={inKrw}
            className="press inline-flex h-8 items-center rounded-full border border-deep-soft px-3 text-tiny font-semibold text-on-deep">{inKrw ? `${cur}로 보기` : "원화로 보기"}</button>}
          {editBtn}
        </span>
      </div>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className={"text-number font-extrabold tabular-nums " + (over ? "text-[#FF8466]" : "")}>{inKrw && view.krw ? "약 " : ""}{money(view.budget ? Math.abs(remain) : actual)}</span>
        {view.budget && <span className="text-sub text-on-deep-sub">/ 예산 {money(total)}</span>}
      </p>
      {view.budget && (
        <div className="h-2 overflow-hidden rounded-full bg-deep-soft" role="img" aria-label={`예산의 ${used}% 씀`}>
          <span className="block h-full rounded-full" style={{ width: `${used}%`, background: over ? "#FF8466" : "#6FD3A8" }} />
        </div>
      )}
      <dl className="flex flex-col gap-1 text-sub">
        {view.budget && <div className="flex items-center justify-between gap-2"><dt className="text-on-deep-sub">쓴 돈 (경비)</dt><dd className="font-bold tabular-nums">{money(actual)}</dd></div>}
        {view.spent > 0 && <div className="flex items-center justify-between gap-2"><dt className="text-on-deep-sub">예상 (장소에 적은 비용)</dt><dd className="font-semibold tabular-nums text-on-deep-sub">{money(view.spent)}</dd></div>}
      </dl>
      <p className="text-tiny text-on-deep-sub">{cur} 로 적은 경비만 더해요{inKrw && view.krw ? `. 원화는 1 ${cur} = ${view.krw < 10 ? view.krw.toFixed(2) : Math.round(view.krw).toLocaleString("ko-KR")}원 기준 참고용이에요` : ""}</p>
    </section>
  );
}

function List({ title, kind, view, canEdit, busy, run, onSwipe }: {
  title: string; kind: "item" | "reservation"; view: PrepView; canEdit: boolean; busy: boolean; run: RunFn; onSwipe: (it: PrepItem) => void;
}) {
  const fromView = view.items.filter((x) => x.kind === kind);
  /* 길게 눌러 순서 옮기기 (2026-11-16 마루님) : 끄는 동안은 이 목록 순서를 따로 들고 있다가, 놓으면 저장 */
  const [order, setOrder] = useState<PrepItem[] | null>(null);
  const items = order ?? fromView;
  const orderRef = useRef(order);
  orderRef.current = order;
  const rowEls = useRef(new Map<string, HTMLLIElement>());
  const [dragId, setDragId] = useState<string | null>(null);
  useEffect(() => {
    if (!dragId) return;
    const move = (e: PointerEvent) => {
      setOrder((cur) => {
        const list = cur ?? fromView;
        const from = list.findIndex((x) => x.id === dragId);
        let to = list.length - 1;
        for (let i = 0; i < list.length; i++) { const r = rowEls.current.get(list[i].id)?.getBoundingClientRect(); if (r && e.clientY < r.top + r.height / 2) { to = i > from ? i - 1 : i; break; } }
        if (to === from || from < 0) return list;
        const next = [...list]; const [me] = next.splice(from, 1); next.splice(to, 0, me);
        return next;
      });
    };
    const drop = () => {
      setDragId(null);
      const cur = orderRef.current;
      if (cur && cur.some((x, i) => x.id !== fromView[i]?.id)) run(async () => { const r = await reorderPrep(view.tripId, cur.map((x) => x.id)); setOrder(null); return r; });
      else setOrder(null);
    };
    const noScroll = (e: TouchEvent) => e.preventDefault();
    addEventListener("pointermove", move); addEventListener("pointerup", drop); addEventListener("pointercancel", drop);
    addEventListener("touchmove", noScroll, { passive: false });
    return () => { removeEventListener("pointermove", move); removeEventListener("pointerup", drop); removeEventListener("pointercancel", drop); removeEventListener("touchmove", noScroll); };
  }, [dragId]); // eslint-disable-line react-hooks/exhaustive-deps
  const [text, setText] = useState("");
  const [due, setDue] = useState("");
  const done = items.filter((x) => x.done).length;
  const add = () => run(async () => { const r = await addPrepItem(view.tripId, kind, text, kind === "reservation" ? due || null : null); if (!r?.error) { setText(""); setDue(""); } return r; });
  return (
    <section className="flex flex-col gap-2" aria-label={title}>
      <div className="flex items-end justify-between">
        <h2 className="text-title font-bold text-ink">{title}</h2>
        {items.length > 0 && (items.length - done > 0
          ? <span className="text-sub font-bold text-point-text">{items.length - done}개 남음</span>
          : <span className="text-sub text-ink-sub">모두 끝냈어요</span>)}
      </div>
      {/* 목록과 추가 줄을 한 카드에 (2026-11-16 마루님 "하나의 섹션으로 보여야") */}
      {(items.length > 0 || canEdit) && (
        <div className="overflow-hidden rounded-card bg-surface">
          {items.length > 0 && (
            <ul className="divide-y divide-line">
              {items.map((it) => (
                <li key={it.id} ref={(el) => { if (el) rowEls.current.set(it.id, el); else rowEls.current.delete(it.id); }}
                  className={dragId === it.id ? "relative z-10 scale-[1.02] bg-surface shadow-float" : ""}>
                  <SwipeRow rounded="" bg="bg-surface" disabled={!canEdit || busy || !!dragId}
                    onDelete={canEdit ? () => onSwipe(it) : undefined}
                    onLongPress={canEdit && items.length > 1 ? () => setDragId(it.id) : undefined}>
                    <Row it={it} view={view} canEdit={canEdit} busy={busy} run={run} />
                  </SwipeRow>
                </li>
              ))}
            </ul>
          )}
          {canEdit && kind === "item" && items.length === 0 && (
            <button type="button" disabled={busy} onClick={() => run(() => addPrepDefaults(view.tripId, DEFAULT_ITEMS))}
              className="press flex min-h-14 w-full items-center gap-3 border-b border-line px-4 py-2 text-left">
              <span aria-hidden className="flex size-7 flex-none items-center justify-center rounded-full bg-point-soft text-point-text"><Icon name="plus" size={14} /></span>
              <span className="min-w-0 flex-1"><span className="block text-sub font-bold text-ink">자주 챙기는 것 한 번에 넣기</span><span className="block truncate text-tiny text-ink-sub">{DEFAULT_ITEMS.join(", ")}</span></span>
            </button>
          )}
          {canEdit && (
            <div className={items.length ? "border-t border-line" : ""}>
              <div className="flex min-h-14 items-center gap-3 px-4 py-2">
                <span aria-hidden className="flex size-7 flex-none items-center justify-center rounded-full border-2 border-dashed border-line-strong text-ink-sub"><Icon name="plus" size={14} /></span>
                <input name={`add-${kind}`} aria-label={`${title} 추가`} placeholder={`${title} 추가`} value={text} maxLength={80} disabled={busy}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing && text.trim()) { e.preventDefault(); add(); } }}
                  className="h-10 min-w-0 flex-1 bg-transparent text-[16px] text-ink outline-none placeholder:text-ink-sub" />
                <button type="button" disabled={busy || !text.trim()} onClick={add}
                  className="press h-9 flex-none rounded-full bg-btn px-3.5 text-sub font-bold text-on-btn disabled:bg-surface-soft disabled:text-ink-sub">추가</button>
              </div>
              {kind === "reservation" && (
                <label className="flex items-center gap-3 pb-3 pl-14 pr-4">
                  <span className="flex-none text-tiny font-semibold text-ink-sub">날짜 (선택)</span>
                  <input type="date" name="due" value={due} onChange={(e) => setDue(e.target.value)} disabled={busy}
                    className="h-10 min-w-0 flex-1 rounded-field bg-bg px-3 text-sub text-ink outline-none focus:ring-2 focus:ring-ink/15" />
                </label>
              )}
            </div>
          )}
        </div>
      )}
      {!items.length && !canEdit && <p className="rounded-pin bg-surface px-4 py-4 text-sub text-ink-sub">아직 없어요</p>}
    </section>
  );
}

function Row({ it, view, canEdit, busy, run }: { it: PrepItem; view: PrepView; canEdit: boolean; busy: boolean; run: RunFn }) {
  const router = useRouter();
  // 예약은 [수정] 을 누르면 예약 화면(예약번호, 메모, 첨부 파일)으로 (2026-11-16 마루님 "목록에 뿌리지 말고 수정에서")
  const openEdit = () => (it.kind === "reservation" ? router.push(`/trips/${view.tripId}/bookings/${it.id}`) : setEdit(true));
  const who = view.people.find((p) => p.userId === it.assignee);
  const name = who?.name;
  const [edit, setEdit] = useState(false);
  const [title, setTitle] = useState(it.title);
  const [due, setDue] = useState(it.due ?? "");
  const save = () => run(async () => {
    const r = await updatePrepItem(view.tripId, it.id, { title, ...(it.kind === "reservation" ? { due: due || null } : {}) });
    if (!r?.error) setEdit(false);
    return r;
  });
  if (edit) return (
    <div className="flex flex-col gap-2 px-4 py-3">
      <Field label="이름" name={`edit-${it.id}`} value={title} maxLength={80} disabled={busy} autoFocus
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing && title.trim()) { e.preventDefault(); save(); } if (e.key === "Escape") setEdit(false); }} />
      {it.kind === "reservation" && <Field label="날짜 (선택)" name={`edit-due-${it.id}`} type="date" value={due} onChange={(e) => setDue(e.target.value)} disabled={busy} />}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" disabled={busy} onClick={() => { setEdit(false); setTitle(it.title); setDue(it.due ?? ""); }}>취소</Button>
        <Button type="button" disabled={busy || !title.trim()} onClick={save}>저장</Button>
      </div>
    </div>
  );
  return (
    <div className="flex min-h-14 items-center gap-3 px-4 py-2">
      <button type="button" role="checkbox" aria-checked={it.done} aria-label={`${it.title} ${it.done ? "끝냄" : "안 끝냄"}`} disabled={!canEdit || busy}
        onClick={() => run(() => updatePrepItem(view.tripId, it.id, { done: !it.done }))}
        className={"press flex size-7 flex-none items-center justify-center rounded-full border-2 " + (it.done ? "border-btn bg-btn text-on-btn" : "border-line-strong text-transparent")}>
        <Icon name="check" size={14} strokeWidth={2.5} />
      </button>
      <div className="min-w-0 flex-1">
        {canEdit ? (
          <button type="button" onClick={openEdit} disabled={busy} aria-label={`${it.title} 수정`}
            className={"block w-full truncate text-left text-body " + (it.done ? "text-ink-sub line-through" : "text-ink")}>{it.kind === "reservation" && it.important && <span className="mr-1 inline-block -translate-y-px align-middle text-point"><Icon name="star" size={15} className="fill-current" /><span className="sr-only">중요</span></span>}{it.title}</button>
        ) : <p className={"truncate text-body " + (it.done ? "text-ink-sub line-through" : "text-ink")}>{it.kind === "reservation" && it.important && <span className="mr-1 inline-block -translate-y-px align-middle text-point"><Icon name="star" size={15} className="fill-current" /><span className="sr-only">중요</span></span>}{it.title}</p>}
        {it.kind === "reservation" ? (
          /* 예약 지갑 (0034) : 적어 둔 것만 작게. 넣기는 [수정] 에서 */
          (it.code || (it.files ?? 0) > 0) && <span className="flex max-w-full items-center gap-1 text-tiny text-ink-sub">
            {it.code && <span className="truncate font-semibold text-ink">{it.code}</span>}
            {(it.files ?? 0) > 0 && <span className="flex-none">{it.code ? ", " : ""}파일 {it.files}개</span>}
          </span>
        ) : it.itemId && <Link href={`/trips/${view.tripId}/places/${it.itemId}`} className="inline-flex items-center gap-0.5 text-tiny text-ink-sub underline underline-offset-2"><Icon name="pin" size={12} />일정 장소</Link>}
      </div>
      {it.due && <span className={"flex-none rounded-full px-2.5 py-1 text-tiny font-semibold " + (it.done ? "bg-surface-soft text-ink" : "bg-warn-soft text-warn-text")}>{md(it.due)}</span>}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {who?.avatar ? <img src={who.avatar} alt="" title={`담당 ${name}`} width={32} height={32} className="size-8 flex-none rounded-full object-cover" />
        : name && <span title={`담당 ${name}`} className="flex size-8 flex-none items-center justify-center rounded-full bg-accent-soft text-tiny font-bold text-accent-text">{[...name][0]}</span>}
      {canEdit && <RowMenu it={it} view={view} busy={busy} run={run} />}
    </div>
  );
}

/* 줄 오른쪽 ⋯ 메뉴 : 중요 표시(예약), 담당자 지정, 삭제. 수정은 이름을 누르면 (2026-11-16 마루님 "줄에 요소가 많아 복잡해") */
function RowMenu({ it, view, busy, run }: { it: PrepItem; view: PrepView; busy: boolean; run: RunFn }) {
  const [open, setOpen] = useState<"menu" | "who" | null>(null);
  const close = () => setOpen(null);
  const item = "press flex min-h-11 w-full items-center gap-2.5 px-4 text-left text-body text-ink";
  return (
    <div className="relative flex-none">
      <button type="button" aria-label={`${it.title} 메뉴`} aria-haspopup="menu" aria-expanded={!!open} disabled={busy}
        onClick={() => setOpen(open ? null : "menu")}
        className="press flex size-9 items-center justify-center rounded-full text-ink-sub"><Icon name="more" size={20} /></button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={close} aria-hidden />
          <div role="menu" onKeyDown={(e) => e.key === "Escape" && close()}
            className="absolute right-0 top-10 z-40 min-w-[168px] overflow-hidden rounded-field bg-surface py-1 shadow-float ring-1 ring-line">
            {open === "menu" ? (
              <>
                {it.kind === "reservation" && (
                  <button type="button" role="menuitem" autoFocus className={item} onClick={() => { close(); run(() => updatePrepItem(view.tripId, it.id, { important: !it.important })); }}>
                    <Icon name="star" size={18} className={it.important ? "fill-current text-point" : "text-ink-sub"} />{it.important ? "중요 해제" : "중요 표시"}
                  </button>
                )}
                <button type="button" role="menuitem" autoFocus={it.kind !== "reservation"} className={item} onClick={() => setOpen("who")}><Icon name="user" size={18} className="text-ink-sub" />담당자 지정</button>
                <button type="button" role="menuitem" className={item + " text-point-text"} onClick={() => { close(); run(() => updatePrepItem(view.tripId, it.id, { remove: true })); }}>
                  <Icon name="trash" size={18} />삭제
                </button>
              </>
            ) : (
              [{ userId: "", name: "담당 없음" }, ...view.people].map((p) => (
                <button key={p.userId || "none"} type="button" role="menuitemradio" aria-checked={(it.assignee ?? "") === p.userId} className={item}
                  onClick={() => { close(); if ((it.assignee ?? "") !== p.userId) run(() => updatePrepItem(view.tripId, it.id, { assignee: p.userId || null })); }}>
                  <span className="flex-1 truncate">{p.name}</span>
                  {(it.assignee ?? "") === p.userId && <Icon name="check" size={16} className="text-point-text" />}
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
