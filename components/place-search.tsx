"use client";
/*
  장소 검색 후보 (4단계 2~3). 이름 칸 아래에 붙는다. 두 글자부터 0.3초 쉬면 찾는다
  고르면 구글 장소의 이름, 주소, 좌표, 나라를 돌려준다. 못 찾거나 키가 없으면 아무것도 안 보여 직접 입력 그대로
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
  const session = useRef<string>("");
  const skip = useRef<string>(""); // 고른 직후의 이름으로는 다시 찾지 않음

  useEffect(() => {
    const q = query.trim();
    if (disabled || [...q].length < 2 || q === skip.current) { setList([]); return; }
    if (!session.current) session.current = crypto.randomUUID();
    let alive = true;
    const t = setTimeout(async () => {
      try { const r = await findPlaces(q, session.current, kind, bias ?? null); if (alive) setList(r); } catch { if (alive) setList([]); }
    }, 300);
    return () => { alive = false; clearTimeout(t); };
  }, [query, kind, bias, disabled]);

  if (!list.length) return null;
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
      <li className="px-3 py-1.5 text-right text-tiny text-ink-sub">Google 검색 결과</li>
    </ul>
  );
}
