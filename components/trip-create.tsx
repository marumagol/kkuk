"use client";
/*
  S06 여행 만들기 : 1/3 도시(여러 개) → 2/3 기간(달력) → 3/3 이름
  넘기는 동안 입력한 값은 화면에 남아 있고, 마지막에 한 번만 저장한다 (app/actions.ts createTrip)
*/
import { LeaveGuard } from "@/components/leave-guard";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Icon } from "@/components/kit";
import { RangeCalendar } from "@/components/range-calendar";
import { CityEditor, useCityDraft, type City } from "@/components/city-editor";
import { MAX_TRIP_DAYS, MAX_TRIP_TITLE } from "@/lib/rules";
import { createTrip } from "@/app/actions";
import { safeCall } from "@/lib/safe-call";
import { daysBetween, md, weekday } from "@/lib/mock";

const STEPS = ["어디로 가요?", "언제 가요?", "여행 이름을 정해요"];

export function TripCreate({ today, searchable }: { today: string; searchable?: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [cities, setCities] = useState<City[]>([]);
  const draft = useCityDraft();
  const [start, setStart] = useState<string>();
  const [end, setEnd] = useState<string>();
  const [title, setTitle] = useState("");
  const [titleTouched, setTitleTouched] = useState(false);
  const [error, setError] = useState("");
  const [saving, startSaving] = useTransition();

  const nights = start && end ? daysBetween(start, end) : 0;
  const titleLen = [...title.trim()].length;

  const goNext = () => {
    setError("");
    if (step === 0) {
      const { cities: allCities, error: e } = draft.withPending(cities);
      if (e) return setError(e);
      if (!allCities.length) return setError("도시를 하나 이상 넣어 주세요");
      setCities(allCities); draft.clear();
      if (!titleTouched) setTitle(`${allCities[0].name} 여행`);
      return setStep(1);
    }
    if (step === 1) {
      if (!start || !end) return setError(start ? "끝 날짜를 골라 주세요" : "시작 날짜를 골라 주세요");
      return setStep(2);
    }
    if (!titleLen) return setError("여행 이름을 적어 주세요");
    if (titleLen > MAX_TRIP_TITLE) return setError(`여행 이름은 ${MAX_TRIP_TITLE}자까지 쓸 수 있어요`);
    startSaving(async () => {
      const r = await safeCall(() => createTrip({ title: title.trim(), start: start!, end: end!, cities }));
      if (r?.error) setError(r.error);
    });
  };
  const goBack = () => { setError(""); if (step === 0) router.push("/trips"); else setStep(step - 1); };

  return (
    <LeaveGuard>
      <div className="flex items-center justify-between px-5 pt-4">
        <button type="button" onClick={goBack} aria-label={step === 0 ? "여행 목록으로" : "이전 단계로"}
          className="press flex size-11 items-center justify-center rounded-full bg-surface text-ink">
          <Icon name="back" size={20} />
        </button>
        <span className="text-sub font-bold text-ink-sub" aria-label={`3단계 중 ${step + 1}단계`}>{step + 1} / 3</span>
      </div>
      <div className="mx-5 mt-3 flex gap-1.5" aria-hidden="true">
        {STEPS.map((_, i) => <span key={i} className={"h-1 flex-1 rounded-full " + (i <= step ? "bg-point" : "bg-line")} />)}
      </div>

      <div className="flex flex-1 flex-col px-5 pt-6">
        <h1 className="text-title-xl font-extrabold text-ink">{STEPS[step]}</h1>

        {step === 0 && (
          <div className="mt-6"><CityEditor cities={cities} onChange={setCities} draft={draft} onError={setError} searchable={searchable} /></div>
        )}

        {step === 1 && (
          <div className="mt-6 flex flex-col gap-3">
            <p className="text-body font-semibold text-ink" aria-live="polite">
              {start && end ? `${md(start)} (${weekday(start)}) ~ ${md(end)} (${weekday(end)}), ${nights}박 ${nights + 1}일`
                : start ? `${md(start)} (${weekday(start)}) 부터, 끝 날짜를 골라 주세요` : "시작 날짜를 골라 주세요"}
            </p>
            <RangeCalendar start={start} end={end} today={today} maxDays={MAX_TRIP_DAYS}
              onChange={(s, e, err) => { setStart(s); setEnd(e); setError(err ?? ""); }} />
            <p className="text-tiny text-ink-sub">당일치기는 같은 날을 두 번 눌러요. 다녀온 여행도 만들 수 있어요</p>
          </div>
        )}

        {step === 2 && (
          <div className="mt-6 flex flex-col gap-4">
            <Field label="여행 이름" name="title" value={title} maxLength={40} autoFocus
              onChange={(e) => { setTitle(e.target.value); setTitleTouched(true); setError(""); }}
              hint={`${titleLen}/${MAX_TRIP_TITLE}자`} disabled={saving} />
            <dl className="flex flex-col gap-2 rounded-card bg-surface p-4 text-sub">
              <div className="flex gap-3"><dt className="w-10 flex-none text-ink-sub">도시</dt><dd className="min-w-0 text-ink">{cities.map((c) => c.name).join(" → ")}</dd></div>
              <div className="flex gap-3"><dt className="w-10 flex-none text-ink-sub">기간</dt><dd className="text-ink">{start && end && `${md(start)} ~ ${md(end)}, ${nights}박 ${nights + 1}일`}</dd></div>
            </dl>
          </div>
        )}

        {error && <p role="alert" className="mt-4 text-sub font-semibold text-point-text">{error}</p>}
      </div>

      <div className="sticky bottom-0 bg-bg px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-3">
        <Button full onClick={goNext} disabled={saving}>{step < 2 ? "다음" : saving ? "만드는 중" : "여행 만들기"}</Button>
      </div>
    </LeaveGuard>
  );
}
