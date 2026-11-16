"use client";
/*
  일정 위 지도 (2026-11-16 마루님 "일정과 지도를 함께, 하루 단위로")
  - 고른 날의 위치 있는 장소를 번호 핀 + 점선으로 잇는다. 날을 바꾸면 지도는 그대로 두고 핀만 바꾼다 (지도 불러오기 한 번)
  - 구글 지도 키(NEXT_PUBLIC_GOOGLE_MAPS_KEY)가 없거나 못 불러오면 위치만 점으로 그린 간단한 그림으로 보인다
  - 핀을 누르면 onPick(번호) : 아래 목록에서 그 장소로 간다
*/
import { useEffect, useRef, useState } from "react";
import { loadMaps, mapEnabled } from "@/components/trip-map";

export type DayPoint = { lat: number; lng: number; n: number; title: string };
const PIN = "#FF5A36";

export function DayMap({ points, onPick, className = "" }: { points: DayPoint[]; onPick?: (n: number) => void; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const objs = useRef<{ setMap: (m: null) => void }[]>([]);
  const [state, setState] = useState<"loading" | "ok" | "fail">(mapEnabled() ? "loading" : "fail");
  const pick = useRef(onPick);
  pick.current = onPick;

  // 지도는 한 번만 만든다
  useEffect(() => {
    if (!mapEnabled()) return;
    let alive = true;
    loadMaps().then(() => {
      if (!alive || !box.current) return;
      const g = (window as any).google.maps; // eslint-disable-line @typescript-eslint/no-explicit-any
      const el = document.documentElement;
      const dark = el.dataset.theme === "dark" || (!el.dataset.theme && matchMedia("(prefers-color-scheme: dark)").matches);
      map.current = new g.Map(box.current, {
        disableDefaultUI: true, gestureHandling: "greedy", clickableIcons: false, colorScheme: dark ? "DARK" : "LIGHT",
        center: { lat: 37.5665, lng: 126.978 }, zoom: 11,
      });
      setState("ok");
    }).catch(() => alive && setState("fail"));
    return () => { alive = false; };
  }, []);

  // 날이 바뀌면 핀과 점선만 다시
  useEffect(() => {
    if (state !== "ok" || !map.current) return;
    const g = (window as any).google.maps; // eslint-disable-line @typescript-eslint/no-explicit-any
    objs.current.forEach((o) => o.setMap(null));
    objs.current = [];
    if (!points.length) return;
    const bounds = new g.LatLngBounds();
    if (points.length > 1) {
      objs.current.push(new g.Polyline({
        map: map.current, path: points.map((p) => ({ lat: p.lat, lng: p.lng })), strokeOpacity: 0,
        icons: [{ icon: { path: g.SymbolPath.CIRCLE, scale: 2.2, fillOpacity: 0.85, fillColor: "#3A3B40", strokeOpacity: 0 }, offset: "0", repeat: "11px" }],
      }));
    }
    points.forEach((p) => {
      const m = new g.Marker({
        map: map.current, position: { lat: p.lat, lng: p.lng }, title: p.title, zIndex: 100 - p.n,
        label: { text: String(p.n), color: "#FFFFFF", fontWeight: "800", fontSize: "12px" },
        icon: { path: g.SymbolPath.CIRCLE, scale: 12, fillColor: PIN, fillOpacity: 1, strokeColor: "#FFFFFF", strokeWeight: 2 },
      });
      m.addListener("click", () => pick.current?.(p.n));
      objs.current.push(m);
      bounds.extend({ lat: p.lat, lng: p.lng });
    });
    if (points.length === 1) { map.current.setCenter(points[0]); map.current.setZoom(14); }
    else map.current.fitBounds(bounds, { top: 40, bottom: 56, left: 40, right: 40 });
  }, [points, state]);

  return (
    <div className={"relative overflow-hidden bg-surface-soft " + className}>
      {state === "fail" ? <Sketch points={points} onPick={onPick} /> : <div ref={box} className="absolute inset-0" role="region" aria-label="그날 장소 지도" />}
      {state === "loading" && <p className="absolute inset-0 flex items-center justify-center text-sub text-ink-sub">지도를 불러오는 중</p>}
      {!points.length && state !== "loading" && (
        <p className="pointer-events-none absolute inset-x-0 top-1/2 mx-auto w-fit -translate-y-1/2 rounded-full bg-surface/90 px-4 py-2 text-tiny font-semibold text-ink-sub shadow-float">
          이 날은 지도에 보일 장소가 없어요
        </p>
      )}
    </div>
  );
}

/* 지도 키가 없을 때 : 위치를 비율대로 점으로 찍고 점선으로 잇는다 */
function Sketch({ points, onPick }: { points: DayPoint[]; onPick?: (n: number) => void }) {
  const W = 400, H = 240, pad = 36;
  const k = Math.cos(((points.reduce((s, p) => s + p.lat, 0) / (points.length || 1)) * Math.PI) / 180);
  const xs = points.map((p) => p.lng * k), ys = points.map((p) => -p.lat);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const s = Math.min((W - pad * 2) / (x1 - x0 || 1e-9), (H - pad * 2) / (y1 - y0 || 1e-9));
  const at = (i: number) => points.length === 1 ? [W / 2, H / 2]
    : [W / 2 + (xs[i] - (x0 + x1) / 2) * s, H / 2 + (ys[i] - (y0 + y1) / 2) * s];
  const xy = points.map((_, i) => at(i));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full" role="img" aria-label="그날 장소 위치">
      <defs>
        <pattern id="dm-dot" width="16" height="16" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" className="fill-line-strong" /></pattern>
      </defs>
      <rect width={W} height={H} fill="url(#dm-dot)" />
      {xy.length > 1 && <polyline points={xy.map((p) => p.join(",")).join(" ")} fill="none" className="stroke-ink-sub" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="0.1 8" />}
      {xy.map(([x, y], i) => (
        <g key={i} onClick={() => onPick?.(points[i].n)} className={onPick ? "cursor-pointer" : ""}>
          <circle cx={x} cy={y} r="12" fill={PIN} stroke="#fff" strokeWidth="2.5" />
          <text x={x} y={y + 4} textAnchor="middle" fontSize="12" fontWeight="800" fill="#fff">{points[i].n}</text>
        </g>
      ))}
    </svg>
  );
}
