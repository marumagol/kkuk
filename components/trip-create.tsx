"use client";
/*
  S06 여행 만들기 : 1/3 도시(여러 개) → 2/3 기간(달력) → 3/3 이름
  넘기는 동안 입력한 값은 화면에 남아 있고, 마지막에 한 번만 저장한다 (app/actions.ts createTrip)
*/
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Icon } from "@/components/kit";
import { RangeCalendar } from "@/components/range-calendar";
import { COUNTRIES, countryOf } from "@/lib/countries";
import { MAX_CITIES, MAX_TRIP_DAYS, MAX_TRIP_TITLE } from "@/lib/rules";
import { createTrip } from "@/app/actions";
import { daysBetween, md, weekday } from "@/lib/mock";

type City = { name: string; country: string };
const STEPS = ["어디로 가요?", "언제 가요?", "여행 이름을 정해요"];

export function TripCreate({ today }: { today: string }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [cities, setCities] = useState<City[]>([]);
  const [cityName, setCityName] = useState("");
  const [country, setCountry] = useState("");
  const [start, setStart] = useState<string>();
  const [end, setEnd] = useState<string>();
  const [title, setTitle] = useState("");
  const [titleTouched, setTitleTouched] = useState(false);
  const [error, setError] = useState("");
  const [saving, startSaving] = useTransition();

  const pendingName = cityName.trim();
  const addCity = () => {
    if (!pendingName) return setError("도시 이름을 적어 주세요");
    if (!country) return setError("나라를 골라 주세요");
    if ([...pendingName].length > 40) return setError("도시 이름은 40자까지 쓸 수 있어요");
    if (cities.length >= MAX_CITIES) return setError(`도시는 ${MAX_CITIES}개까지 넣을 수 있어요`);
    if (cities.some((c) => c.name === pendingName)) return setError("이미 넣은 도시예요");
    setCities([...cities, { name: pendingName, country }]);
    setCityName(""); setError("");
  };
  // 입력칸에 적어 두고 "다음"을 눌러도 도시로 넣어 준다 (빠뜨림 방지)
  const allCities = pendingName && country && !cities.some((c) => c.name === pendingName) ? [...cities, { name: pendingName, country }] : cities;
  const nights = start && end ? daysBetween(start, end) : 0;
  const titleLen = [...title.trim()].length;

  const goNext = () => {
    setError("");
    if (step === 0) {
      if (pendingName && !country) return setError("나라를 골라 주세요");
      if (!allCities.length) return setError("도시를 하나 이상 넣어 주세요");
      setCities(allCities); setCityName("");
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
      const r = await createTrip({ title: title.trim(), start: start!, end: end!, cities });
      if (r?.error) setError(r.error);
    });
  };
  const goBack = () => { setError(""); if (step === 0) router.push("/trips"); else setStep(step - 1); };

  return (
    <>
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
          <div className="mt-6 flex flex-col gap-4">
            {cities.length > 0 && (
              <ol className="flex flex-wrap gap-2" aria-label="넣은 도시">
                {cities.map((c, i) => (
                  <li key={c.name} className="flex h-11 items-center gap-1 rounded-full bg-surface pl-4 pr-1 text-sub font-semibold text-ink">
                    <span className="text-ink-sub">{i + 1}</span> {c.name}
                    <span className="text-tiny text-ink-sub">{countryOf(c.country)?.name.replace(/ \(.*\)/, "")}</span>
                    <button type="button" onClick={() => setCities(cities.filter((x) => x !== c))} aria-label={`${c.name} 빼기`}
                      className="press flex size-9 items-center justify-center rounded-full text-ink-sub">
                      <Icon name="x" size={16} />
                    </button>
                  </li>
                ))}
              </ol>
            )}
            <label className="flex flex-col gap-2">
              <span className="text-sub font-bold text-ink-sub">나라</span>
              <select value={country} onChange={(e) => { setCountry(e.target.value); setError(""); }}
                className="h-14 rounded-field border border-line-strong bg-surface px-4 text-body text-ink outline-none focus:border-ink focus:ring-2 focus:ring-ink/15">
                <option value="" disabled>나라를 골라 주세요</option>
                {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
              </select>
            </label>
            <form onSubmit={(e) => { e.preventDefault(); addCity(); }} className="flex items-end gap-2">
              <div className="min-w-0 flex-1">
                <Field label="도시" name="city" placeholder="예 : 삿포로" value={cityName} maxLength={40} enterKeyHint="done"
                  onChange={(e) => { setCityName(e.target.value); setError(""); }} autoFocus />
              </div>
              <Button type="submit" variant="secondary" size="lg" disabled={!pendingName}>추가</Button>
            </form>
            <p className="text-tiny text-ink-sub">도시를 여러 개 넣을 수 있어요. 넣은 순서대로 여행 경로가 돼요. 여행 시간은 첫 도시의 나라에 맞춰요</p>
          </div>
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
    </>
  );
}
