"use client";
/*
  지도 (4단계 4~5) : 구글 지도 JavaScript. 키는 NEXT_PUBLIC_GOOGLE_MAPS_KEY (우리 주소에서만 되게 제한된 키)
  - 번호 핀 + 순서 선(일정 지도), 또는 번호 없는 핀(내 장소 지도)
  - 핀을 누르면 아래에 장소 이름이 뜨고, 그 장소로 갈 수 있다
*/
import { useEffect, useRef, useState } from "react";
import Link from "next/link";

export type MapPoint = { lat: number; lng: number; title: string; href?: string; sub?: string };
const KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? "";
export const mapEnabled = () => KEY.length > 0;

type G = typeof window & { google?: any; __kkukMap?: Promise<void> }; // eslint-disable-line @typescript-eslint/no-explicit-any
export function loadMaps(): Promise<void> {
  const w = window as G;
  if (w.google?.maps?.Map) return Promise.resolve();
  if (!w.__kkukMap) {
    w.__kkukMap = new Promise((ok, fail) => {
      const s = document.createElement("script");
      s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(KEY)}&v=weekly&language=ko&region=KR`;
      s.async = true; s.onload = () => ok(); s.onerror = () => { w.__kkukMap = undefined; fail(new Error("map_load_failed")); };
      document.head.appendChild(s);
    });
  }
  return w.__kkukMap;
}

export function TripMap({ points, numbered = true, height = 360 }: { points: MapPoint[]; numbered?: boolean; height?: number }) {
  const box = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ok" | "fail">("loading");
  const [picked, setPicked] = useState<MapPoint | null>(null);

  useEffect(() => {
    if (!KEY || !points.length) return;
    let alive = true;
    const objs: { setMap: (m: null) => void }[] = [];
    loadMaps().then(() => {
      if (!alive || !box.current) return;
      const g = (window as G).google.maps;
      const dark = document.documentElement.dataset.theme === "dark" || (!document.documentElement.dataset.theme && matchMedia("(prefers-color-scheme: dark)").matches);
      const map = new g.Map(box.current, {
        disableDefaultUI: true, zoomControl: true, gestureHandling: "greedy", clickableIcons: false,
        colorScheme: dark ? "DARK" : "LIGHT",
      });
      const bounds = new g.LatLngBounds();
      points.forEach((p, i) => {
        const m = new g.Marker({
          map, position: { lat: p.lat, lng: p.lng }, title: p.title,
          label: numbered ? { text: String(i + 1), color: "#FFFFFF", fontWeight: "800", fontSize: "12px" } : undefined,
          icon: { path: g.SymbolPath.CIRCLE, scale: numbered ? 12 : 8, fillColor: "#FF5A36", fillOpacity: 1, strokeColor: "#FFFFFF", strokeWeight: 2 },
        });
        m.addListener("click", () => setPicked(p));
        objs.push(m);
        bounds.extend({ lat: p.lat, lng: p.lng });
      });
      if (numbered && points.length > 1) {
        objs.push(new g.Polyline({ map, path: points.map((p) => ({ lat: p.lat, lng: p.lng })), strokeColor: "#FF5A36", strokeOpacity: 0.8, strokeWeight: 3 }));
      }
      if (points.length === 1) { map.setCenter(points[0]); map.setZoom(15); } else map.fitBounds(bounds, 48);
      setState("ok");
    }).catch(() => alive && setState("fail"));
    return () => { alive = false; objs.forEach((o) => o.setMap(null)); };
  }, [points, numbered]);

  if (!KEY) return <p className="rounded-card bg-surface px-4 py-6 text-center text-sub text-ink-sub">지도는 곧 열려요</p>;
  return (
    <div className="flex flex-col gap-2">
      <div className="relative overflow-hidden rounded-card bg-surface" style={{ height }}>
        <div ref={box} className="absolute inset-0" role="region" aria-label="지도" />
        {state !== "ok" && (
          <p className="absolute inset-0 flex items-center justify-center text-sub text-ink-sub">
            {state === "fail" ? "지도를 불러오지 못했어요. 인터넷 연결을 확인해 주세요" : "지도를 불러오는 중"}
          </p>
        )}
      </div>
      {picked && (
        <div className="flex items-center gap-3 rounded-card bg-surface px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-body font-bold text-ink">{picked.title}</p>
            {picked.sub && <p className="truncate text-tiny text-ink-sub">{picked.sub}</p>}
          </div>
          {picked.href && <Link href={picked.href} className="press flex h-11 flex-none items-center rounded-full bg-btn px-4 text-sub font-bold text-on-btn">보기</Link>}
        </div>
      )}
    </div>
  );
}
