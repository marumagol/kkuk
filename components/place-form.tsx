"use client";
/*
  S08 장소 추가 / 장소 수정
  이름을 치면 장소 검색 후보가 뜬다 (4단계, 구글). 골라도 되고 직접 입력해도 된다. 이름만 꼭 넣고 나머지는 선택
  날짜를 바꾸면 그 날 맨 뒤로 간다. 삭제는 확인 창을 거쳐 removed_at
  사진은 최대 5장 (2026-11-14). 고르는 즉시 줄여서 비공개 저장소 place-photos/<여행 id>/ 에 올리고, 저장할 때 위치 목록을 함께 저장
*/
import { useEffect, useRef, useState, useTransition } from "react";
import { Button, Field, Icon } from "@/components/kit";
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
import { fieldsOf, MODES, type Details } from "@/lib/place-fields";

const CATS = [
  { code: "sight", label: "관광" }, { code: "food", label: "식사" }, { code: "shopping", label: "쇼핑" },
  { code: "stay", label: "숙소" }, { code: "transport", label: "이동" }, { code: "memo", label: "메모" },
];
const CUR_NAME: Record<string, string> = { KRW: "원", JPY: "엔", USD: "달러", EUR: "유로", TWD: "대만 달러", CNY: "위안", THB: "바트", VND: "동", HKD: "홍콩 달러", GBP: "파운드" };

export function PlaceForm({ ctx, day, memo: startMemo = false }: { ctx: PlaceContext; day: number | null; memo?: boolean }) {
  const p = ctx.place;
  const startCur = p?.cost_currency ?? ctx.currency;
  const [title, setTitle] = useState(p?.title ?? "");
  const [category, setCategory] = useState(p?.category ?? (startMemo ? "memo" : "sight"));
  const isMemo = category === "memo";
  const [time, setTime] = useState(p?.start_time?.slice(0, 5) ?? "");
  const [timed, setTimed] = useState(!!p?.start_time);
  const [address, setAddress] = useState(p?.address ?? "");
  const [currency, setCurrency] = useState(startCur);
  const [cost, setCost] = useState(p?.estimated_cost != null ? String(p.estimated_cost / 10 ** decimalsOf(startCur)) : "");
  const [memo, setMemo] = useState(p?.memo ?? "");
  // 분류별 맞춤 칸 (편명, 예약번호 등). 분류를 바꿔도 적은 값은 남겨 두고, 저장할 때 고른 분류의 칸만 보낸다
  const [extra, setExtra] = useState<Details>(p?.details ?? {});
  const [reserve, setReserve] = useState(ctx.reserved);
  const fields = fieldsOf(category, extra.mode);
  // 장소 검색으로 고른 구글 장소. undefined = 건드리지 않음, null = 연결 끊음
  const [linked, setLinked] = useState<{ id: string; lat: number; lng: number } | null | undefined>(undefined);
  const isLinked = linked === undefined ? !!p?.google_place_id : !!linked;
  const [dayValue, setDayValue] = useState(day == null ? "none" : String(day));
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, startBusy] = useTransition();
  const [photos, setPhotos] = useState<{ path: string; url: string }[]>(ctx.photos ?? []);
  const [uploading, setUploading] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const dayRow = useRef<HTMLDivElement>(null);
  useEffect(() => { // 고른 날 칩이 보이게 가로로만 옮긴다 (화면은 그대로)
    const row = dayRow.current, el = row?.querySelector<HTMLElement>("[aria-pressed=true]");
    if (row && el) row.scrollLeft = el.offsetLeft - (row.clientWidth - el.offsetWidth) / 2;
  }, []);

  async function addPhotos(files: File[]) {
    setError("");
    const room = MAX_PLACE_PHOTOS - photos.length;
    if (files.length > room) setError(`사진은 ${MAX_PLACE_PHOTOS}장까지 올릴 수 있어요`);
    const pick = files.slice(0, Math.max(0, room)).filter((f) => f.type.startsWith("image/"));
    const sb = createClient();
    if (!sb || !pick.length) return;
    setUploading((n) => n + pick.length);
    await Promise.all(pick.map(async (f) => {
      try {
        const blob = await shrinkImage(f);
        const path = `${ctx.tripId}/${crypto.randomUUID()}.jpg`;
        const { error: e } = await sb.storage.from("place-photos").upload(path, blob, { contentType: "image/jpeg" });
        if (e) throw e;
        setPhotos((p) => (p.length < MAX_PLACE_PHOTOS ? [...p, { path, url: URL.createObjectURL(blob) }] : p));
      } catch {
        setError("사진을 올리지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요");
      } finally { setUploading((n) => n - 1); }
    }));
  }

  const currencies = [...new Set([ctx.currency, startCur, "KRW", "USD"])];
  const titleLen = [...title.trim()].length;
  const dayNum = dayValue === "none" ? null : Number(dayValue);

  const save = () => {
    setError("");
    if (!titleLen) return setError(isMemo ? "메모 제목을 적어 주세요" : "장소 이름을 적어 주세요");
    startBusy(async () => {
      const r = await safeCall(() => savePlace(ctx.tripId, p?.id ?? null, { title, address, category, time: isMemo || !timed ? "" : time, cost, currency, memo, day: dayNum, photos: isMemo ? [] : photos.map((x) => x.path), details: extra, reserve, ...(linked !== undefined ? { place: linked } : {}) }));
      if (r?.error) setError(r.error);
    });
  };
  const remove = () => startBusy(async () => {
    const r = await safeCall(() => removePlace(ctx.tripId, p!.id, p!.day_index));
    if (r?.error) setError(r.error);
  });

  return (
    <>
      <div className="flex flex-1 flex-col gap-6 px-5 pt-6">
        <Field label={isMemo ? "메모 제목" : "장소 이름"} name="title" placeholder={isMemo ? "예 : 체크아웃 전에 짐 맡기기" : "예 : 오타루 운하"} value={title} maxLength={MAX_PLACE_TITLE + 10} disabled={busy}
          onChange={(e) => { setTitle(e.target.value); setError(""); }} autoFocus={!p}
          error={titleLen > MAX_PLACE_TITLE ? `장소 이름은 ${MAX_PLACE_TITLE}자까지 쓸 수 있어요` : undefined} />
        {ctx.searchable && !isLinked && !isMemo && (
          <PlaceSuggest query={title} kind="place" bias={ctx.bias} disabled={busy}
            onPick={(d: Picked) => { setTitle(d.name.slice(0, MAX_PLACE_TITLE)); if (d.address) setAddress(d.address.slice(0, 200)); setLinked({ id: d.id, lat: d.lat, lng: d.lng }); }} />
        )}
        {isLinked && !isMemo && (
          <div className="-mt-4 flex items-center gap-2 text-tiny text-ink-sub">
            <Icon name="map" size={14} />지도에 위치가 연결된 장소예요
            <button type="button" onClick={() => setLinked(null)} disabled={busy} className="press ml-auto h-9 px-2 font-semibold text-ink underline underline-offset-2">연결 끊기</button>
          </div>
        )}

        <fieldset className="flex min-w-0 flex-col gap-2">
          <legend className="mb-2 text-sub font-bold text-ink-sub">분류</legend>
          <div className="flex flex-wrap gap-2">
            {CATS.map((c) => (
              <label key={c.code} className={"press inline-flex h-11 cursor-pointer items-center rounded-full px-4 text-sub font-semibold has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ink/30 " +
                (category === c.code ? "bg-btn text-on-btn" : "bg-surface text-ink")}>
                <input type="radio" name="category" value={c.code} checked={category === c.code} onChange={() => setCategory(c.code)} className="sr-only" disabled={busy} />
                {c.label}
              </label>
            ))}
          </div>
        </fieldset>

        {!isMemo && (
          <label className="-mt-2 flex min-h-12 cursor-pointer items-center gap-3 rounded-field bg-surface px-4 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ink/30">
            <input type="checkbox" checked={reserve} onChange={(e) => setReserve(e.target.checked)} disabled={busy} className="size-5 accent-[var(--btn)]" />
            <span className="min-w-0 flex-1">
              <span className="block text-body font-semibold text-ink">예약 필요</span>
              <span className="block text-tiny text-ink-sub">체크하면 준비 탭 예약 목록에 들어가요</span>
            </span>
          </label>
        )}
        {category === "transport" && (
          <fieldset className="-mt-2 flex flex-col gap-2">
            <legend className="mb-2 text-sub font-bold text-ink-sub">이동 수단 (선택)</legend>
            <div className="flex flex-wrap gap-2">
              {MODES.map((m) => (
                <button key={m.code} type="button" aria-pressed={extra.mode === m.code} disabled={busy}
                  onClick={() => setExtra((x) => ({ ...x, mode: x.mode === m.code ? "" : m.code }))}
                  className={"press inline-flex h-10 items-center rounded-full px-3.5 text-sub font-semibold " + (extra.mode === m.code ? "bg-point-soft text-point-text ring-1 ring-point" : "bg-surface text-ink")}>
                  {m.label}
                </button>
              ))}
            </div>
          </fieldset>
        )}
        {fields.length > 0 && (
          <div className="-mt-2 grid grid-cols-2 gap-3 rounded-card bg-surface-soft p-4">
            {fields.map((f) => (
              <label key={f.key} className={"flex min-w-0 flex-col gap-1.5 " + (f.half ? "" : "col-span-2")}>
                <span className="text-tiny font-bold text-ink-sub">{f.label}</span>
                <input type={f.type ?? "text"} value={extra[f.key] ?? ""} placeholder={f.placeholder} maxLength={f.max ?? 60} disabled={busy}
                  onChange={(e) => { const v = e.target.value; setExtra((x) => ({ ...x, [f.key]: v })); setError(""); }}
                  className="h-12 min-w-0 rounded-field border border-line-strong bg-surface px-3 text-body text-ink outline-none placeholder:text-ink-sub focus:border-ink focus:ring-2 focus:ring-ink/15" />
              </label>
            ))}
          </div>
        )}

        {/* 날짜 : 여행 기간의 날을 칩으로 골라요 (2026-11-16 마루님). 고른 날이 보이게 가운데로 */}
        <fieldset className="flex min-w-0 flex-col gap-2">
          <legend className="mb-2 text-sub font-bold text-ink-sub">날짜</legend>
          <div ref={dayRow} className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
            {[...Array.from({ length: ctx.days }, (_, i) => String(i)), "none"].map((v) => {
              const on = dayValue === v;
              const d = v === "none" ? null : addDays(ctx.start, Number(v));
              return (
                <button key={v} type="button" aria-pressed={on} disabled={busy} onClick={() => setDayValue(v)}
                  className={"press flex h-14 flex-none flex-col items-center justify-center rounded-field px-3.5 " + (on ? "bg-btn text-on-btn" : "bg-surface text-ink")}>
                  {d ? <>
                    <span className="text-sub font-bold">{Number(v) + 1}일차</span>
                    <span className={"text-tiny " + (on ? "opacity-75" : "text-ink-sub")}>{md(d)} ({weekday(d)})</span>
                  </> : <span className="text-sub font-bold">날짜 미정</span>}
                </button>
              );
            })}
          </div>
        </fieldset>
        {/* 시간 : 기본은 "시간 없음", [시간 정하기] 를 누르면 시간 칸이 열린다 (2026-11-16 마루님) */}
        {!isMemo && <fieldset className="flex min-w-0 flex-col gap-2">
          <legend className="mb-2 text-sub font-bold text-ink-sub">시간</legend>
          <div className="flex flex-wrap items-center gap-2">
            {[false, true].map((on) => (
              <button key={String(on)} type="button" aria-pressed={timed === on} disabled={busy}
                onClick={() => { setTimed(on); if (!on) setTime(""); }}
                className={"press inline-flex h-11 items-center rounded-full px-4 text-sub font-semibold " + (timed === on ? "bg-btn text-on-btn" : "bg-surface text-ink")}>
                {on ? "시간 정하기" : "시간 없음"}
              </button>
            ))}
            {timed && <input type="time" aria-label="시간" value={time} onChange={(e) => setTime(e.target.value)} disabled={busy} autoFocus={!p?.start_time}
              className="h-11 min-w-0 rounded-field border border-line-strong bg-surface px-3 text-body text-ink outline-none focus:border-ink focus:ring-2 focus:ring-ink/15" />}
          </div>
        </fieldset>}

        {!isMemo && <div className="flex items-end gap-2">
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
        </div>}

        {!isMemo && <Field label="주소 (선택)" name="address" placeholder="주소나 위치 설명" value={address} maxLength={200}
          onChange={(e) => setAddress(e.target.value)} disabled={busy} />}

        <label className="flex flex-col gap-2">
          <span className="text-sub font-bold text-ink-sub">{isMemo ? "내용 (선택)" : "메모 (선택)"}</span>
          <textarea value={memo} onChange={(e) => setMemo(e.target.value)} maxLength={MAX_PLACE_MEMO} rows={4} disabled={busy}
            placeholder={isMemo ? "그날 기억할 것, 할 일 등" : "가는 방법, 챙길 것 등"}
            className="rounded-field border border-line-strong bg-surface px-4 py-3 text-body text-ink outline-none placeholder:text-ink-sub focus:border-ink focus:ring-2 focus:ring-ink/15" />
        </label>

        {!isMemo && <div className="flex flex-col gap-2">
          <span className="text-sub font-bold text-ink-sub">사진 (선택, {photos.length}/{MAX_PLACE_PHOTOS})</span>
          <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
            {photos.map((ph, i) => (
              <span key={ph.path} className="relative flex-none">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={ph.url} alt={`사진 ${i + 1}`} width={88} height={88} className="size-22 rounded-field object-cover" />
                <button type="button" aria-label={`사진 ${i + 1} 빼기`} disabled={busy} onClick={() => setPhotos(photos.filter((x) => x !== ph))}
                  className="press absolute -right-1.5 -top-1.5 flex size-7 items-center justify-center rounded-full bg-btn text-on-btn">
                  <Icon name="x" size={14} />
                </button>
              </span>
            ))}
            {Array.from({ length: uploading }, (_, i) => (
              <span key={`up${i}`} className="flex size-22 flex-none items-center justify-center rounded-field bg-surface text-tiny text-ink-sub">올리는 중</span>
            ))}
            {photos.length + uploading < MAX_PLACE_PHOTOS && (
              <button type="button" disabled={busy} onClick={() => fileRef.current?.click()}
                className="press flex size-22 flex-none flex-col items-center justify-center gap-1 rounded-field border border-dashed border-line-strong bg-surface text-tiny font-semibold text-ink-sub">
                <Icon name="camera" size={22} />사진 추가
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
            onChange={(e) => { const fs = [...(e.target.files ?? [])]; e.target.value = ""; void addPhotos(fs); }} />
          <p className="text-tiny text-ink-sub">함께하는 사람만 볼 수 있어요. 올릴 때 크기를 줄여요</p>
        </div>}

        {error && <p role="alert" className="text-sub font-semibold text-point-text">{error}</p>}

        {p && (
          <div className="border-t border-line pt-6">
            <Button type="button" variant="secondary" full onClick={() => setConfirm(true)} disabled={busy}>{isMemo ? "메모 삭제" : "장소 삭제"}</Button>
          </div>
        )}
      </div>

      <div className="sticky bottom-0 mt-6 bg-bg px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-3">
        <Button full onClick={save} disabled={busy || !titleLen || uploading > 0}>{busy ? "저장하는 중" : uploading ? "사진 올리는 중" : p ? "저장" : isMemo ? "메모 추가" : "장소 추가"}</Button>
      </div>

      {confirm && <AlertDialog title="장소를 삭제할까요?" desc={`"${p?.title}"이(가) 일정에서 사라져요`} confirmLabel="삭제"
        confirm={remove} onClose={() => setConfirm(false)} />}
    </>
  );
}
