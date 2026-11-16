"use client";
/*
  일정에 장소·메모 빠르게 넣기 (2026-11-16 마루님 "장소랑 메모 추가는 모달로, 편하고 빠르게")
  - 휴대폰 : 아래에서 올라오는 시트 / PC(sm 이상) : 가운데 창
  - 위 [장소 | 메모] 전환, 날짜 칩(지금 보던 날이 기본), 열리면 검색칸에 바로 커서
  - 장소 : 검색 결과를 한 번 누르면 바로 들어간다. 맨 아래 "'이름' 직접 넣기" 는 늘 보인다. Enter = 첫 결과(없으면 직접 넣기)
  - 메모 : 제목 + 내용. [추가하고 계속] / [추가]
  - 시간, 예약 필요는 [더 보기] 안에 접어 둔다. 넣은 뒤에도 창은 열려 있어 여러 곳을 연달아 넣는다
  - 편명, 사진, 비용 같은 자세한 칸은 일정에서 그 장소를 눌러 고친다 (/trips/[id]/places/[placeId])
*/
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/kit";
import { savePlace, findPlaces, pickPlace } from "@/app/actions";
import { safeCall } from "@/lib/safe-call";
import { MAX_PLACE_MEMO, MAX_PLACE_TITLE } from "@/lib/rules";
import { addDays, md, weekday } from "@/lib/mock";

const CATS = [
  { code: "sight", label: "관광" }, { code: "food", label: "식사" }, { code: "shopping", label: "쇼핑" },
  { code: "stay", label: "숙소" }, { code: "transport", label: "이동" },
];
type Sug = { id: string; main: string; sub: string };
export type QuickAddProps = {
  tripId: string; start: string; days: number; day: number | null; kind: "place" | "memo";
  searchable: boolean; bias: { lat: number; lng: number } | null; onClose: () => void;
};

const chip = (on: boolean) => "press inline-flex h-9 flex-none items-center rounded-full px-3.5 text-sub font-semibold " + (on ? "bg-btn text-on-btn" : "bg-surface text-ink");
const input = "h-12 w-full min-w-0 rounded-field border border-line-strong bg-surface px-4 text-body text-ink outline-none placeholder:text-ink-sub focus:border-ink focus:ring-2 focus:ring-ink/15";

export function QuickAdd({ tripId, start, days, day: startDay, kind: startKind, searchable, bias, onClose }: QuickAddProps) {
  const router = useRouter();
  const [kind, setKind] = useState(startKind);
  const [day, setDay] = useState<number | null>(startDay);
  const [category, setCategory] = useState("sight");
  const [q, setQ] = useState("");
  const [body, setBody] = useState("");
  const [more, setMore] = useState(false);
  const [time, setTime] = useState("");
  const [reserve, setReserve] = useState(false);
  const [list, setList] = useState<Sug[]>([]);
  const [searching, setSearching] = useState(false);
  const [limited, setLimited] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [added, setAdded] = useState<string[]>([]);
  const session = useRef("");
  const field = useRef<HTMLInputElement>(null);
  const back = useRef<Element | null>(null);
  const dayRow = useRef<HTMLDivElement>(null);

  // 열릴 때 : 뒤 화면 스크롤 막기, Esc 로 닫기, 닫으면 원래 단추로 포커스
  useEffect(() => {
    back.current = document.activeElement;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    dayRow.current?.querySelector<HTMLElement>("[aria-pressed=true]")?.scrollIntoView({ inline: "center", block: "nearest" });
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", esc); (back.current as HTMLElement | null)?.focus?.(); };
  }, [onClose]);
  useEffect(() => { field.current?.focus(); }, [kind]);

  // 장소 검색 : 두 글자부터 0.3초 쉬면
  const text = q.trim();
  useEffect(() => {
    if (kind !== "place" || !searchable || [...text].length < 2) { setList([]); setSearching(false); return; }
    if (!session.current) session.current = crypto.randomUUID();
    let alive = true;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const r = await findPlaces(text, session.current, "place", bias);
        if (!alive) return;
        if (Array.isArray(r)) { setList(r); setLimited(false); } else { setList([]); setLimited(true); }
      } catch { if (alive) setList([]); } finally { if (alive) setSearching(false); }
    }, 300);
    return () => { alive = false; clearTimeout(t); };
  }, [text, kind, searchable, bias]);

  async function add(title: string, extra: { address?: string; place?: { id: string; lat: number; lng: number }; memo?: string; keepOpen?: boolean } = {}) {
    const name = title.trim().slice(0, MAX_PLACE_TITLE);
    if (!name) { setError(kind === "memo" ? "메모 제목을 적어 주세요" : "장소 이름을 적어 주세요"); field.current?.focus(); return; }
    setBusy(true); setError("");
    const isMemo = kind === "memo";
    const r = await safeCall(() => savePlace(tripId, null, {
      title: name, address: extra.address ?? "", category: isMemo ? "memo" : category, time, cost: "", currency: "KRW",
      memo: extra.memo ?? "", day, stay: true, ...(isMemo ? {} : { reserve, ...(extra.place ? { place: extra.place } : {}) }),
    }));
    setBusy(false);
    if (r?.error) { setError(r.error); return; }
    setAdded((a) => [name, ...a]);
    setQ(""); setBody(""); setList([]); setTime(""); setReserve(false);
    router.refresh();
    if (extra.keepOpen === false) onClose(); else field.current?.focus();
  }

  async function pick(s: Sug) {
    setBusy(true);
    try {
      const d = await pickPlace(s.id, session.current);
      session.current = "";
      if (d) await add(d.name || s.main, { address: d.address?.slice(0, 200), place: { id: d.id, lat: d.lat, lng: d.lng } });
      else await add(s.main);
    } catch { setBusy(false); setError("장소를 불러오지 못했어요. 다시 눌러 주세요"); }
  }


  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-scrim sm:items-center sm:p-6" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="qa-title" onClick={(e) => e.stopPropagation()}
        className="flex max-h-[88dvh] w-full max-w-[560px] flex-col rounded-t-[28px] bg-bg shadow-float sm:max-w-[480px] sm:rounded-[28px]">
        <div className="mx-auto mt-2.5 h-1 w-10 flex-none rounded-full bg-line-strong sm:hidden" aria-hidden />

        <div className="flex flex-none items-center gap-2 px-5 pt-3 sm:pt-5">
          <h2 id="qa-title" className="sr-only">일정에 넣기</h2>
          <div role="tablist" aria-label="넣을 것" className="flex flex-1 gap-1 rounded-[16px] bg-surface-soft p-1">
            {(["place", "memo"] as const).map((k) => (
              <button key={k} type="button" role="tab" aria-selected={kind === k} onClick={() => { setKind(k); setError(""); }}
                className={"press flex h-9 flex-1 items-center justify-center rounded-[12px] text-body " + (kind === k ? "bg-surface font-bold text-ink shadow-[0_1px_2px_rgb(0_0_0/0.06)]" : "font-medium text-ink-sub")}>
                {k === "place" ? "장소" : "메모"}
              </button>
            ))}
          </div>
          <button type="button" onClick={onClose} aria-label="닫기" className="press flex size-11 flex-none items-center justify-center rounded-full bg-surface text-ink">
            <Icon name="x" size={20} />
          </button>
        </div>

        <div ref={dayRow} className="flex flex-none gap-1.5 overflow-x-auto px-5 pb-1 pt-3" aria-label="날짜">
          {Array.from({ length: days }, (_, i) => (
            <button key={i} type="button" aria-pressed={day === i} onClick={() => setDay(i)} className={chip(day === i)}>
              {i + 1}일차<span className={"ml-1 font-medium " + (day === i ? "opacity-70" : "text-ink-sub")}>{md(addDays(start, i))} {weekday(addDays(start, i))}</span>
            </button>
          ))}
          <button type="button" aria-pressed={day == null} onClick={() => setDay(null)} className={chip(day == null)}>날짜 미정</button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 pb-2 pt-2">
          {kind === "place" && (
            <div className="flex gap-1.5 overflow-x-auto" aria-label="분류">
              {CATS.map((c) => <button key={c.code} type="button" aria-pressed={category === c.code} onClick={() => setCategory(c.code)} className={chip(category === c.code) + " h-8 px-3 text-tiny"}>{c.label}</button>)}
            </div>
          )}

          <form onSubmit={(e) => {
            e.preventDefault();
            if (busy) return;
            if (kind === "place" && list.length) void pick(list[0]);
            else void add(q, { memo: body });
          }} className="flex flex-col gap-2">
            <label className="relative block">
              <span className="sr-only">{kind === "place" ? "장소 이름" : "메모 제목"}</span>
              {kind === "place" && <Icon name="search" size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-sub" />}
              <input ref={field} value={q} onChange={(e) => { setQ(e.target.value); setError(""); }} maxLength={MAX_PLACE_TITLE + 10} disabled={busy}
                enterKeyHint={kind === "place" && list.length ? "search" : "done"} autoComplete="off"
                placeholder={kind === "place" ? (searchable ? "장소 이름으로 찾기" : "장소 이름") : "메모 제목 (예 : 체크아웃 전에 짐 맡기기)"}
                className={input + (kind === "place" ? " pl-10" : "")} />
            </label>
            {kind === "memo" && (
              <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={MAX_PLACE_MEMO} rows={3} disabled={busy}
                placeholder="내용 (선택)" className="rounded-field border border-line-strong bg-surface px-4 py-3 text-body text-ink outline-none placeholder:text-ink-sub focus:border-ink focus:ring-2 focus:ring-ink/15" />
            )}
          </form>

          {kind === "place" && text && (
            <ul aria-label="장소 검색 결과" className="flex flex-col overflow-hidden rounded-field border border-line bg-surface">
              {list.map((s) => (
                <li key={s.id}>
                  <button type="button" disabled={busy} onClick={() => pick(s)} className="press flex min-h-13 w-full items-center gap-3 px-3 py-2 text-left">
                    <Icon name="map" size={18} className="flex-none text-ink-sub" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body font-semibold text-ink">{s.main}</span>
                      {s.sub && <span className="block truncate text-tiny text-ink-sub">{s.sub}</span>}
                    </span>
                    <Icon name="plus" size={18} className="flex-none text-ink-sub" />
                  </button>
                </li>
              ))}
              {searching && !list.length && <li className="px-3 py-3 text-tiny text-ink-sub">찾는 중…</li>}
              {limited && <li className="px-3 py-3 text-tiny text-ink-sub">오늘 장소 검색 횟수를 다 썼어요. 이름 그대로 넣을 수 있어요</li>}
              <li className={list.length || searching || limited ? "border-t border-line" : ""}>
                <button type="button" disabled={busy} onClick={() => add(q)} className="press flex min-h-12 w-full items-center gap-3 px-3 py-2 text-left">
                  <Icon name="pencil" size={18} className="flex-none text-ink-sub" />
                  <span className="min-w-0 flex-1 truncate text-body text-ink"><b className="font-semibold">&lsquo;{text}&rsquo;</b> 이름 그대로 넣기</span>
                </button>
              </li>
            </ul>
          )}

          <div>
            <button type="button" onClick={() => setMore((m) => !m)} aria-expanded={more} className="press inline-flex h-9 items-center gap-1 text-sub font-semibold text-ink-sub">
              {kind === "place" ? "시간 · 예약 필요" : "시간"}{(time || reserve) && !more ? <span className="text-ink"> · {[time, reserve && kind === "place" ? "예약 필요" : ""].filter(Boolean).join(", ")}</span> : null}
              <Icon name="down" size={16} className={more ? "rotate-180" : ""} />
            </button>
            {more && (
              <div className="mt-1 flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sub font-semibold text-ink">
                  시간
                  <input type="time" value={time} onChange={(e) => setTime(e.target.value)} disabled={busy}
                    className="h-11 rounded-field border border-line-strong bg-surface px-3 text-body text-ink outline-none focus:border-ink" />
                </label>
                {kind === "place" && (
                  <label className="flex h-11 cursor-pointer items-center gap-2 rounded-field bg-surface px-3 text-sub font-semibold text-ink">
                    <input type="checkbox" checked={reserve} onChange={(e) => setReserve(e.target.checked)} disabled={busy} className="size-5 accent-[var(--btn)]" />
                    예약 필요
                  </label>
                )}
              </div>
            )}
          </div>

          {error && <p role="alert" className="text-sub font-semibold text-point-text">{error}</p>}
          {added.length > 0 && (
            <div role="status" className="rounded-field bg-surface-soft px-3 py-2.5 text-tiny text-ink-sub">
              <span className="font-bold text-ink">방금 {added.length}개 넣었어요</span>
              <span className="mt-0.5 block truncate">{added.join(", ")}</span>
            </div>
          )}
          <p className="text-tiny text-ink-sub">편명, 예약번호, 사진, 비용은 일정에서 그 장소를 눌러 적을 수 있어요</p>
        </div>

        <div className="flex flex-none gap-2 px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-2">
          {kind === "memo" ? (
            <>
              <button type="button" disabled={busy || !text} onClick={() => add(q, { memo: body })}
                className="press h-12 flex-1 rounded-btn border border-line-strong bg-surface text-body font-bold text-ink disabled:opacity-50">추가하고 계속</button>
              <button type="button" disabled={busy || !text} onClick={() => add(q, { memo: body, keepOpen: false })}
                className="press h-12 flex-1 rounded-btn bg-btn text-body font-bold text-on-btn disabled:opacity-50">{busy ? "넣는 중" : "추가"}</button>
            </>
          ) : (
            <button type="button" onClick={onClose} disabled={busy}
              className={"press h-12 flex-1 rounded-btn text-body font-bold " + (added.length ? "bg-btn text-on-btn" : "border border-line-strong bg-surface text-ink")}>
              {busy ? "넣는 중" : added.length ? "다 넣었어요" : "닫기"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
