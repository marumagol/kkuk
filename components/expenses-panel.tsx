"use client";
/*
  경비와 정산 (6단계 3번)
  - 위 : 정산 (통화별 "누가 누구에게 얼마"), 나의 낸 돈과 쓴 몫
  - 가운데 : 경비 추가 (내용, 금액, 통화, 낸 사람, 나눌 사람. 기본은 나 + 함께하는 사람 모두)
  - 아래 : 경비 목록 (누르면 고치기)
*/
import { useMemo, useState, useTransition } from "react";
import { Button, Field } from "@/components/kit";
import { saveExpense, removeExpense } from "@/app/actions";
import { safeCall } from "@/lib/safe-call";
import { decimalsOf, formatMoney } from "@/lib/countries";
import { balances, settle } from "@/lib/settle";
import type { Expense, ExpensesView } from "@/lib/trips";

const CUR_NAME: Record<string, string> = { KRW: "원", JPY: "엔", USD: "달러", EUR: "유로", TWD: "대만 달러", CNY: "위안", THB: "바트", VND: "동", HKD: "홍콩 달러", GBP: "파운드" };

function Pick({ on, children, onClick, disabled }: { on: boolean; children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} disabled={disabled}
      className={"press inline-flex h-11 items-center rounded-full px-4 text-sub font-bold disabled:opacity-50 " + (on ? "bg-btn text-on-btn" : "border border-line-strong bg-surface text-ink")}>
      {children}
    </button>
  );
}

export function ExpensesPanel({ view }: { view: ExpensesView }) {
  const canEdit = view.role !== "viewer";
  const nameOf = (id: string) => (id === view.me ? "나" : view.people.find((p) => p.userId === id)?.name ?? "나간 사람");
  const active = view.people.filter((p) => p.active);
  const transfers = useMemo(() => settle(view.expenses), [view.expenses]);
  const mine = useMemo(() => balances(view.expenses).filter((b) => b.userId === view.me), [view.expenses, view.me]);
  const [editing, setEditing] = useState<Expense | null>(null);

  return (
    <div className="flex flex-col gap-5 px-5 pb-10 pt-5">
      <section className="flex flex-col gap-3 rounded-card bg-surface p-5" aria-labelledby="settle-title">
        <h2 id="settle-title" className="text-body font-bold text-ink">정산</h2>
        {view.expenses.length === 0 ? (
          <p className="text-sub text-ink-sub">경비를 적으면 누가 누구에게 얼마를 보내면 되는지 계산해 줘요</p>
        ) : transfers.length === 0 ? (
          <p className="text-sub font-semibold text-ink">주고받을 돈이 없어요</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {transfers.map((t, i) => (
              <li key={i} className="flex items-center justify-between gap-3 text-body">
                <span className="min-w-0 truncate text-ink"><b>{nameOf(t.from)}</b> → <b>{nameOf(t.to)}</b></span>
                <span className="flex-none font-bold text-ink">{formatMoney(t.amount, t.currency)}</span>
              </li>
            ))}
          </ul>
        )}
        {mine.map((b) => (
          <p key={b.currency} className="text-tiny text-ink-sub">
            나 : 낸 돈 {formatMoney(b.paid, b.currency)}, 내 몫 {formatMoney(b.share, b.currency)}
            {b.net > 0 ? `, 받을 돈 ${formatMoney(b.net, b.currency)}` : b.net < 0 ? `, 보낼 돈 ${formatMoney(-b.net, b.currency)}` : ""}
          </p>
        ))}
        <p className="text-tiny text-ink-sub">통화가 다르면 따로 계산해요. 나누어떨어지지 않는 몇 원은 낸 사람이 떠안아요</p>
      </section>

      {canEdit ? (
        <ExpenseForm key={editing?.id ?? "new"} view={view} active={active} editing={editing} onDone={() => setEditing(null)} />
      ) : <p className="text-tiny text-ink-sub">보기만 권한이라 경비를 적을 수 없어요</p>}

      <section aria-labelledby="list-title" className="flex flex-col gap-2">
        <h2 id="list-title" className="text-body font-bold text-ink">경비 {view.expenses.length}건</h2>
        <ul className="divide-y divide-line rounded-card bg-surface">
          {view.expenses.map((e) => (
            <li key={e.id}>
              <button type="button" disabled={!canEdit} onClick={() => { setEditing(e); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                className="press flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left disabled:cursor-default">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body font-bold text-ink">{e.title}</p>
                  <p className="truncate text-tiny text-ink-sub">{nameOf(e.paidBy)} 냄, {e.splitWith.length}명이 나눔</p>
                </div>
                <span className="flex-none text-body font-bold text-ink">{formatMoney(e.amount, e.currency)}</span>
              </button>
            </li>
          ))}
          {view.expenses.length === 0 && <li className="px-4 py-5 text-center text-sub text-ink-sub">아직 적은 경비가 없어요</li>}
        </ul>
      </section>
    </div>
  );
}

function ExpenseForm({ view, active, editing, onDone }: { view: ExpensesView; active: ExpensesView["people"]; editing: Expense | null; onDone: () => void }) {
  const currencies = [...new Set([view.currency, editing?.currency ?? view.currency, "KRW", "USD"])];
  const [title, setTitle] = useState(editing?.title ?? "");
  const [currency, setCurrency] = useState(editing?.currency ?? view.currency);
  const [amount, setAmount] = useState(editing ? String(editing.amount / 10 ** decimalsOf(editing.currency)) : "");
  const [paidBy, setPaidBy] = useState(editing?.paidBy ?? view.me);
  const [split, setSplit] = useState<string[]>(editing?.splitWith ?? active.map((p) => p.userId));
  const [error, setError] = useState("");
  const [busy, start] = useTransition();
  const label = (id: string) => (id === view.me ? "나" : active.find((p) => p.userId === id)?.name ?? "나간 사람");
  const toggle = (id: string) => setSplit((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const submit = () => start(async () => {
    setError("");
    const r = await safeCall(() => saveExpense(view.tripId, editing?.id ?? null, { title, amount, currency, paidBy, splitWith: split }));
    if (r?.error) return setError(r.error);
    if (editing) onDone(); else { setTitle(""); setAmount(""); }
  });
  const remove = () => start(async () => {
    const r = await safeCall(() => removeExpense(view.tripId, editing!.id));
    if (r?.error) setError(r.error); else onDone();
  });
  return (
    <section className="flex flex-col gap-4 rounded-card bg-surface p-5" aria-labelledby="form-title">
      <h2 id="form-title" className="text-body font-bold text-ink">{editing ? "경비 수정" : "경비 추가"}</h2>
      <Field label="내용" name="title" placeholder="예 : 저녁, 택시" value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} disabled={busy} />
      <Field label={`금액 (${CUR_NAME[currency] ?? currency})`} name="amount" inputMode={decimalsOf(currency) ? "decimal" : "numeric"} placeholder="0"
        value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))} disabled={busy} />
      <div className="flex flex-wrap gap-2" role="group" aria-label="통화">
        {currencies.map((c) => <Pick key={c} on={currency === c} onClick={() => setCurrency(c)} disabled={busy}>{CUR_NAME[c] ?? c}</Pick>)}
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-sub font-bold text-ink-sub">낸 사람</span>
        <div className="flex flex-wrap gap-2" role="group" aria-label="낸 사람">
          {active.map((p) => <Pick key={p.userId} on={paidBy === p.userId} onClick={() => setPaidBy(p.userId)} disabled={busy}>{label(p.userId)}</Pick>)}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-sub font-bold text-ink-sub">나눌 사람 ({split.length}명)</span>
        <div className="flex flex-wrap gap-2" role="group" aria-label="나눌 사람">
          {active.map((p) => <Pick key={p.userId} on={split.includes(p.userId)} onClick={() => toggle(p.userId)} disabled={busy}>{label(p.userId)}</Pick>)}
        </div>
      </div>
      {error && <p role="alert" className="text-sub font-semibold text-point-text">{error}</p>}
      <div className="flex gap-2">
        {editing && <Button type="button" variant="secondary" onClick={onDone} disabled={busy}>취소</Button>}
        <Button type="button" full disabled={busy || !title.trim() || !amount || !split.length} onClick={submit}>{busy ? "저장하는 중" : editing ? "고친 내용 저장" : "경비 추가"}</Button>
      </div>
      {editing && <button type="button" onClick={remove} disabled={busy} className="press mx-auto h-11 px-2 text-sub font-semibold text-point-text underline underline-offset-2">이 경비 삭제</button>}
    </section>
  );
}
