"use client";
/*
  S08 장소 추가 / 장소 수정
  이름을 치면 장소 검색 후보가 뜬다 (4단계, 구글). 골라도 되고 직접 입력해도 된다. 이름만 꼭 넣고 나머지는 선택
  날짜를 바꾸면 그 날 맨 뒤로 간다. 삭제는 확인 창을 거쳐 removed_at
  사진은 최대 5장 (2026-11-14). 고르는 즉시 줄여서 비공개 저장소 place-photos/<여행 id>/ 에 올리고, 저장할 때 위치 목록을 함께 저장
*/
import { LeaveGuard } from "@/components/leave-guard";
import { useRef, useState, useTransition } from "react";
import { Button, Field, FormCard, Icon } from "@/components/kit";
import { createClient } from "@/lib/supabase/client";
import { shrinkImage } from "@/lib/image";
import { AlertDialog } from "@/components/gate";
import { savePlace, removePlace } from "@/app/actions";
import { safeCall } from "@/lib/safe-call";
import { decimalsOf } from "@/lib/countries";
import { MAX_PLACE_MEMO, MAX_PLACE_TITLE, MAX_PLACE_PHOTOS } from "@/lib/rules";
import { addDays, md, weekday } from "@/lib/mock";
import type { PlaceContext } from "@/lib/trips";
import { PlaceSuggest, type Picked } from "@/components/place-search";
import { fieldsOf, guessCategory, MODES, MOVE_PLACE_KEYS, MOVE_TIME_KEYS, parsePos, posText, type Details } from "@/lib/place-fields";

const CATS = [
  { code: "sight", label: "관광" }, { code: "food", label: "식사" }, { code: "shopping", label: "쇼핑" },
  { code: "stay", label: "숙소" }, { code: "transport", label: "이동" },
]; // 메모는 components/memo-form.tsx 에서 (2026-11-16)
/* "09:30" + 분 → "10:00" (23:59 를 넘지 않게) */
const addMin = (t: string, m: number) => {
  const [h, mm] = t.split(":").map(Number);
  const v = Math.min(23 * 60 + 59, Math.max(0, h * 60 + mm + m));
  return `${String(Math.floor(v / 60)).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}`;
};
const CUR_NAME: Record<string, string> = { KRW: "원", JPY: "엔", USD: "달러", EUR: "유로", TWD: "대만 달러", CNY: "위안", THB: "바트", VND: "동", HKD: "홍콩 달러", GBP: "파운드" };

export function PlaceForm({ ctx, day, memo: startMemo = false }: { ctx: PlaceContext; day: number | null; memo?: boolean }) {
  const p = ctx.place;
  const startCur = p?.cost_currency ?? ctx.currency;
  const [title, setTitle] = useState(p?.title ?? "");
  const [category, setCategory] = useState(p?.category ?? (startMemo ? "memo" : "sight"));
  const isMemo = category === "memo";
  const [time, setTime] = useState(p?.start_time?.slice(0, 5) ?? "");
  const [timed, setTimed] = useState(!!p?.start_time || (p?.category === "transport" && !!(p.details?.depart || p.details?.arrive)));
  const [address, setAddress] = useState(p?.address ?? "");
  const [currency, setCurrency] = useState(startCur);
  const [cost, setCost] = useState(p?.estimated_cost != null ? String(p.estimated_cost / 10 ** decimalsOf(startCur)) : "");
  const [memo, setMemo] = useState(p?.memo ?? "");
  // 분류별 맞춤 칸 (편명, 예약번호 등). 분류를 바꿔도 적은 값은 남겨 두고, 저장할 때 고른 분류의 칸만 보낸다
  // 예전 이동 장소는 출발 시간 칸이 없어서 장소 시간을 출발 시간으로 연다
  const [extra, setExtra] = useState<Details>(() => {
    const d = { ...(p?.details ?? {}) };
    if (p?.category === "transport" && !d.depart && p.start_time) d.depart = p.start_time.slice(0, 5);
    return d;
  });
  const [reserve, setReserve] = useState(ctx.reserved);
  const isMove = category === "transport";
  const fields = fieldsOf(category, extra.mode).filter((f) => !(isMove && (MOVE_TIME_KEYS.includes(f.key) || MOVE_PLACE_KEYS.includes(f.key))));
  // 이동 이름 자동 : 출발지/도착지를 고르면 "인천 → 신치토세". 이름을 직접 바꾸면 더는 바꾸지 않는다
  const autoTitle = useRef<string | null>(null);
  const moveTouched = useRef(false); // 이번에 출발지/도착지 위치를 바꿨는지 (저장 때 일정 지도 위치를 맞춘다)
  const setStop = (k: "from" | "to", v: { name: string; lat?: number; lng?: number; id?: string }) => {
    moveTouched.current = true;
    const next = { ...extra, [k]: v.name, [`${k}_pos`]: v.lat != null && v.lng != null ? posText(v.lat, v.lng) : "", [`${k}_id`]: v.id ?? "" };
    setExtra(next);
    const auto = [next.from, next.to].filter(Boolean).join(" → ");
    // 이름이 비었거나, 자동 이름이거나, 출발지/도착지 이름 그대로(예 : "신치토세 공항")면 "출발 → 도착"으로 바꾼다
    const t = title.trim();
    if (!t || t === autoTitle.current || [extra.from, extra.to, v.name].some((x) => x?.trim() === t)) { autoTitle.current = auto; setTitle(auto.slice(0, MAX_PLACE_TITLE)); }
    setError("");
  };
  // 장소 검색으로 고른 구글 장소. undefined = 건드리지 않음, null = 연결 끊음
  const [linked, setLinked] = useState<{ id: string; lat: number; lng: number } | null | undefined>(undefined);
  const isLinked = linked === undefined ? !!p?.google_place_id : !!linked;
  const [dayValue, setDayValue] = useState(day == null ? "none" : String(day));
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, startBusy] = useTransition();
  const catTouched = useRef(!!p); // 분류를 직접 골랐으면 검색해도 바꾸지 않는다
  const [photos, setPhotos] = useState<{ path: string; url: string }[]>(ctx.photos ?? []);
  const [uploading, setUploading] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  async function addPhotos(files: File[]) {
    setError("");
    const room = MAX_PLACE_PHOTOS - photos.length;
    if (files.length > room) setError(`사진은 ${MAX_PLACE_PHOTOS}장까지 올릴 수 있어요`);
    // 첨부 파일 (2026-11-16 마루님) : 그림은 줄여서, PDF 는 그대로 10MB 까지
    const pick = files.slice(0, Math.max(0, room)).filter((f) => f.type.startsWith("image/") || f.type === "application/pdf");
    if (pick.length < Math.min(files.length, room)) setError("그림이나 PDF 파일만 넣을 수 있어요");
    const sb = createClient();
    if (!sb || !pick.length) return;
    setUploading((n) => n + pick.length);
    await Promise.all(pick.map(async (f) => {
      try {
        const pdf = f.type === "application/pdf";
        if (pdf && f.size > 10 * 1024 * 1024) { setError("PDF 는 10MB 까지 넣을 수 있어요"); return; }
        const blob = pdf ? f : await shrinkImage(f);
        const path = `${ctx.tripId}/${crypto.randomUUID()}.${pdf ? "pdf" : "jpg"}`;
        const { error: e } = await sb.storage.from("place-photos").upload(path, blob, { contentType: pdf ? "application/pdf" : "image/jpeg" });
        if (e) throw e;
        setPhotos((p) => (p.length < MAX_PLACE_PHOTOS ? [...p, { path, url: URL.createObjectURL(blob) }] : p));
      } catch {
        setError("파일을 올리지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요");
      } finally { setUploading((n) => n - 1); }
    }));
  }

  const currencies = [...new Set([ctx.currency, startCur, "KRW", "USD"])];
  const titleLen = [...title.trim()].length;
  const autoName = [extra.from, extra.to].map((x) => x?.trim()).filter(Boolean).join(" → ");
  const dayNum = dayValue === "none" ? null : Number(dayValue);
  // 시간 빠른 고르기 : [시간 정하기] 를 누르면 그날 가장 늦은 장소 + 1시간을 미리 채운다
  const lastTime = ctx.lastTimes[dayNum ?? ctx.days] ?? null;
  const curTime = isMove ? extra.depart ?? "" : time;
  const setCurTime = (v: string) => (isMove ? setExtra((x) => ({ ...x, depart: v })) : setTime(v));
  const startTiming = () => { setTimed(true); if (!curTime && lastTime) setCurTime(addMin(lastTime, 60)); };

  const save = (again = false) => {
    setError("");
    if (!titleLen && !(isMove && autoName)) return setError(isMemo ? "메모 제목을 적어 주세요" : "장소 이름을 적어 주세요");
    startBusy(async () => {
      // 이동은 일정 지도 위치 = 출발지(없으면 도착지)
      let place = linked;
      if (isMove) {
        const f = parsePos(extra.from_pos), t = parsePos(extra.to_pos);
        const main = f && extra.from_id ? { id: extra.from_id, ...f } : t && extra.to_id ? { id: extra.to_id, ...t } : null;
        if (main) place = main; else if (moveTouched.current) place = null;
      }
      const r = await safeCall(() => savePlace(ctx.tripId, p?.id ?? null, { title: titleLen ? title : isMove ? autoName.slice(0, MAX_PLACE_TITLE) : title, address, category, time: isMemo || !timed ? "" : isMove ? extra.depart ?? "" : time, cost, currency, memo, day: dayNum, photos: isMemo ? [] : photos.map((x) => x.path), details: isMove && !timed ? { ...extra, depart: "", arrive: "" } : extra, reserve, again, ...(place !== undefined ? { place } : {}) }));
      if (r?.error) setError(r.error);
    });
  };
  const remove = () => startBusy(async () => {
    const r = await safeCall(() => removePlace(ctx.tripId, p!.id, p!.day_index));
    if (r?.error) setError(r.error);
  });

  return (
    <LeaveGuard>
      <div className="flex flex-1 flex-col gap-3 px-5 pt-5">
        {/* 날짜 : 여행 기간의 날을 칩으로 골라요 (2026-11-16 마루님). 화면 맨 위, 넘치면 다음 줄로 (가로 스크롤 없음) */}
        <FormCard title={isMemo ? "날짜" : "날짜와 시간"}>
        <fieldset className="flex min-w-0 flex-col gap-2">
          <legend className="sr-only">날짜</legend>
          <div className="flex flex-wrap gap-2">
            {[...Array.from({ length: ctx.days }, (_, i) => String(i)), "none"].map((v) => {
              const on = dayValue === v;
              const d = v === "none" ? null : addDays(ctx.start, Number(v));
              return (
                <button key={v} type="button" aria-pressed={on} disabled={busy} onClick={() => setDayValue(v)}
                  className={"press flex h-14 flex-none flex-col items-center justify-center rounded-field px-3.5 " + (on ? "bg-btn text-on-btn" : "bg-bg text-ink")}>
                  {d ? <>
                    <span className="text-sub font-bold">{Number(v) + 1}일차</span>
                    <span className={"text-tiny " + (on ? "opacity-75" : "text-ink-sub")}>{md(d)} ({weekday(d)})</span>
                  </> : <span className="text-sub font-bold">날짜 미정</span>}
                </button>
              );
            })}
          </div>
        </fieldset>
        {!isMemo && <div className="border-t border-line" />}
        {/* 시간 : 기본은 "시간 없음", [시간 정하기] 를 누르면 시간 칸이 열린다 (2026-11-16 마루님) */}
        {!isMemo && <fieldset className="flex min-w-0 flex-col gap-2">
          <legend className="mb-2 text-tiny font-bold text-ink-sub">시간</legend>
          <div className="flex flex-wrap items-center gap-2">
            {[false, true].map((on) => (
              <button key={String(on)} type="button" aria-pressed={timed === on} disabled={busy}
                onClick={() => { if (on) startTiming(); else { setTimed(false); setTime(""); } }}
                className={"press inline-flex h-11 items-center rounded-full px-4 text-sub font-semibold " + (timed === on ? "bg-btn text-on-btn" : "bg-bg text-ink")}>
                {on ? "시간 정하기" : "시간 없음"}
              </button>
            ))}
          </div>
          {/* 이동은 시간 칸 대신 출발/도착 시간. 출발 시간이 일정의 시간(정렬 기준)이 된다 */}
          {/* 다른 분류는 시간 하나. 이동 칸과 같은 모양으로 칩 아래에 (2026-11-16 마루님) */}
          {timed && !isMove && (
            <div className="-mt-0.5 grid grid-cols-2 gap-2">
              <label className="flex min-w-0 flex-col gap-1.5">
                <span className="text-tiny font-bold text-ink-sub">시간</span>
                <TimeInput value={time} onChange={setTime} disabled={busy} autoFocus={!p?.start_time} />
              </label>
            </div>
          )}
          {timed && isMove && (
            <div className="-mt-0.5 grid grid-cols-2 gap-2">
              {(["depart", "arrive"] as const).map((k) => (
                <label key={k} className="flex min-w-0 flex-col gap-1.5">
                  <span className="text-tiny font-bold text-ink-sub">{k === "depart" ? "출발 시간" : "도착 시간"}</span>
                  <TimeInput value={extra[k] ?? ""} disabled={busy} onChange={(v) => { setExtra((x) => ({ ...x, [k]: v })); setError(""); }} />
                </label>
              ))}
            </div>
          )}
          {timed && (
            <div className="-mt-0.5 flex flex-wrap gap-2" aria-label="시간 빠르게 바꾸기">
              {[-30, 30, 60].map((m) => (
                <button key={m} type="button" disabled={busy} onClick={() => setCurTime(addMin(curTime || lastTime || "09:00", m))}
                  className="press inline-flex h-9 items-center rounded-full bg-bg px-3 text-tiny font-bold text-ink">
                  {m < 0 ? "-30분" : m === 30 ? "+30분" : "+1시간"}
                </button>
              ))}
              {lastTime && <span className="self-center text-tiny text-ink-sub">이날 앞 장소 {lastTime}</span>}
            </div>
          )}
        </fieldset>}
        </FormCard>

        <FormCard title={isMemo ? "메모" : "장소"}>
        {/* 분류를 먼저 고른다. 이동이면 이름 검색 대신 출발지/도착지 검색, 이름은 자동 (2026-11-16 마루님) */}
        <fieldset className="flex min-w-0 flex-col gap-2">
          <legend className="mb-2 text-tiny font-bold text-ink-sub">분류</legend>
          <div className="flex flex-wrap gap-2">
            {CATS.map((c) => (
              <label key={c.code} className={"press inline-flex h-11 cursor-pointer items-center rounded-full px-4 text-sub font-semibold has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ink/30 " +
                (category === c.code ? "bg-btn text-on-btn" : "bg-bg text-ink")}>
                <input type="radio" name="category" value={c.code} checked={category === c.code} onChange={() => { catTouched.current = true; setCategory(c.code); if (c.code === "transport" && time && !extra.depart) setExtra((x) => ({ ...x, depart: time })); }} className="sr-only" disabled={busy} />
                {c.label}
              </label>
            ))}
          </div>
        </fieldset>

        {category === "transport" && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-tiny font-bold text-ink-sub">이동 수단 (선택)</legend>
            <div className="flex flex-wrap gap-2">
              {MODES.map((m) => (
                <button key={m.code} type="button" aria-pressed={extra.mode === m.code} disabled={busy}
                  onClick={() => setExtra((x) => ({ ...x, mode: x.mode === m.code ? "" : m.code }))}
                  className={"press inline-flex h-10 items-center rounded-full px-3.5 text-sub font-semibold " + (extra.mode === m.code ? "bg-point-soft text-point-text ring-1 ring-point" : "bg-bg text-ink")}>
                  {m.label}
                </button>
              ))}
            </div>
          </fieldset>
        )}
        {isMove && (
          <div className="flex flex-col gap-3">
            {(["from", "to"] as const).map((k) => (
              <MoveStop key={k} label={k === "from" ? (extra.mode === "flight" ? "출발 공항" : "출발지") : (extra.mode === "flight" ? "도착 공항" : "도착지")}
                placeholder={k === "from" ? "예 : 인천국제공항" : "예 : 신치토세 공항"} value={extra[k] ?? ""} linked={!!extra[`${k}_pos`]}
                searchable={ctx.searchable} bias={ctx.bias} disabled={busy} onChange={(v) => setStop(k, v)} />
            ))}
            <p className="text-tiny text-ink-sub">출발지와 도착지를 고르면 일정 이름이 &lsquo;출발 → 도착&rsquo;으로 채워지고, 지도에 두 곳이 이어져요</p>
          </div>
        )}
        <Field label={isMemo ? "메모 제목" : isMove ? "표시 이름 (선택)" : "장소 이름"} name="title" placeholder={isMemo ? "예 : 체크아웃 전에 짐 맡기기" : isMove ? autoName || "출발지와 도착지를 고르면 자동으로 채워져요" : "예 : 오타루 운하"} value={title} maxLength={MAX_PLACE_TITLE + 10} disabled={busy}
          onChange={(e) => { setTitle(e.target.value); autoTitle.current = null; setError(""); }} autoFocus={!p}
          error={titleLen > MAX_PLACE_TITLE ? `장소 이름은 ${MAX_PLACE_TITLE}자까지 쓸 수 있어요` : undefined} />
        {ctx.searchable && !isLinked && !isMemo && !isMove && (
          <PlaceSuggest query={title} kind="place" bias={ctx.bias} disabled={busy}
            onFallback={(s) => { setTitle(s.name.slice(0, MAX_PLACE_TITLE)); if (s.sub && !address.trim()) setAddress(s.sub.slice(0, 200)); }}
            onPick={(d: Picked) => {
              setTitle(d.name.slice(0, MAX_PLACE_TITLE)); if (d.address) setAddress(d.address.slice(0, 200)); setLinked({ id: d.id, lat: d.lat, lng: d.lng });
              // 구글 장소 종류로 분류(와 이동 수단)를 골라 둔다. 직접 고른 분류는 그대로
              const g = catTouched.current ? null : guessCategory(d.types);
              if (g) {
                setCategory(g.category); if (g.mode) setExtra((x) => ({ ...x, mode: x.mode || g.mode! }));
                // 공항, 역을 고르면 출발지로 넣어 둔다. 이름은 직접 고른 것으로 보고 자동으로 바꾸지 않는다
                if (g.category === "transport") { autoTitle.current = null; moveTouched.current = true; setExtra((x) => (x.from ? x : { ...x, from: d.name.slice(0, 60), from_pos: posText(d.lat, d.lng), from_id: d.id })); }
              }
            }} />
        )}
        {isLinked && !isMemo && !(isMove && (extra.from_pos || extra.to_pos)) && (
          <div className="-mt-1.5 flex items-center gap-2 text-tiny text-ink-sub">
            <Icon name="map" size={14} />지도에 위치가 연결된 장소예요
            <button type="button" onClick={() => setLinked(null)} disabled={busy} className="press ml-auto h-9 px-2 font-semibold text-ink underline underline-offset-2">연결 끊기</button>
          </div>
        )}
          {!isMemo && !isMove && <Field label="주소 (선택)" name="address" placeholder="주소나 위치 설명" value={address} maxLength={200}
            onChange={(e) => setAddress(e.target.value)} disabled={busy} />}
        </FormCard>

        {/* 예약, 비용, 주소, 메모, 사진은 늘 펼쳐 둔다 (2026-11-16 마루님 "더 적기는 별로"). 카드로 묶음 (0.57.2) */}
          {/* 맞춤 칸 + 예약 필요를 한 카드에 (예약번호 옆에 예약 체크) */}
          {!isMemo && (
            <FormCard title="예약과 비용">
                {fields.length > 0 && <div className="grid grid-cols-2 gap-3">
                {fields.map((f) => (
                  <label key={f.key} className={"flex min-w-0 flex-col gap-1.5 " + (f.half ? "" : "col-span-2")}>
                    <span className="text-tiny font-bold text-ink-sub">{f.label}</span>
                    {f.unit ? (
                      // 숫자만 적으면 단위(명)가 붙어 저장된다 (2026-11-16 마루님)
                      <span className="relative flex">
                        <input type="text" inputMode="numeric" pattern="[0-9]*" value={(extra[f.key] ?? "").replace(/\D/g, "")} placeholder={f.placeholder} maxLength={3} disabled={busy}
                          onChange={(e) => { const n = e.target.value.replace(/\D/g, "").slice(0, 3); setExtra((x) => ({ ...x, [f.key]: n ? `${Number(n)}${f.unit}` : "" })); setError(""); }}
                          className="h-12 w-full min-w-0 rounded-field border border-line-strong bg-surface pl-3 pr-9 text-body text-ink outline-none placeholder:text-ink-sub focus:border-ink focus:ring-2 focus:ring-ink/15" />
                        <span aria-hidden className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-body text-ink-sub">{f.unit}</span>
                      </span>
                    ) : (
                      <input type={f.type ?? "text"} value={extra[f.key] ?? ""} placeholder={f.placeholder} maxLength={f.max ?? 60} disabled={busy}
                        onChange={(e) => { const v = e.target.value; setExtra((x) => ({ ...x, [f.key]: v })); setError(""); }}
                        className="h-12 min-w-0 rounded-field border border-line-strong bg-surface px-3 text-body text-ink outline-none placeholder:text-ink-sub focus:border-ink focus:ring-2 focus:ring-ink/15" />
                    )}
                  </label>
                ))}
              </div>}

              <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-field bg-bg px-4 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ink/30">
                <input type="checkbox" checked={reserve} onChange={(e) => setReserve(e.target.checked)} disabled={busy} className="size-5 accent-[var(--btn)]" />
                <span className="min-w-0 flex-1">
                  <span className="block text-body font-semibold text-ink">예약 필요</span>
                  <span className="block text-tiny text-ink-sub">체크하면 준비 탭 예약 목록에 들어가요</span>
                </span>
              </label>
          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <Field label="예상 비용 (선택)" name="cost" inputMode={decimalsOf(currency) ? "decimal" : "numeric"} placeholder="0" value={cost}
                onChange={(e) => { setCost(e.target.value.replace(/[^\d.,]/g, "")); setError(""); }} disabled={busy} />
            </div>
            <label className="flex w-28 flex-none flex-col gap-2">
              <span className="sr-only">통화</span>
              <select value={currency} onChange={(e) => setCurrency(e.target.value)} disabled={busy}
                className="h-14 rounded-field border border-line-strong bg-surface px-3 text-body text-ink outline-none focus:border-ink focus:ring-2 focus:ring-ink/15">
                {currencies.map((c) => <option key={c} value={c}>{CUR_NAME[c] ?? c}</option>)}
              </select>
            </label>
          </div>
            </FormCard>
          )}


          <FormCard title={isMemo ? "내용" : "메모와 첨부 파일"} desc={isMemo ? undefined : "함께하는 사람만 볼 수 있어요"}>
          <label className="flex flex-col gap-2">
            <span className="text-tiny font-bold text-ink-sub">{isMemo ? "내용 (선택)" : "메모 (선택)"}</span>
            <textarea value={memo} onChange={(e) => setMemo(e.target.value)} maxLength={MAX_PLACE_MEMO} rows={4} disabled={busy}
              placeholder={isMemo ? "그날 기억할 것, 할 일 등" : "가는 방법, 챙길 것 등"}
              className="rounded-field border border-line-strong bg-surface px-4 py-3 text-body text-ink outline-none placeholder:text-ink-sub focus:border-ink focus:ring-2 focus:ring-ink/15" />
          </label>

          {/* 첨부 파일 : 예약 화면과 같은 모양 (2026-11-16 마루님). PDF 는 카드에 그림 없이 개수에만 */}
          {!isMemo && <section className="flex flex-col gap-2" aria-label="첨부 파일">
            <div className="flex items-end justify-between">
              <h3 className="text-tiny font-bold text-ink-sub">첨부 파일 (선택)</h3>
              <span className="text-tiny text-ink-sub">{photos.length}/{MAX_PLACE_PHOTOS}</span>
            </div>
            {photos.length > 0 && (
              <ul className="grid grid-cols-3 gap-2">
                {photos.map((ph, i) => (
                  <li key={ph.path} className="relative aspect-square overflow-hidden rounded-field bg-surface ring-1 ring-line">
                    {ph.path.endsWith(".pdf")
                      ? <a href={ph.url} target="_blank" rel="noopener noreferrer" className="flex size-full flex-col items-center justify-center gap-1 text-tiny font-bold text-ink-sub"><Icon name="book" size={22} />PDF</a>
                      // eslint-disable-next-line @next/next/no-img-element
                      : <img src={ph.url} alt={`첨부 ${i + 1}`} className="size-full object-cover" />}
                    <button type="button" aria-label={`첨부 ${i + 1} 빼기`} disabled={busy} onClick={() => setPhotos(photos.filter((x) => x !== ph))}
                      className="press absolute right-1 top-1 flex size-7 items-center justify-center rounded-full bg-black/60 text-white"><Icon name="x" size={14} /></button>
                  </li>
                ))}
              </ul>
            )}
            {photos.length < MAX_PLACE_PHOTOS && (
              <button type="button" disabled={busy || uploading > 0} onClick={() => fileRef.current?.click()}
                className="press flex min-h-14 items-center justify-center gap-1.5 rounded-card border-2 border-dashed border-line-strong text-sub font-bold text-ink-sub">
                <Icon name="plus" size={16} />{uploading ? "올리는 중" : "사진이나 PDF 넣기"}
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*,application/pdf" multiple className="hidden"
              onChange={(e) => { const fs = [...(e.target.files ?? [])]; e.target.value = ""; void addPhotos(fs); }} />
            <p className="text-tiny text-ink-sub">사진은 올릴 때 크기를 줄여요</p>
          </section>}
          </FormCard>

        {p && (
          /* 삭제는 작은 글자 버튼 (2026-11-16 마루님 "삭제 버튼 너무 커") */
          <div className="mt-3 flex justify-center">
            <button type="button" onClick={() => setConfirm(true)} disabled={busy}
              className="press inline-flex h-10 items-center gap-1 rounded-full px-3 text-sub font-semibold text-point-text"><Icon name="trash" size={16} />{isMemo ? "메모 삭제" : "장소 삭제"}</button>
          </div>
        )}
      </div>

      {/* 오류는 저장 버튼 바로 위에 (긴 화면에서도 눈에 띄게, 2026-11-16 장소 등록 점검) */}
      <div className="sticky bottom-0 mt-6 flex flex-col gap-2 bg-bg px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-3">
        {error && <p role="alert" className="text-sub font-semibold text-point-text">{error}</p>}
        <div className="flex gap-2">
        {!p && !isMemo && (
          <Button variant="secondary" onClick={() => save(true)} disabled={busy || !(titleLen || (isMove && autoName)) || uploading > 0} className="flex-none">이어서 추가</Button>
        )}
        <Button full onClick={() => save()} disabled={busy || !(titleLen || (isMove && autoName)) || uploading > 0}>{busy ? "저장하는 중" : uploading ? "사진 올리는 중" : p ? "저장" : isMemo ? "메모 추가" : "장소 추가"}</Button>
        </div>
      </div>

      {confirm && <AlertDialog title={isMemo ? "메모를 삭제할까요?" : "장소를 삭제할까요?"} desc={`"${p?.title}"이(가) 일정에서 사라져요`} confirmLabel="삭제"
        confirm={remove} onClose={() => setConfirm(false)} />}
    </LeaveGuard>
  );
}

/* 이동의 출발지/도착지 칸 : 적으면 장소 검색 후보가 뜨고, 고르면 지도 위치까지 (2026-11-16 마루님) */
function MoveStop({ label, placeholder, value, linked, searchable, bias, disabled, onChange }: {
  label: string; placeholder: string; value: string; linked: boolean; searchable: boolean; bias: { lat: number; lng: number } | null; disabled: boolean;
  onChange: (v: { name: string; lat?: number; lng?: number; id?: string }) => void;
}) {
  const [typed, setTyped] = useState(false); // 예전에 적어 둔 이름으로는 화면을 열자마자 찾지 않는다 (검색 횟수 아끼기)
  return (
    <div className="flex flex-col gap-2">
      <label className="flex min-w-0 flex-col gap-1.5">
        <span className="text-tiny font-bold text-ink-sub">{label}</span>
        <input type="text" value={value} placeholder={placeholder} maxLength={60} disabled={disabled} onChange={(e) => { setTyped(true); onChange({ name: e.target.value }); }}
          className="h-12 min-w-0 rounded-field border border-line-strong bg-surface px-3 text-body text-ink outline-none placeholder:text-ink-sub focus:border-ink focus:ring-2 focus:ring-ink/15" />
      </label>
      {linked ? (
        <div className="flex items-center gap-2 text-tiny text-ink-sub">
          <Icon name="map" size={14} />지도에 위치가 연결됐어요
          <button type="button" onClick={() => onChange({ name: value })} disabled={disabled} className="press ml-auto h-9 px-2 font-semibold text-ink underline underline-offset-2">연결 끊기</button>
        </div>
      ) : searchable && (
        <PlaceSuggest query={value} kind="place" bias={bias} disabled={disabled || !typed} className=""
          onFallback={(s) => onChange({ name: s.name.slice(0, 60) })}
          onPick={(d) => onChange({ name: d.name.slice(0, 60), lat: d.lat, lng: d.lng, id: d.id })} />
      )}
    </div>
  );
}

/*
  시간 칸 (2026-11-16 마루님 "화살표가 오른쪽으로 치우쳐"). 브라우저 기본 화살표는 여백을 무시해서 끄고,
  아래 화살표 아이콘을 칸 오른쪽 안쪽 16px 에 직접 둔다. 크롬의 시계 버튼은 투명하게 칸 전체에 깔아 어디를 눌러도 고르기가 열린다
*/
function TimeInput({ value, onChange, disabled, autoFocus }: { value: string; onChange: (v: string) => void; disabled?: boolean; autoFocus?: boolean }) {
  return (
    <span className="relative flex">
      <input type="time" value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} autoFocus={autoFocus}
        className="h-12 w-full min-w-0 appearance-none rounded-field border border-line-strong bg-surface pl-4 pr-10 text-left text-body text-ink outline-none focus:border-ink focus:ring-2 focus:ring-ink/15 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-date-and-time-value]:text-left" />
      <Icon name="chevron-down" size={16} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-ink-sub" />
    </span>
  );
}
