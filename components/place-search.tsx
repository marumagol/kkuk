"use client";
/*
  장소 검색 후보 (4단계 2~3). 이름 칸 아래에 붙는다. 두 글자부터 0.3초 쉬면 찾는다
  고르면 구글 장소의 이름, 주소, 좌표, 나라를 돌려준다. 결과가 없으면 "직접 입력" 안내, 목록 아래 [직접 입력] 으로 후보를 닫고 적은 이름 그대로 (2026-11-15)
  실패도 이유를 보여 준다 (2026-11-16 마루님 "아무 반응이 없어") : 횟수 다 씀 / 구글 문제 / 인터넷 끊김.
  후보를 눌렀는데 연결이 안 되면 고른 이름(과 주소)은 그대로 채워 주고, 위치 연결만 빠졌다고 알린다 (onFallback)
*/
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/kit";
import { findPlaces, pickPlace } from "@/app/actions";

export type Picked = { id: string; name: string; address: string; lat: number; lng: number; country: string | null; types?: string[] };
type Sug = { id: string; main: string; sub: string };
type Notice = "" | "none" | "limited" | "pick-limited" | "error" | "pick-error" | "offline" | "off";

export function PlaceSuggest({ query, kind, bias, onPick, onFallback, disabled, className = "-mt-4" }: {
  query: string; kind: "place" | "city"; bias?: { lat: number; lng: number } | null; onPick: (p: Picked) => void;
  onFallback?: (s: { name: string; sub: string }) => void; disabled?: boolean; className?: string;
}) {
  const [list, setList] = useState<Sug[]>([]);
  const [busy, setBusy] = useState<string>(""); // 연결 중인 후보 id
  const [notice, setNotice] = useState<Notice>("");
  const session = useRef<string>("");
  const skip = useRef<string>(""); // 고른 직후의 이름으로는 다시 찾지 않음

  useEffect(() => {
    const q = query.trim();
    if (disabled || [...q].length < 2 || q === skip.current) { setList([]); setNotice((n) => (n.startsWith("pick") ? n : "")); return; }
    if (!session.current) session.current = crypto.randomUUID();
    let alive = true;
    const t = setTimeout(async () => {
      try {
        const r = await findPlaces(q, session.current, kind, bias ?? null);
        if (!alive) return;
        if (Array.isArray(r)) { setList(r); setNotice(r.length ? "" : "none"); }
        else { setList([]); setNotice("limited" in r ? "limited" : r.failed === "off" ? "off" : "error"); }
      } catch { if (alive) { setList([]); setNotice(typeof navigator !== "undefined" && navigator.onLine === false ? "offline" : "error"); } }
    }, 450); // 0.91.3 : 타자 칠 때마다 묻지 않게 조금 더 기다린다 (구글 호출 줄이기)
    return () => { alive = false; clearTimeout(t); };
  }, [query, kind, bias, disabled]);

  const what = kind === "place" ? "적은 이름 그대로 저장할 수 있어요. 주소는 아래에 직접 적어 주세요" : "적은 이름 그대로 넣을 수 있어요";
  const MSG: Record<Exclude<Notice, "">, string> = {
    none: `검색 결과가 없어요. ${what}`,
    limited: `오늘 장소 검색 횟수를 다 썼어요. 내일 다시 쓸 수 있어요. ${what}`,
    "pick-limited": "오늘 장소 연결 횟수를 다 써서 지도 위치는 연결하지 못했어요. 이름과 주소는 채워 뒀으니 그대로 저장할 수 있어요. 위치는 내일 다시 연결해 주세요",
    error: `지금 장소 검색이 잠시 안 돼요. ${what}`,
    "pick-error": "지도 위치를 연결하지 못했어요. 이름과 주소는 채워 뒀으니 그대로 저장할 수 있어요. 잠시 뒤 다시 골라 보세요",
    offline: `인터넷 연결이 끊겨 검색하지 못했어요. ${what}`,
    off: `지금은 장소 검색을 쓸 수 없어요. ${what}`,
  };

  if (!list.length) return notice
    ? <p role="status" className={`${className} rounded-field bg-surface-soft px-3 py-2.5 text-tiny text-ink`}>{MSG[notice]}</p>
    : null;

  const direct = () => { skip.current = query.trim(); session.current = ""; setList([]); setNotice(""); };
  const pick = async (s: Sug) => {
    setBusy(s.id);
    const fallback = (n: Notice) => { skip.current = s.main; onFallback?.({ name: s.main, sub: s.sub }); setNotice(n); };
    try {
      const d = await pickPlace(s.id, session.current);
      if ("id" in d) { const name = d.name || s.main; skip.current = name; setNotice(""); onPick({ ...d, name }); }
      else fallback("limited" in d ? "pick-limited" : "pick-error");
    } catch {
      fallback(typeof navigator !== "undefined" && navigator.onLine === false ? "offline" : "pick-error");
    } finally { session.current = ""; setList([]); setBusy(""); }
  };
  return (
    <ul role="listbox" aria-label="장소 검색 결과" aria-busy={!!busy} className={`${className} flex flex-col overflow-hidden rounded-field border border-line bg-surface`}>
      {list.map((s) => (
        <li key={s.id}>
          <button type="button" role="option" aria-selected={busy === s.id} disabled={!!busy} onClick={() => pick(s)}
            className="press flex min-h-12 w-full items-center gap-3 px-3 py-2 text-left">
            <Icon name="map" size={18} className="flex-none text-ink-sub" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-body font-semibold text-ink">{s.main}</span>
              {s.sub && <span className="block truncate text-tiny text-ink-sub">{s.sub}</span>}
            </span>
            {busy === s.id && <span className="flex-none text-tiny font-semibold text-ink-sub">연결하는 중</span>}
          </button>
        </li>
      ))}
      <li className="flex items-center justify-between gap-2 border-t border-line px-3 py-1">
        <button type="button" onClick={direct} disabled={!!busy} className="press h-10 text-left text-sub font-semibold text-ink underline underline-offset-2">
          찾는 곳이 없어요, 직접 입력
        </button>
        <span className="text-tiny text-ink-sub">Google 검색 결과</span>
      </li>
    </ul>
  );
}
