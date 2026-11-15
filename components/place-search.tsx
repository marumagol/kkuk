"use client";
/*
  장소 검색 후보 (4단계 2~3). 이름 칸 아래에 붙는다. 두 글자부터 0.3초 쉬면 찾는다
  고르면 구글 장소의 이름, 주소, 좌표, 나라를 돌려준다. 결과가 없으면 "직접 입력" 안내, 목록 아래 [직접 입력] 으로 후보를 닫고 적은 이름 그대로 (2026-11-15)
*/
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/kit";
import { findPlaces, pickPlace } from "@/app/actions";

export type Picked = { id: string; name: string; address: string; lat: number; lng: number; country: string | null };
type Sug = { id: string; main: string; sub: string };

export function PlaceSuggest({ query, kind, bias, onPick, disabled }: {
  query: string; kind: "place" | "city"; bias?: { lat: number; lng: number } | null; onPick: (p: Picked) => void; disabled?: boolean;
}) {
  const [list, setList] = useState<Sug[]>([]);
  const [busy, setBusy] = useState(false);
  const [limited, setLimited] = useState(false);
  const [none, setNone] = useState(false); // 찾아봤는데 결과가 없음 → 직접 입력 안내
  const session = useRef<string>("");
  const skip = useRef<string>(""); // 고른 직후의 이름으로는 다시 찾지 않음

  useEffect(() => {
    const q = query.trim();
    if (disabled || [...q].length < 2 || q === skip.current) { setList([]); setNone(false); return; }
    if (!session.current) session.current = crypto.randomUUID();
    let alive = true;
    const t = setTimeout(async () => {
      try { const r = await findPlaces(q, session.current, kind, bias ?? null); if (!alive) return; if (Array.isArray(r)) { setList(r); setLimited(false); setNone(r.length === 0); } else { setList([]); setLimited(true); } } catch { if (alive) setList([]); }
    }, 300);
    return () => { alive = false; clearTimeout(t); };
  }, [query, kind, bias, disabled]);

  if (limited && !list.length) return <p role="status" className="-mt-4 text-tiny text-ink-sub">오늘 장소 검색 횟수를 다 썼어요. 이름과 주소는 직접 입력해 주세요</p>;
  if (none && !list.length) return <p role="status" className="-mt-4 rounded-field bg-surface-soft px-3 py-2.5 text-tiny text-ink">{kind === "place" ? "검색 결과가 없어요. 적은 이름 그대로 저장할 수 있어요. 주소는 아래에 직접 적어 주세요" : "검색 결과가 없어요. 적은 이름 그대로 넣을 수 있어요"}</p>;
  if (!list.length) return null;
  const direct = () => { skip.current = query.trim(); session.current = ""; setList([]); setNone(false); };
  const pick = async (s: Sug) => {
    setBusy(true);
    try {
      const d = await pickPlace(s.id, session.current);
      if (d) { skip.current = d.name || s.main; onPick(d); }
    } finally { session.current = ""; setList([]); setBusy(false); }
  };
  return (
    <ul role="listbox" aria-label="장소 검색 결과" className="-mt-4 flex flex-col overflow-hidden rounded-field border border-line bg-surface">
      {list.map((s) => (
        <li key={s.id}>
          <button type="button" role="option" aria-selected="false" disabled={busy} onClick={() => pick(s)}
            className="press flex min-h-12 w-full items-center gap-3 px-3 py-2 text-left">
            <Icon name="map" size={18} className="flex-none text-ink-sub" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-body font-semibold text-ink">{s.main}</span>
              {s.sub && <span className="block truncate text-tiny text-ink-sub">{s.sub}</span>}
            </span>
          </button>
        </li>
      ))}
      <li className="flex items-center justify-between gap-2 border-t border-line px-3 py-1">
        <button type="button" onClick={direct} disabled={busy} className="press h-10 text-left text-sub font-semibold text-ink underline underline-offset-2">
          찾는 곳이 없어요, 직접 입력
        </button>
        <span className="text-tiny text-ink-sub">Google 검색 결과</span>
      </li>
    </ul>
  );
}
