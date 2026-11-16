"use client";
/*
  경비 탭 (6단계 3번, 2026-11-16 마루님 개편)
  - 맨 위 : 예산 중 얼마 썼는지 한 줄 (예산 통화로 적은 경비만), 정산 요약 (내가 받을 돈 / 보낼 돈을 크게, 그 아래 누가 누구에게)
  - [+ 경비 추가] 를 누르면 아래에서 입력 창이 올라온다. 금액이 맨 위, 내용은 빠른 칩, 날짜는 오늘(여행 전이면 1일차)
  - [장소에서 가져오기] : 장소에 적은 예상 비용을 골라 미리 채운다. 한 장소는 한 번만 (0036 item_id)
  - 목록은 날짜별로 묶고, 날짜마다 합계. 줄을 누르면 수정
  - 통화가 섞이면 (2026-11-17 마루님 "원화로 묶기") 여행 환율(0040)로 원화 하나로 바꿔 정산하고, 맨 위에 총 ○○원 + 통화별 금액 + 환율 기준.
    환율을 모르는 통화만 따로 계산. 나누어떨어지지 않는 나머지는 낸 사람이 떠안음 (lib/settle.ts)
*/
import { useEffect, useMemo, useState, useTransition } from "react";
import { Button, Icon } from "@/components/kit";
import { Avatar } from "@/components/screen";
import { AlertDialog } from "@/components/gate";
import { saveExpense, removeExpense } from "@/app/actions";
import { safeCall } from "@/lib/safe-call";
import { decimalsOf, formatMoney, curName, currencyOptions, ALL_CURRENCIES, keepScroll } from "@/lib/countries";
import { balances, settle, toKrw, isMixed } from "@/lib/settle";
import { RateDialog, rateText } from "@/components/rate-dialog";
import { md, weekday, todayKST } from "@/lib/mock";
import type { Expense, ExpensesView } from "@/lib/trips";

const QUICK = ["식사", "카페", "교통", "숙소", "쇼핑", "입장료"];
type Draft = Partial<Expense> & { fromPlace?: boolean };

export function ExpensesPanel({ view, budget, openAdd }: { view: ExpensesView; budget?: React.ReactNode; openAdd?: boolean }) {
  const canEdit = view.role !== "viewer";
  const person = (id: string) => view.people.find((p) => p.userId === id);
  const nameOf = (id: string) => (id === view.me ? "나" : person(id)?.name ?? "나간 사람");
  const mixed = isMixed(view.expenses);
  // 통화가 섞이면 환율로 원화 하나로 바꿔서 정산 (모두 같은 여행 환율을 쓰니 사람마다 금액이 같다)
  const base = useMemo(() => (mixed ? toKrw(view.expenses, view.rates, decimalsOf) : view.expenses), [mixed, view.expenses, view.rates]);
  const transfers = useMemo(() => settle(base), [base]);
  const mine = useMemo(() => balances(base).filter((b) => b.userId === view.me && (b.paid || b.share)), [base, view.me]);
  const [rateCur, setRateCur] = useState<string | null>(null);
  const active = view.people.filter((p) => p.active);
  const [sheet, setSheet] = useState<Draft | null>(openAdd && view.role !== "viewer" ? {} : null); // 홈 [+ 경비] 로 오면 바로 입력 창
  const [picking, setPicking] = useState(false);

  const groups = useMemo(() => {
    const m = new Map<string, Expense[]>();
    for (const e of view.expenses) m.set(e.spentOn ?? "", [...(m.get(e.spentOn ?? "") ?? []), e]);
    return [...m].sort(([a], [b]) => (a === "" ? 1 : b === "" ? -1 : b.localeCompare(a)));
  }, [view.expenses]);
  const sumText = (list: Expense[]) => {
    const t = new Map<string, number>();
    for (const e of list) t.set(e.currency, (t.get(e.currency) ?? 0) + e.amount);
    return [...t].map(([c, n]) => formatMoney(n, c)).join(", ");
  };

  return (
    <div className="flex flex-col gap-5 px-5 pb-32 pt-5">
      {/* 예산, 정산, 경비 세 구역 (2026-11-16 마루님 "혼란스럽지 않게 명확히"). 어두운 카드는 예산 하나만 */}
      {budget && <Part title="예산" desc="얼마까지 쓸지 정하고, 실제로 쓴 돈과 비교해요">{budget}</Part>}
      {/* 정산 : 함께하는 사람이 2명 이상일 때만 */}
      {active.length > 1 && <Part title="정산" desc="적은 경비로 누가 누구에게 얼마를 보내면 되는지 계산해요">
      <section className="flex flex-col gap-3 rounded-card bg-surface p-5" aria-label="정산 결과">
        {view.expenses.length === 0 ? (
          <p className="text-sub text-ink-sub">아래에 경비를 적으면 누가 누구에게 얼마를 보내면 되는지 알려 줘요</p>
        ) : mine.length === 0 || mine.every((b) => b.net === 0) ? (
          <p className="text-title font-extrabold text-ink">{transfers.length ? "내가 주고받을 돈은 없어요" : "주고받을 돈이 없어요"}</p>
        ) : (
          <div className="flex flex-col gap-1">
            {mine.filter((b) => b.net !== 0).map((b) => (
              <p key={b.currency} className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-sub font-semibold text-ink-sub">{b.net > 0 ? "받을 돈" : "보낼 돈"}</span>
                <span className={"text-number font-extrabold tabular-nums " + (b.net > 0 ? "text-ink" : "text-point-text")}>{formatMoney(Math.abs(b.net), b.currency)}</span>
              </p>
            ))}
          </div>
        )}
        {transfers.length > 0 && (
          <ul className="flex flex-col gap-2 border-t border-line pt-3">
            {transfers.map((t, i) => (
              <li key={i} className="flex items-center gap-2 text-sub text-ink">
                <Face id={t.from} view={view} size={26} />
                <span className="font-bold">{nameOf(t.from)}</span>
                <Icon name="right" size={14} className="text-ink-sub" />
                <Face id={t.to} view={view} size={26} />
                <span className="min-w-0 flex-1 truncate font-bold">{nameOf(t.to)}</span>
                <span className="flex-none font-bold tabular-nums">{formatMoney(t.amount, t.currency)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      </Part>}

      <Part title="경비" desc="실제로 낸 돈을 적어요">
      {canEdit ? (
        <div className="flex gap-2">
          <Button type="button" size="lg" full onClick={() => setSheet({})}><Icon name="plus" size={18} />경비 추가</Button>
          {view.importable.length > 0 && (
            <Button type="button" size="lg" variant="secondary" className="whitespace-nowrap" onClick={() => setPicking(true)}>장소에서 가져오기</Button>
          )}
        </div>
      ) : <p className="text-tiny text-ink-sub">보기만 권한이라 경비를 적을 수 없어요</p>}

      {mixed && <TotalCard view={view} onRate={setRateCur} />}

      {/* 날짜별 목록 */}
      {groups.length === 0 ? (
        <p className="rounded-card bg-surface px-4 py-6 text-center text-sub text-ink-sub">아직 적은 경비가 없어요</p>
      ) : groups.map(([date, list]) => (
        <section key={date || "none"} className="flex flex-col gap-2" aria-label={date ? md(date) : "날짜 없음"}>
          <div className="flex items-end justify-between px-1">
            <h3 className="text-sub font-bold text-ink">{date ? `${md(date)} (${weekday(date)})` : "날짜 없음"}</h3>
            <span className="text-tiny font-semibold text-ink-sub tabular-nums">{sumText(list)}</span>
          </div>
          <ul className="divide-y divide-line overflow-hidden rounded-card bg-surface">
            {list.map((e) => {
              const share = e.splitWith.includes(view.me) ? balances([e]).find((b) => b.userId === view.me)?.share : undefined;
              return (
                <li key={e.id}>
                  <button type="button" disabled={!canEdit} onClick={() => setSheet(e)}
                    className="press flex min-h-16 w-full items-center gap-3 px-4 py-2.5 text-left disabled:cursor-default">
                    <Face id={e.paidBy} view={view} size={36} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body font-bold text-ink">{e.title}</span>
                      <span className="block truncate text-tiny text-ink-sub">{nameOf(e.paidBy)} 냄, {e.splitWith.length}명이 나눔{e.itemId ? ", 장소에서 가져옴" : ""}</span>
                    </span>
                    <span className="flex flex-none flex-col items-end">
                      <span className="text-body font-bold tabular-nums text-ink">{formatMoney(e.amount, e.currency)}</span>
                      {share != null && e.splitWith.length > 1 && <span className="text-tiny tabular-nums text-ink-sub">내 몫 {formatMoney(share, e.currency)}</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      {view.expenses.length > 0 && active.length > 1 && <p className="px-1 text-tiny text-ink-sub">{mixed ? "여러 통화는 환율로 원화로 바꿔 정산해요. " : ""}나누어떨어지지 않는 나머지는 낸 사람이 떠안아요</p>}
      </Part>

      {rateCur && <RateDialog tripId={view.tripId} cur={rateCur} current={view.rates[rateCur]?.krw ?? null} auto={view.rates[rateCur]?.auto ?? null}
        custom={!!view.rates[rateCur]?.custom} canEdit={canEdit} onClose={() => setRateCur(null)} />}

      {picking && (
        <Modal title="장소에서 가져오기" onClose={() => setPicking(false)}>
          <p className="text-sub text-ink-sub">장소에 적은 예상 경비로 채워요. 실제 낸 금액으로 고쳐서 저장해 주세요</p>
          <ul className="divide-y divide-line overflow-hidden rounded-card bg-surface">
            {view.importable.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => { setPicking(false); setSheet({ title: p.title, amount: p.amount, currency: p.currency, spentOn: p.date, itemId: p.id, fromPlace: true }); }}
                  className="press flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body font-bold text-ink">{p.title}</span>
                    <span className="block text-tiny text-ink-sub">{p.date ? `${md(p.date)} (${weekday(p.date)})` : "날짜 미정"}</span>
                  </span>
                  <span className="flex-none text-body font-bold tabular-nums text-ink">{formatMoney(p.amount, p.currency)}</span>
                  <Icon name="right" size={16} className="flex-none text-ink-sub" />
                </button>
              </li>
            ))}
          </ul>
        </Modal>
      )}
      {sheet && <ExpenseSheet view={view} draft={sheet} onClose={() => setSheet(null)} />}
    </div>
  );
}

function Part({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3" aria-label={title}>
      <div className="px-1">
        <h2 className="text-title font-bold text-ink">{title}</h2>
        <p className="text-tiny text-ink-sub">{desc}</p>
      </div>
      {children}
    </section>
  );
}

function Face({ id, view, size }: { id: string; view: ExpensesView; size: number }) {
  const p = view.people.find((x) => x.userId === id);
  const name = id === view.me ? "나" : p?.name ?? "?";
  return <Avatar initial={[...name][0] ?? "?"} src={p?.avatar} size={size} tone={id === view.me ? "point" : "accent"} />;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    addEventListener("keydown", esc);
    const o = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { removeEventListener("keydown", esc); document.body.style.overflow = o; };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92dvh] w-full max-w-[560px] flex-col gap-4 overflow-y-auto rounded-t-[28px] bg-bg px-5 pb-[max(24px,env(safe-area-inset-bottom))] pt-2.5">
        <span className="mx-auto h-1.5 w-10 flex-none rounded-full bg-line-strong/50" />
        <div className="flex items-center justify-between">
          <h2 className="text-title-lg font-extrabold text-ink">{title}</h2>
          <button type="button" onClick={onClose} aria-label="닫기" className="press flex size-10 items-center justify-center rounded-full text-ink-sub"><Icon name="x" size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Pick({ on, children, onClick, disabled }: { on: boolean; children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} disabled={disabled}
      className={"press inline-flex h-10 items-center gap-1.5 rounded-full px-3.5 text-sub font-bold disabled:opacity-50 " + (on ? "bg-btn text-on-btn" : "border border-line-strong bg-surface text-ink")}>
      {children}
    </button>
  );
}

function ExpenseSheet({ view, draft, onClose }: { view: ExpensesView; draft: Draft; onClose: () => void }) {
  const editing = draft.id ? draft : null;
  const active = view.people.filter((p) => p.active);
  const today = todayKST();
  const defDate = today < view.start ? view.start : today > view.end ? "" : today;
  /* 날짜의 기본 통화 (2026-11-17) : 그날 일정이 있는 도시 통화 → 첫 도시 통화 → 예전 기본값 */
  const curOfDate = (dt: string) => {
    const i = dt ? Math.round((Date.parse(dt) - Date.parse(view.start)) / 864e5) : -1;
    return (i >= 0 && view.dayCurrency[i]) || view.currencies[0] || view.currency;
  };
  const startCur = draft.currency ?? curOfDate(draft.spentOn ?? (editing ? "" : defDate));
  const [curTouched, setCurTouched] = useState(!!draft.currency);
  const [title, setTitle] = useState(draft.title ?? "");
  const [currency, setCurrency] = useState(startCur);
  const [amount, setAmount] = useState(draft.amount != null ? String(draft.amount / 10 ** decimalsOf(startCur)) : "");
  const [date, setDate] = useState(draft.spentOn ?? (editing ? "" : defDate));
  const currencies = currencyOptions(view.currencies, currency);
  const shown = currencies.slice(0, 4);
  const pickCur = (c: string) => { setCurrency(c); setCurTouched(true); };
  const [paidBy, setPaidBy] = useState(draft.paidBy ?? view.me);
  const [split, setSplit] = useState<string[]>(draft.splitWith ?? active.map((p) => p.userId));
  const [error, setError] = useState("");
  const [asking, setAsking] = useState(false);
  const [busy, start] = useTransition();
  const label = (id: string) => (id === view.me ? "나" : view.people.find((p) => p.userId === id)?.name ?? "나간 사람");
  const toggle = (id: string) => setSplit((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const all = split.length === active.length;
  const d = decimalsOf(currency);
  const num = Number(amount.replace(/,/g, ""));
  const each = num > 0 && split.length ? Math.floor((num * 10 ** d) / split.length) : 0;
  const missing = !amount || !(num > 0) ? "금액을 적어 주세요" : !title.trim() ? "내용을 적거나 골라 주세요" : !split.length ? "나눌 사람을 한 명 이상 골라 주세요" : "";

  const submit = () => start(async () => {
    setError("");
    const r = await safeCall(() => saveExpense(view.tripId, editing?.id ?? null, {
      title, amount, currency, paidBy, splitWith: split, spentOn: date || null, ...(draft.itemId !== undefined ? { itemId: draft.itemId } : {}),
    }));
    if (r?.error) return setError(r.error);
    onClose();
  });
  const remove = () => start(async () => {
    const r = await safeCall(() => removeExpense(view.tripId, editing!.id!));
    if (r?.error) setError(r.error); else onClose();
  });

  return (
    <Modal title={editing ? "경비 수정" : "경비 추가"} onClose={onClose}>
      {draft.fromPlace && <p className="rounded-field bg-surface px-3 py-2 text-tiny font-semibold text-ink-sub">장소의 예상 경비로 채웠어요. 실제 낸 금액으로 고쳐 주세요</p>}
      {/* 금액이 맨 위, 통화는 금액 바로 아래 칩 */}
      <label className="flex flex-col gap-2">
        <span className="text-sub font-semibold text-ink">금액</span>
        <span className="flex items-baseline gap-2 border-b-2 border-line-strong pb-1 focus-within:border-ink">
          <input name="amount" inputMode={d ? "decimal" : "numeric"} placeholder="0" value={amount} autoFocus={!editing && !draft.fromPlace} disabled={busy}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))}
            className="min-w-0 flex-1 bg-transparent text-[32px] font-extrabold tabular-nums text-ink outline-none placeholder:text-ink-sub/50" />
          <span className="flex-none text-title font-bold text-ink-sub">{curName(currency)}</span>
        </span>
      </label>
      <div className="flex flex-wrap gap-2" role="group" aria-label="통화">
        {/* 여행 통화 → 원 → 달러, 4개까지. 나머지는 [기타] (2026-11-17) */}
        {(shown.includes(currency) ? shown : [...shown.slice(0, 3), currency]).map((c) => <Pick key={c} on={currency === c} onClick={() => pickCur(c)} disabled={busy}>{curName(c)}</Pick>)}
        <label className="press relative inline-flex h-10 items-center gap-1 rounded-full border border-line-strong bg-surface px-3.5 text-sub font-bold text-ink">
          기타<Icon name="chevron-down" size={14} />
          <select aria-label="다른 통화 고르기" value="" disabled={busy} onChange={(e) => { if (!e.target.value) return; keepScroll(e.target); pickCur(e.target.value); }} className="absolute inset-0 cursor-pointer opacity-0">
            <option value="">다른 통화</option>
            {ALL_CURRENCIES.filter((c) => !shown.includes(c)).map((c) => <option key={c} value={c}>{curName(c)} ({c})</option>)}
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-2">
        <span className="text-sub font-semibold text-ink">내용</span>
        <input name="title" value={title} maxLength={60} disabled={busy} onChange={(e) => setTitle(e.target.value)} placeholder="직접 적거나 아래에서 골라요"
          className="h-12 rounded-field border border-line-strong bg-surface px-4 text-[16px] text-ink outline-none placeholder:text-ink-sub focus:border-ink focus:ring-2 focus:ring-ink/15" />
      </label>
      <div className="-mt-2 flex flex-wrap gap-1.5" role="group" aria-label="자주 쓰는 내용">
        {QUICK.map((q) => (
          <button key={q} type="button" onClick={() => setTitle(q)} disabled={busy}
            className={"press h-8 rounded-full px-3 text-tiny font-bold " + (title === q ? "bg-btn text-on-btn" : "bg-surface text-ink-sub ring-1 ring-line")}>{q}</button>
        ))}
      </div>

      <label className="flex flex-col gap-2">
        <span className="text-sub font-semibold text-ink">날짜 (선택)</span>
        <input type="date" name="date" value={date} disabled={busy} onChange={(e) => { setDate(e.target.value); if (!curTouched && !editing) setCurrency(curOfDate(e.target.value)); }}
          className="h-12 rounded-field border border-line-strong bg-surface px-4 text-[16px] text-ink outline-none focus:border-ink focus:ring-2 focus:ring-ink/15" />
      </label>

      <div className="flex flex-col gap-2">
        <span className="text-sub font-semibold text-ink">낸 사람</span>
        <div className="flex flex-wrap gap-2" role="group" aria-label="낸 사람">
          {active.map((p) => <Pick key={p.userId} on={paidBy === p.userId} onClick={() => setPaidBy(p.userId)} disabled={busy}><Face id={p.userId} view={view} size={24} />{label(p.userId)}</Pick>)}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-sub font-semibold text-ink">나눌 사람 ({split.length}명)</span>
          {active.length > 1 && <button type="button" onClick={() => setSplit(all ? [view.me] : active.map((p) => p.userId))} disabled={busy}
            className="press h-8 rounded-full px-3 text-tiny font-bold text-ink ring-1 ring-line">{all ? "나만" : "모두"}</button>}
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="나눌 사람">
          {active.map((p) => <Pick key={p.userId} on={split.includes(p.userId)} onClick={() => toggle(p.userId)} disabled={busy}><Face id={p.userId} view={view} size={24} />{label(p.userId)}</Pick>)}
        </div>
        {each > 0 && split.length > 1 && <p className="text-sub font-semibold text-ink">1인 <span className="tabular-nums">{formatMoney(each, currency)}</span></p>}
      </div>

      {error && <p role="alert" className="text-sub font-semibold text-point-text">{error}</p>}
      <div className="flex flex-col gap-1.5">
        <Button type="button" size="lg" full disabled={busy || !!missing} onClick={submit}>{busy ? "저장하는 중" : "저장"}</Button>
        {missing && !busy && <p className="text-center text-tiny text-ink-sub">{missing}</p>}
      </div>
      {editing && (
        <div className="flex justify-center">
          <button type="button" onClick={() => setAsking(true)} disabled={busy} className="press inline-flex h-10 items-center gap-1 rounded-full px-3 text-sub font-semibold text-point-text"><Icon name="trash" size={16} />경비 삭제</button>
        </div>
      )}
      {asking && <AlertDialog title="경비를 삭제할까요?" desc={`"${title}"이(가) 목록과 정산에서 빠져요`} confirmLabel="삭제"
        confirm={remove} onClose={() => setAsking(false)} />}
    </Modal>
  );
}

/*
  총 경비 (통화가 섞였을 때) : 크게 "약 ○○원", 아래에 통화별 금액, 환율 기준과 [환율 수정]
  환율을 모르는 통화는 원화 합에서 빼고 "환율 없음" 으로 따로 보여 준다
*/
function TotalCard({ view, onRate }: { view: ExpensesView; onRate: (cur: string) => void }) {
  const by = new Map<string, number>();
  for (const e of view.expenses) by.set(e.currency, (by.get(e.currency) ?? 0) + e.amount);
  const list = [...by].sort(([a], [b]) => (a === "KRW" ? 1 : b === "KRW" ? -1 : 0));
  let krw = 0;
  const unknown: string[] = [];
  for (const [c, n] of list) {
    if (c === "KRW") krw += n;
    else if (view.rates[c]) krw += Math.round((n / 10 ** decimalsOf(c)) * view.rates[c].krw);
    else unknown.push(c);
  }
  const foreign = list.map(([c]) => c).filter((c) => c !== "KRW");
  return (
    <section className="flex flex-col gap-3 rounded-card bg-surface p-5" aria-label="총 경비">
      <div>
        <p className="text-sub font-semibold text-ink-sub">총 경비</p>
        <p className="text-number font-extrabold tabular-nums text-ink">약 {formatMoney(krw, "KRW")}</p>
        {unknown.length > 0 && <p className="text-tiny text-point-text">{unknown.map(curName).join(", ")}는 환율을 몰라 빼고 더했어요</p>}
      </div>
      <ul className="flex flex-col gap-1 border-t border-line pt-3 text-sub">
        {list.map(([c, n]) => (
          <li key={c} className="flex items-center justify-between gap-2">
            <span className="text-ink-sub">{curName(c)}</span>
            <span className="font-bold tabular-nums text-ink">{formatMoney(n, c)}</span>
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-1.5 border-t border-line pt-3">
        <p className="text-tiny font-semibold text-ink-sub">환율 기준</p>
        {foreign.map((c) => {
          const r = view.rates[c];
          return (
            <div key={c} className="flex items-center justify-between gap-2">
              <span className="min-w-0 flex-1 text-tiny text-ink-sub">{r ? `1 ${c} = ${rateText(r.krw)}원${r.custom ? " (직접 정한 환율)" : " (오늘 환율)"}` : `${c} 환율을 받아 오지 못했어요`}</span>
              <button type="button" onClick={() => onRate(c)} className="press inline-flex h-8 flex-none items-center gap-1 rounded-full bg-surface-sub px-3 text-tiny font-semibold text-ink">
                <Icon name="pencil" size={13} />환율 수정
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
