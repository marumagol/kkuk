"use client";
/*
  도시 넣기 (여행 만들기 1/3, 여행 정보 수정). 나라를 고르고 도시 이름을 넣는다
  입력칸에 적어 두고 다음/저장을 눌러도 빠지지 않게 withPending() 으로 합쳐서 쓴다
*/
import { useState } from "react";
import { Button, Field, Icon } from "@/components/kit";
import { COUNTRIES, countryOf } from "@/lib/countries";
import { MAX_CITIES } from "@/lib/rules";

export type City = { name: string; country: string };

export function useCityDraft(initialCountry = "") {
  const [name, setName] = useState("");
  const [country, setCountry] = useState(initialCountry);
  const pending = name.trim();
  /* 적어 둔 도시까지 합친 목록. 나라를 안 골랐으면 오류 문구 */
  const withPending = (cities: City[]): { cities: City[]; error?: string } => {
    if (!pending || cities.some((c) => c.name === pending)) return { cities };
    if (!country) return { cities, error: "나라를 골라 주세요" };
    return { cities: [...cities, { name: pending, country }] };
  };
  return { name, setName, country, setCountry, pending, withPending, clear: () => setName("") };
}

export function CityEditor({ cities, onChange, draft, onError, disabled }: {
  cities: City[]; onChange: (c: City[]) => void; draft: ReturnType<typeof useCityDraft>; onError: (e: string) => void; disabled?: boolean;
}) {
  const add = () => {
    const n = draft.pending;
    if (!n) return onError("도시 이름을 적어 주세요");
    if (!draft.country) return onError("나라를 골라 주세요");
    if ([...n].length > 40) return onError("도시 이름은 40자까지 쓸 수 있어요");
    if (cities.length >= MAX_CITIES) return onError(`도시는 ${MAX_CITIES}개까지 넣을 수 있어요`);
    if (cities.some((c) => c.name === n)) return onError("이미 넣은 도시예요");
    onChange([...cities, { name: n, country: draft.country }]);
    draft.clear(); onError("");
  };
  return (
    <div className="flex flex-col gap-4">
      {cities.length > 0 && (
        <ol className="flex flex-wrap gap-2" aria-label="넣은 도시">
          {cities.map((c, i) => (
            <li key={c.name} className="flex h-11 items-center gap-1 rounded-full bg-surface pl-4 pr-1 text-sub font-semibold text-ink">
              <span className="text-ink-sub">{i + 1}</span> {c.name}
              <span className="text-tiny text-ink-sub">{countryOf(c.country)?.name.replace(/ \(.*\)/, "")}</span>
              <button type="button" disabled={disabled} onClick={() => onChange(cities.filter((x) => x !== c))} aria-label={`${c.name} 빼기`}
                className="press flex size-9 items-center justify-center rounded-full text-ink-sub">
                <Icon name="x" size={16} />
              </button>
            </li>
          ))}
        </ol>
      )}
      <label className="flex flex-col gap-2">
        <span className="text-sub font-bold text-ink-sub">나라</span>
        <select value={draft.country} disabled={disabled} onChange={(e) => { draft.setCountry(e.target.value); onError(""); }}
          className="h-14 rounded-field border border-line-strong bg-surface px-4 text-body text-ink outline-none focus:border-ink focus:ring-2 focus:ring-ink/15">
          <option value="" disabled>나라를 골라 주세요</option>
          {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
        </select>
      </label>
      {/* form 안에 form 을 못 넣어서 Enter 는 직접 받는다 */}
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <Field label="도시" name="city" placeholder="예 : 삿포로" value={draft.name} maxLength={40} enterKeyHint="done" disabled={disabled}
            onChange={(e) => { draft.setName(e.target.value); onError(""); }}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); add(); } }} />
        </div>
        <Button type="button" variant="secondary" size="lg" onClick={add} disabled={!draft.pending || disabled}>추가</Button>
      </div>
      <p className="text-tiny text-ink-sub">도시를 여러 개 넣을 수 있어요. 넣은 순서대로 여행 경로가 돼요. 여행 시간은 첫 도시의 나라에 맞춰요</p>
    </div>
  );
}
