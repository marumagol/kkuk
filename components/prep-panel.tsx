"use client";
/* 준비 탭 내용 : 예산 카드, 챙길 것, 예약. 저장은 app/actions.ts (RLS 가 권한 검사) */
import { useState, useTransition } from "react";
import { Button, Field, Icon } from "@/components/kit";
import { addPrepItem, updatePrepItem, saveBudget } from "@/app/actions";
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
      <List title="챙길 것" kind="item" view={view} canEdit={canEdit} busy={busy} run={run} placeholder="예 : 여권, 충전기" />
      <List title="예약" kind="reservation" view={view} canEdit={canEdit} busy={busy} run={run} placeholder="예 : 숙소, 렌터카" />
      {!canEdit && <p className="text-tiny text-ink-sub">보기만 권한이라 준비 목록을 고칠 수 없어요</p>}
    </div>
  );
}

type RunFn = (fn: () => Promise<{ error?: string } | undefined | void>) => void;

function Budget({ view, canEdit, busy, run }: { view: PrepView; canEdit: boolean; busy: boolean; run: RunFn }) {
  const cur = view.budget?.currency ?? view.currency;
  const d = decimalsOf(cur);
  const [edit, setEdit] = useState(false);
  const [amount, setAmount] = useState(view.budget ? String(view.budget.total / 10 ** d) : "");
  const total = view.budget?.total ?? 0;
  const left = total - view.spent;
  const pct = total ? Math.min(100, Math.round((view.spent / total) * 100)) : 0;
  return (
    <section className="flex flex-col gap-3 rounded-card bg-surface p-5" aria-labelledby="budget-title">
      <div className="flex items-center justify-between">
        <h2 id="budget-title" className="text-body font-bold text-ink">예산</h2>
        {canEdit && !edit && <button type="button" onClick={() => setEdit(true)} className="press h-9 px-1 text-tiny font-semibold text-ink-sub underline underline-offset-2">{view.budget ? "고치기" : "정하기"}</button>}
      </div>
      {edit ? (
        <div className="flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <Field label={`전체 예산 (${cur})`} name="budget" inputMode={d ? "decimal" : "numeric"} value={amount} placeholder="0"
              onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))} disabled={busy} />
          </div>
          <Button type="button" size="lg" disabled={busy || !amount} onClick={() => run(async () => { const r = await saveBudget(view.tripId, cur, amount); if (!r?.error) setEdit(false); return r; })}>저장</Button>
        </div>
      ) : view.budget ? (
        <>
          <p className="text-title-lg font-extrabold text-ink">남은 예산 {formatMoney(left, cur)}</p>
          <div className="h-2 overflow-hidden rounded-full bg-surface-soft" role="img" aria-label={`예산의 ${pct}% 사용`}>
            <div className={"h-full rounded-full " + (left < 0 ? "bg-[#C23A18]" : "bg-btn")} style={{ width: `${pct}%` }} />
          </div>
          <p className="text-tiny text-ink-sub">전체 {formatMoney(total, cur)} · 장소 예상 비용 합계 {formatMoney(view.spent, cur)}{left < 0 ? " · 예산을 넘었어요" : ""}</p>
        </>
      ) : (
        <p className="text-sub text-ink-sub">예산을 정하면 장소 예상 비용과 비교해서 남은 금액을 보여 줘요</p>
      )}
      <p className="text-tiny text-ink-sub">{cur} 로 적은 예상 비용만 더해요</p>
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
        {items.length > 0 && <span className="text-sub text-ink-sub">{done}/{items.length}</span>}
      </div>
      {items.length > 0 && (
        <ul className="divide-y divide-line rounded-card bg-surface">
          {items.map((it) => <Row key={it.id} it={it} view={view} canEdit={canEdit} busy={busy} run={run} />)}
        </ul>
      )}
      {canEdit && (
        <div className="flex flex-col gap-2">
          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <Field label={`${title} 추가`} name={`add-${kind}`} placeholder={placeholder} value={text} maxLength={80} disabled={busy}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing && text.trim()) { e.preventDefault(); add(); } }} />
            </div>
            <Button type="button" variant="secondary" size="lg" disabled={busy || !text.trim()} onClick={add}>추가</Button>
          </div>
          {kind === "reservation" && (
            <Field label="날짜 (선택)" name="due" type="date" value={due} onChange={(e) => setDue(e.target.value)} disabled={busy} />
          )}
        </div>
      )}
      {!items.length && !canEdit && <p className="rounded-pin bg-surface px-4 py-4 text-sub text-ink-sub">아직 없어요</p>}
    </section>
  );
}

function Row({ it, view, canEdit, busy, run }: { it: PrepItem; view: PrepView; canEdit: boolean; busy: boolean; run: RunFn }) {
  return (
    <li className="flex min-h-14 items-center gap-3 px-4 py-2">
      <button type="button" role="checkbox" aria-checked={it.done} aria-label={`${it.title} ${it.done ? "끝냄" : "안 끝냄"}`} disabled={!canEdit || busy}
        onClick={() => run(() => updatePrepItem(view.tripId, it.id, { done: !it.done }))}
        className={"press flex size-7 flex-none items-center justify-center rounded-full border-2 " + (it.done ? "border-btn bg-btn text-on-btn" : "border-line-strong text-transparent")}>
        <Icon name="check" size={14} strokeWidth={2.5} />
      </button>
      <div className="min-w-0 flex-1">
        <p className={"truncate text-body " + (it.done ? "text-ink-sub line-through" : "text-ink")}>{it.title}</p>
        {it.due && <p className="text-tiny text-ink-sub">{md(it.due)}</p>}
      </div>
      {canEdit ? (
        <label className="flex-none">
          <span className="sr-only">{it.title} 담당자</span>
          <select value={it.assignee ?? ""} disabled={busy} onChange={(e) => run(() => updatePrepItem(view.tripId, it.id, { assignee: e.target.value || null }))}
            className="h-9 max-w-28 rounded-field border border-line bg-surface px-2 text-tiny text-ink">
            <option value="">담당 없음</option>
            {view.people.map((p) => <option key={p.userId} value={p.userId}>{p.name}</option>)}
          </select>
        </label>
      ) : it.assignee ? <span className="flex-none text-tiny text-ink-sub">{view.people.find((p) => p.userId === it.assignee)?.name}</span> : null}
      {canEdit && (
        <button type="button" aria-label={`${it.title} 지우기`} disabled={busy} onClick={() => run(() => updatePrepItem(view.tripId, it.id, { remove: true }))}
          className="press flex size-9 flex-none items-center justify-center rounded-full text-ink-sub"><Icon name="x" size={16} /></button>
      )}
    </li>
  );
}
