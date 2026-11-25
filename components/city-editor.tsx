"use client";
/*
  도시 넣기 (여행 만들기 1/3, 여행 정보 수정). 나라를 고르고 도시 이름을 넣는다
  나라 : 인기 나라 국기 12개 → [더 보기] 로 전체 → [직접 입력] 은 나라 이름 + 아이콘 올리기 (2026-11-14 마루님)
  입력칸에 적어 두고 다음/저장을 눌러도 빠지지 않게 withPending() 으로 합쳐서 쓴다
*/
import { useRef, useState } from "react";
import { Button, Field, FormCard, Icon } from "@/components/kit";
import { COUNTRIES, POPULAR_CITIES, POPULAR_COUNTRIES, MAX_COUNTRY_NAME, countryOf, flagOf, iconUrl } from "@/lib/countries";
import { createClient } from "@/lib/supabase/client";
import { MAX_CITIES } from "@/lib/rules";
import { PlaceSuggest, type Picked } from "@/components/place-search";

export type City = { name: string; country: string; countryName?: string; icon?: string; placeId?: string; lat?: number; lng?: number };

export function useCityDraft(initial?: Partial<City>) {
  const [name, setName] = useState("");
  const [country, setCountry] = useState(initial?.country ?? "");
  const [countryName, setCountryName] = useState(initial?.countryName ?? "");
  const [icon, setIcon] = useState<{ path?: string; preview: string } | null>(
    initial?.icon && iconUrl(initial.icon) ? { path: initial.icon, preview: iconUrl(initial.icon)! } : null);
  const pending = name.trim();
  const custom = country === "ETC";
  /* 지금 고른 나라를 도시에 붙일 모양으로. 직접 입력인데 나라 이름이 없으면 오류 문구 */
  const pick = (): { country: string; countryName?: string; icon?: string } | string => {
    if (!country) return "나라를 골라 주세요";
    if (!custom) return { country };
    const n = countryName.trim();
    if (!n) return "나라 이름을 적어 주세요";
    return { country, countryName: n, icon: icon?.path };
  };
  /* 적어 둔 도시까지 합친 목록 */
  const withPending = (cities: City[]): { cities: City[]; error?: string } => {
    if (!pending || cities.some((c) => c.name === pending)) return { cities };
    const p = pick();
    if (typeof p === "string") return { cities, error: p };
    return { cities: [...cities, { name: pending, ...p }] };
  };
  return { name, setName, country, setCountry, countryName, setCountryName, icon, setIcon, custom, pick, pending, withPending, clear: () => setName("") };
}

/* 나라 그림 : 올린 아이콘 > 국기 > 지구 모양 글자 */
function CountryMark({ country, icon, size = 30 }: { country: string; icon?: string | null; size?: number }) {
  const src = icon || flagOf(country);
  return src
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={src} alt="" width={size} height={size} style={{ width: size, height: size }} className="flex-none rounded-full object-cover ring-1 ring-line" />
    : <span style={{ width: size, height: size }} className="flex flex-none items-center justify-center rounded-full bg-surface-soft text-ink-sub"><Icon name="pencil" size={Math.round(size * 0.45)} /></span>;
}

const ICON_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

/* 나라 고르기 : 국기 칸. 직접 입력이면 나라 이름과 아이콘 */
function CountryPicker({ draft, onError, disabled }: { draft: ReturnType<typeof useCityDraft>; onError: (e: string) => void; disabled?: boolean }) {
  const chosenHidden = !!draft.country && draft.country !== "ETC" && !POPULAR_COUNTRIES.includes(draft.country);
  const [more, setMore] = useState(chosenHidden);
  const [uploading, setUploading] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const list = more ? COUNTRIES.filter((c) => c.code !== "ETC").map((c) => c.code) : POPULAR_COUNTRIES;
  const choose = (code: string) => { draft.setCountry(code); onError(""); };

  async function upload(f: File) {
    const ext = ICON_TYPES[f.type];
    if (!ext) return onError("PNG, JPG, WEBP 그림만 올릴 수 있어요");
    if (f.size > 1024 * 1024) return onError("1MB 이하 그림만 올릴 수 있어요");
    onError("");
    const preview = URL.createObjectURL(f);
    const sb = createClient();
    // 미리보기 모드 : 화면에만 보이고 저장하지 않음
    if (!sb) return draft.setIcon({ preview });
    setUploading(true);
    try {
      const { data: auth } = await sb.auth.getUser();
      if (!auth.user) return onError("로그인이 필요해요");
      const path = `${auth.user.id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await sb.storage.from("country-icons").upload(path, f, { contentType: f.type });
      if (error) return onError("아이콘을 올리지 못했어요. 잠시 뒤 다시 시도해 주세요");
      draft.setIcon({ path, preview });
    } catch {
      onError("아이콘을 올리지 못했어요. 인터넷 연결을 확인해 주세요");
    } finally { setUploading(false); }
  }

  return (
    <div className="flex flex-col gap-1">
      <div role="radiogroup" aria-label="나라" className="grid grid-cols-4 gap-x-1.5 gap-y-2">
        {list.map((code) => {
          const c = countryOf(code)!;
          const on = draft.country === code;
          return (
            <button key={code} type="button" role="radio" aria-checked={on} disabled={disabled} onClick={() => choose(code)}
              className={"press flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-field px-1 py-2 " + (on ? "bg-bg ring-2 ring-ink" : "")}>
              <CountryMark country={code} />
              <span className={"line-clamp-2 text-center text-tiny leading-tight " + (on ? "font-bold text-ink" : "font-semibold text-ink-sub")}>{c.name.replace(/ \((.*)\)/, " $1")}</span>
            </button>
          );
        })}
        <button type="button" role="radio" aria-checked={draft.custom} disabled={disabled} onClick={() => choose("ETC")}
          className={"press flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-field px-1 py-2 " + (draft.custom ? "bg-bg ring-2 ring-ink" : "")}>
          <CountryMark country="ETC" icon={draft.icon?.preview} />
          <span className={"text-center text-tiny leading-tight " + (draft.custom ? "font-bold text-ink" : "font-semibold text-ink-sub")}>직접 입력</span>
        </button>
      </div>
      <button type="button" onClick={() => setMore(!more)} aria-expanded={more}
        className="press inline-flex h-11 items-center self-start px-1 text-sub font-semibold text-ink-sub underline underline-offset-4">
        {more ? "인기 나라만 보기" : "다른 나라 더 보기"}
      </button>

      {draft.custom && (
        <div className="flex flex-col gap-3 rounded-field bg-bg p-3.5">
          <Field label="나라 이름" name="countryName" placeholder="예 : 몰디브" value={draft.countryName} maxLength={MAX_COUNTRY_NAME} disabled={disabled}
            onChange={(e) => { draft.setCountryName(e.target.value); onError(""); }} />
          <div className="flex items-center gap-3">
            <CountryMark country="ETC" icon={draft.icon?.preview} size={36} />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-sub font-bold text-ink">아이콘 (선택)</span>
              <span className="text-tiny text-ink-sub">PNG, JPG, WEBP 파일을 1MB 이하로 올려 주세요. 동그랗게 잘려 보여요</span>
            </div>
            {draft.icon ? (
              <Button type="button" variant="secondary" size="md" disabled={disabled || uploading} onClick={() => draft.setIcon(null)}>빼기</Button>
            ) : (
              <Button type="button" variant="secondary" size="md" disabled={disabled || uploading} onClick={() => file.current?.click()}>{uploading ? "올리는 중" : "올리기"}</Button>
            )}
            <input ref={file} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void upload(f); }} />
          </div>
          <p className="text-tiny text-ink-sub">직접 입력한 나라는 여행 시간을 한국 시간으로 맞춰요</p>
        </div>
      )}
    </div>
  );
}

/* 도장을 받을 수 있는 도시인지 : 검색으로 넣어 위치가 있거나, 앱 도장 목록에 있는 도시 (claim_stamp 와 같은 기준) */
/* 받침이 있으면 "은", 없으면 "는" */
const eunNeun = (w: string) => { const c = w.charCodeAt(w.length - 1); return c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 ? "은" : "는"; };
const stampKey = (c: City) => `${c.country === "US-HI" ? "US" : c.country}|${c.name}`;
export function CityEditor({ cities, onChange, draft, onError, disabled, searchable, numbered, stampCities }: {
  cities: City[]; onChange: (c: City[]) => void; draft: ReturnType<typeof useCityDraft>; onError: (e: string) => void; disabled?: boolean; searchable?: boolean; numbered?: boolean;
  stampCities?: string[] | null;
}) {
  const stampSet = stampCities ? new Set(stampCities) : null;
  const noStamp = (c: City) => !!stampSet && c.lat == null && !stampSet.has(stampKey(c));
  const missing = cities.filter(noStamp);
  // 장소 검색으로 고른 도시 : 구글이 알려 준 나라가 목록에 있으면 그 나라, 없으면 지금 고른 나라
  const addPicked = (d: Picked) => {
    const n = (d.name || "").trim().slice(0, 40);
    if (!n) return;
    if (cities.length >= MAX_CITIES) return onError(`도시는 ${MAX_CITIES}개까지 넣을 수 있어요`);
    if (cities.some((c) => c.name === n)) return onError("이미 넣은 도시예요");
    const fromGoogle = d.country && countryOf(d.country) ? d.country : null;
    const base = fromGoogle ? { country: fromGoogle } : draft.pick();
    if (typeof base === "string") return onError(base);
    onChange([...cities, { name: n, ...base, placeId: d.id, lat: d.lat, lng: d.lng }]);
    draft.clear(); onError("");
  };
  const add = () => {
    const n = draft.pending;
    if (!n) return onError("도시 이름을 적어 주세요");
    const p = draft.pick();
    if (typeof p === "string") return onError(p);
    if ([...n].length > 40) return onError("도시 이름은 40자까지 쓸 수 있어요");
    if (cities.length >= MAX_CITIES) return onError(`도시는 ${MAX_CITIES}개까지 넣을 수 있어요`);
    if (cities.some((c) => c.name === n)) return onError("이미 넣은 도시예요");
    onChange([...cities, { name: n, ...p }]);
    draft.clear(); onError("");
  };
  return (
    <div className="flex flex-col gap-3">
      <FormCard step={numbered ? 1 : undefined} title="나라" desc="고른 나라의 인기 도시가 아래에 떠요">
        <CountryPicker draft={draft} onError={onError} disabled={disabled} />
      </FormCard>
      <FormCard step={numbered ? 2 : undefined} title="도시" desc="여러 개 넣으면 넣은 순서대로 여행 경로가 돼요"
        aside={cities.length > 0 ? <span className="flex-none text-tiny font-bold text-point-text">{cities.length}곳</span> : undefined}>
      {cities.length > 0 && (
        <ol className="flex flex-wrap gap-2 border-b border-line pb-3.5" aria-label="넣은 도시">
          {cities.map((c, i) => (
            <li key={c.name} className="flex h-11 items-center gap-1.5 rounded-full bg-bg pl-2.5 pr-1 text-sub font-semibold text-ink">
              <CountryMark country={c.country} icon={c.icon && iconUrl(c.icon)} size={24} />
              <span className="text-ink-sub">{i + 1}</span> {c.name}
              <span className="text-tiny text-ink-sub">{c.countryName ?? countryOf(c.country)?.name.replace(/ \(.*\)/, "")}</span>
              {noStamp(c) && <span className="rounded-full bg-warn-soft px-1.5 py-0.5 text-micro font-bold text-warn-text">카드 없음</span>}
              <button type="button" disabled={disabled} onClick={() => onChange(cities.filter((x) => x !== c))} aria-label={`${c.name} 빼기`}
                className="press flex size-9 items-center justify-center rounded-full text-ink-sub">
                <Icon name="x" size={16} />
              </button>
            </li>
          ))}
        </ol>
      )}
      {missing.length > 0 && (
        <p role="status" className="rounded-field bg-warn-soft px-3 py-2 text-tiny font-semibold text-warn-text">
          {missing.map((c) => c.name).join(", ")}{eunNeun(missing[missing.length - 1].name)} 카드를 받을 수 없는 도시예요.
          {searchable ? " 빼고 도시 검색에서 후보를 골라 넣으면 카드를 받을 수 있어요" : " 인기 도시에서 고르면 카드를 받을 수 있어요"}
        </p>
      )}
      {/* 고른 나라의 인기 도시 : 누르면 넣고, 다시 누르면 뺀다 */}
      {(POPULAR_CITIES[draft.country] ?? []).length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-sub font-bold text-ink-sub">인기 도시</span>
          <div className="flex flex-wrap gap-2">
            {POPULAR_CITIES[draft.country].map((name) => {
              const on = cities.some((c) => c.name === name);
              return (
                <button key={name} type="button" aria-pressed={on} disabled={disabled}
                  onClick={() => {
                    onError("");
                    if (on) return onChange(cities.filter((c) => c.name !== name));
                    if (cities.length >= MAX_CITIES) return onError(`도시는 ${MAX_CITIES}개까지 넣을 수 있어요`);
                    onChange([...cities, { name, country: draft.country }]);
                  }}
                  className={"press inline-flex h-11 items-center gap-1 rounded-full px-4 text-sub font-semibold " + (on ? "bg-btn text-on-btn" : "bg-bg text-ink")}>
                  {on ? <Icon name="x" size={14} /> : <Icon name="plus" size={14} />}{name}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {/* form 안에 form 을 못 넣어서 Enter 는 직접 받는다 */}
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <Field label={searchable ? "도시 검색" : "도시 직접 입력"} name="city" placeholder={searchable ? "도시 이름을 치면 후보가 떠요" : (POPULAR_CITIES[draft.country] ?? []).length ? "목록에 없으면 직접 입력" : "예 : 삿포로"} value={draft.name} maxLength={40} enterKeyHint="done" disabled={disabled}
            onChange={(e) => { draft.setName(e.target.value); onError(""); }}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); add(); } }} />
        </div>
        <Button type="button" variant="secondary" size="lg" onClick={add} disabled={!draft.pending || disabled}>추가</Button>
      </div>
      {searchable && <PlaceSuggest query={draft.name} kind="city" onPick={addPicked} disabled={disabled} />}
      </FormCard>
      <p className="px-1 text-tiny text-ink-sub">여행 시간은 첫 도시의 나라에 맞춰요</p>
    </div>
  );
}
