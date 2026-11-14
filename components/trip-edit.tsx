"use client";
/*
  S09 여행 정보 수정 + S10 확인 창
  - 기간을 줄여 사라지는 날에 장소가 있으면 저장 전에 "날짜 미정으로 옮겨요" 확인
  - 시작 날짜를 옮기면 장소는 일차(1일차, 2일차)를 따라간다
  - 여행 삭제는 여행 주인만, 확인 창을 거친다
*/
import { useState, useTransition } from "react";
import { Button, Field } from "@/components/kit";
import { AlertDialog } from "@/components/gate";
import { RangeCalendar } from "@/components/range-calendar";
import { CityEditor, useCityDraft, type City } from "@/components/city-editor";
import { MAX_TRIP_DAYS, MAX_TRIP_TITLE } from "@/lib/rules";
import { updateTrip, removeTrip } from "@/app/actions";
import { daysBetween, md, weekday } from "@/lib/mock";
import type { TripForEdit } from "@/lib/trips";

type Confirm = { title: string; desc: string; label: string; run: () => void } | null;

export function TripEdit({ trip, today }: { trip: TripForEdit; today: string }) {
  const [title, setTitle] = useState(trip.title);
  const [cities, setCities] = useState<City[]>(trip.cities);
  const draft = useCityDraft(trip.cities.at(-1)?.country ?? "");
  const [start, setStart] = useState<string | undefined>(trip.start);
  const [end, setEnd] = useState<string | undefined>(trip.end);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [busy, startBusy] = useTransition();

  const titleLen = [...title.trim()].length;
  const nights = start && end ? daysBetween(start, end) : 0;
  const newLen = start && end ? nights + 1 : 0;
  const moving = trip.dayCounts.slice(newLen).reduce((a, b) => a + b, 0);
  const shifted = start && start !== trip.start;

  const save = () => {
    setError("");
    const { cities: all, error: e } = draft.withPending(cities);
    if (e) return setError(e);
    if (!all.length) return setError("도시를 하나 이상 넣어 주세요");
    if (!start || !end) return setError(start ? "끝 날짜를 골라 주세요" : "시작 날짜를 골라 주세요");
    if (!titleLen) return setError("여행 이름을 적어 주세요");
    if (titleLen > MAX_TRIP_TITLE) return setError(`여행 이름은 ${MAX_TRIP_TITLE}자까지 쓸 수 있어요`);
    setCities(all); draft.clear();
    const run = () => startBusy(async () => {
      const r = await updateTrip(trip.id, { title: title.trim(), start, end, cities: all, prevFirstCountry: trip.cities[0]?.country });
      if (r?.error) setError(r.error);
    });
    if (moving > 0) {
      return setConfirm({
        title: "여행 기간을 줄일까요?",
        desc: `${newLen + 1}일차부터 있던 장소 ${moving}개는 지워지지 않고 "날짜 미정"으로 옮겨져요`,
        label: "줄이기", run,
      });
    }
    run();
  };

  const remove = () => setConfirm({
    title: "여행을 삭제할까요?",
    desc: "일정과 장소가 모두 목록에서 사라져요. 함께하는 사람에게도 보이지 않아요",
    label: "삭제",
    run: () => startBusy(async () => { const r = await removeTrip(trip.id); if (r?.error) setError(r.error); }),
  });

  return (
    <>
      <div className="flex flex-1 flex-col gap-8 px-5 pt-6">
        <Field label="여행 이름" name="title" value={title} maxLength={40} disabled={busy}
          onChange={(e) => { setTitle(e.target.value); setError(""); }} hint={`${titleLen}/${MAX_TRIP_TITLE}자`} />

        <section className="flex flex-col gap-3" aria-labelledby="edit-cities">
          <h2 id="edit-cities" className="text-title font-bold text-ink">도시</h2>
          <CityEditor cities={cities} onChange={setCities} draft={draft} onError={setError} disabled={busy} />
        </section>

        <section className="flex flex-col gap-3" aria-labelledby="edit-dates">
          <h2 id="edit-dates" className="text-title font-bold text-ink">기간</h2>
          <p className="text-body font-semibold text-ink" aria-live="polite">
            {start && end ? `${md(start)} (${weekday(start)}) ~ ${md(end)} (${weekday(end)}), ${nights}박 ${nights + 1}일`
              : start ? `${md(start)} (${weekday(start)}) 부터, 끝 날짜를 골라 주세요` : "시작 날짜를 골라 주세요"}
          </p>
          <RangeCalendar start={start} end={end} today={today} maxDays={MAX_TRIP_DAYS}
            onChange={(s, e, err) => { setStart(s); setEnd(e); setError(err ?? ""); }} />
          {moving > 0 && <p className="rounded-field bg-warn-soft px-3 py-2 text-tiny font-semibold text-warn-text">기간이 줄어서 장소 {moving}개가 날짜 미정으로 옮겨져요</p>}
          {shifted && <p className="text-tiny text-ink-sub">시작 날짜를 옮기면 장소는 날짜가 아니라 일차를 따라가요. 1일차 장소는 새 1일차로 가요</p>}
        </section>

        {error && <p role="alert" className="text-sub font-semibold text-point-text">{error}</p>}

        {trip.role === "owner" && (
          <section className="flex flex-col gap-2 border-t border-line pt-6">
            <Button type="button" variant="secondary" full onClick={remove} disabled={busy}>여행 삭제</Button>
            <p className="text-center text-tiny text-ink-sub">여행 삭제는 여행 주인만 할 수 있어요</p>
          </section>
        )}
      </div>

      <div className="sticky bottom-0 mt-6 bg-bg px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-3">
        <Button full onClick={save} disabled={busy}>{busy ? "저장하는 중" : "저장"}</Button>
      </div>

      {confirm && <AlertDialog title={confirm.title} desc={confirm.desc} confirmLabel={confirm.label}
        confirm={confirm.run} onClose={() => setConfirm(null)} />}
    </>
  );
}
