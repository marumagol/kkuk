"use client";
/* 준비 탭 내용 : 예산 카드, 챙길 것, 예약. 저장은 app/actions.ts (RLS 가 권한 검사) */
import Link from "next/link";
import { useState, useTransition } from "react";
import { Button, Field, Icon } from "@/components/kit";
import { addPrepItem, addPrepDefaults, updatePrepItem, saveBudget } from "@/app/actions";
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

  return (
    <div className="flex flex-col gap-6 px-5 pt-5">
      <Budget view={view} canEdit={canEdit} busy={busy} run={run} />
      {error && <p role="alert" className="text-sub font-semibold text-point-text">{error}</p>}
      <List title="예약" kind="reservation" view={view} canEdit={canEdit} busy={busy} run={run} placeholder="예 : 숙소, 렌터카" />
      <List title="챙길 것" kind="item" view={view} canEdit={canEdit} busy={busy} run={run} placeholder="예 : 여권, 충전기" />
      {!canEdit && <p className="text-tiny text-ink-sub">보기만 권한이라 준비 목록을 고칠 수 없어요</p>}
    </div>
  );
}

/* 어두운 카드 위 분류 색 (바탕 #2D3139 와 4.5 : 1 이상) */
const CAT_BAR: Record<string, string> = { "식사": "#FF8466", "쇼핑": "#B4A5FF", "이동": "#6FD3A8", "관광": "#FFD479", "숙소": "#8EC5FF" };

const DEFAULT_ITEMS = ["여권", "충전기", "보조배터리", "상비약", "환전", "여행자 보험", "유심 또는 eSIM", "세면도구"];

type RunFn = (fn: () => Promise<{ error?: string } | undefined | void>) => void;

function Budget({ view, canEdit, busy, run }: { view: PrepView; canEdit: boolean; busy: boolean; run: RunFn }) {
  const cur = view.budget?.currency ?? view.currency;
  const d = decimalsOf(cur);
  const [edit, setEdit] = useState(false);
  const [amount, setAmount] = useState(view.budget ? String(view.budget.total / 10 ** d) : "");
  const total = view.budget?.total ?? 0;
  const left = total - view.spent;
  /* [원화로 보기] (2026-11-16 마루님) : 누르면 카드의 외화 금액이 모두 원화로 바뀐다. 다시 누르면 원래 통화 */
  const [inKrw, setInKrw] = useState(false);
  const money = (minor: number) => (inKrw && view.krw ? `₩${Math.round((minor / 10 ** d) * view.krw).toLocaleString("ko-KR")}` : formatMoney(minor, cur));
  const pct = total ? Math.min(100, Math.round((view.spent / total) * 100)) : 0;
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
  /* 어두운 남은 예산 카드 (피그마 06 준비). 도장처럼 테마를 따라가지 않는 카드라 막대 색은 여기서 정한다 */
  return (
    <section className="flex flex-col gap-3 rounded-deep bg-deep p-5 text-on-deep" aria-labelledby="budget-title">
      <div className="flex items-center justify-between gap-2">
        <h2 id="budget-title" className="text-sub font-semibold text-on-deep-sub">{view.budget ? (left < 0 ? "예산을 넘었어요" : "남은 예산") : "예상 비용"}</h2>
        <span className="flex items-center gap-1.5">
          {view.krw && <button type="button" onClick={() => setInKrw((v) => !v)} aria-pressed={inKrw}
            className="press inline-flex h-8 items-center rounded-full border border-deep-soft px-3 text-tiny font-semibold text-on-deep">{inKrw ? `${cur}로 보기` : "원화로 보기"}</button>}
          {editBtn}
        </span>
      </div>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-number font-extrabold tabular-nums">{inKrw && "약 "}{money(view.budget ? left : view.spent)}</span>
        {view.budget && <span className="text-sub text-on-deep-sub">/ {money(total)}</span>}
      </p>
      {/* 원화 환산 (참고용, 2026-11-16 마루님) */}
      <div className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-deep-soft" role="img"
        aria-label={view.budget ? `예산의 ${pct}% 사용` : "분류별 예상 비용"}>
        {view.byCategory.map((c) => (
          <span key={c.category} className="h-full" style={{ width: `${(c.amount / Math.max(total, view.spent, 1)) * 100}%`, background: CAT_BAR[c.category] }} />
        ))}
      </div>
      {view.byCategory.length > 0 ? (
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          {view.byCategory.map((c) => (
            <li key={c.category} className="flex items-center gap-1.5 text-tiny font-semibold" style={{ color: CAT_BAR[c.category] }}>
              <span aria-hidden className="size-2 rounded-full" style={{ background: CAT_BAR[c.category] }} />
              {c.category} <span className="tabular-nums">{money(c.amount)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-tiny text-on-deep-sub">장소에 예상 비용을 적으면 분류별로 여기에 모여요</p>
      )}
      <p className="text-tiny text-on-deep-sub">{cur} 로 적은 장소 예상 비용만 더해요{inKrw && view.krw ? `. 원화는 1 ${cur} = ${view.krw < 10 ? view.krw.toFixed(2) : Math.round(view.krw).toLocaleString("ko-KR")}원 기준 참고용이에요` : ""}</p>
      {/* 경비와 정산은 따로 줄을 두지 않고 예산 카드 안에서 들어간다 (2026-11-16 마루님) */}
      <Link href={`/trips/${view.tripId}/expenses`} className="press -mx-5 -mb-5 mt-1 flex min-h-12 items-center justify-between gap-2 border-t border-deep-soft px-5 py-3 text-sub font-bold text-on-deep">
        경비와 정산 보기<Icon name="right" size={18} className="text-on-deep-sub" />
      </Link>
    </section>
  );
}

function List({ title, kind, view, canEdit, busy, run, placeholder }: {
  title: string; kind: "item" | "reservation"; view: PrepView; canEdit: boolean; busy: boolean; run: RunFn; placeholder: string;
}) {
  const items = view.items.filter((x) => x.kind === kind);
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
              {items.map((it) => <Row key={it.id} it={it} view={view} canEdit={canEdit} busy={busy} run={run} />)}
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
    <li className="flex flex-col gap-2 px-4 py-3">
      <Field label="이름" name={`edit-${it.id}`} value={title} maxLength={80} disabled={busy} autoFocus
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing && title.trim()) { e.preventDefault(); save(); } if (e.key === "Escape") setEdit(false); }} />
      {it.kind === "reservation" && <Field label="날짜 (선택)" name={`edit-due-${it.id}`} type="date" value={due} onChange={(e) => setDue(e.target.value)} disabled={busy} />}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" disabled={busy} onClick={() => { setEdit(false); setTitle(it.title); setDue(it.due ?? ""); }}>취소</Button>
        <Button type="button" disabled={busy || !title.trim()} onClick={save}>저장</Button>
      </div>
    </li>
  );
  return (
    <li className="flex min-h-14 items-center gap-3 px-4 py-2">
      <button type="button" role="checkbox" aria-checked={it.done} aria-label={`${it.title} ${it.done ? "끝냄" : "안 끝냄"}`} disabled={!canEdit || busy}
        onClick={() => run(() => updatePrepItem(view.tripId, it.id, { done: !it.done }))}
        className={"press flex size-7 flex-none items-center justify-center rounded-full border-2 " + (it.done ? "border-btn bg-btn text-on-btn" : "border-line-strong text-transparent")}>
        <Icon name="check" size={14} strokeWidth={2.5} />
      </button>
      <div className="min-w-0 flex-1">
        {canEdit ? (
          <button type="button" onClick={() => setEdit(true)} disabled={busy} aria-label={`${it.title} 수정`}
            className={"block w-full truncate text-left text-body " + (it.done ? "text-ink-sub line-through" : "text-ink")}>{it.title}</button>
        ) : <p className={"truncate text-body " + (it.done ? "text-ink-sub line-through" : "text-ink")}>{it.title}</p>}
        {it.kind === "reservation" ? (
          /* 예약 지갑 (0034) : 예약번호와 첨부가 보이고, 누르면 예약 화면 */
          <Link href={`/trips/${view.tripId}/bookings/${it.id}`} className="inline-flex max-w-full items-center gap-1 text-tiny text-ink-sub">
            {it.code ? <span className="truncate font-semibold text-ink">{it.code}</span> : <span className="underline underline-offset-2">예약번호, 파일 넣기</span>}
            {(it.files ?? 0) > 0 && <span className="flex-none">· 파일 {it.files}</span>}
            <Icon name="right" size={12} className="flex-none" />
          </Link>
        ) : it.itemId && <Link href={`/trips/${view.tripId}/places/${it.itemId}`} className="inline-flex items-center gap-0.5 text-tiny text-ink-sub underline underline-offset-2"><Icon name="pin" size={12} />일정 장소</Link>}
      </div>
      {it.due && <span className={"flex-none rounded-full px-2.5 py-1 text-tiny font-semibold " + (it.done ? "bg-surface-soft text-ink" : "bg-warn-soft text-warn-text")}>{md(it.due)}</span>}
      {who?.avatar ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={who.avatar} alt="" title={`담당 ${name}`} width={32} height={32} className="size-8 flex-none rounded-full object-cover" />
        : name && <span title={`담당 ${name}`} className="flex size-8 flex-none items-center justify-center rounded-full bg-accent-soft text-tiny font-bold text-accent-text">{[...name][0]}</span>}
      {canEdit && <RowMenu it={it} view={view} busy={busy} run={run} onEdit={() => setEdit(true)} />}
    </li>
  );
}

/* 줄 오른쪽 ⋯ 메뉴 : 담당자 지정, 수정, 삭제 (2026-11-16 마루님 "버튼이 칸을 너무 차지해") */
function RowMenu({ it, view, busy, run, onEdit }: { it: PrepItem; view: PrepView; busy: boolean; run: RunFn; onEdit: () => void }) {
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
                <button type="button" role="menuitem" autoFocus className={item} onClick={() => setOpen("who")}><Icon name="user" size={18} className="text-ink-sub" />담당자 지정</button>
                <button type="button" role="menuitem" className={item} onClick={() => { close(); onEdit(); }}><Icon name="pencil" size={18} className="text-ink-sub" />수정</button>
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
