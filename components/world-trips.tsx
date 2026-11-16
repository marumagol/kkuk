"use client";
/*
  여행 지도 (2026-11-15 여행 메뉴 개편, 참고 이미지 "내 핀 지도")
  - 세계 지도(바다 + 땅) 위에 여행 도시 핀. 다녀온 여행은 주황, 다가오는 여행은 짙은 회색. 핀은 나라 단위 (같은 나라 여행은 한 핀에 숫자로)
  - 핀(또는 이름표)을 누르면 그 여행으로. 같은 도시에 여행이 여럿이면 아래에 고르는 목록
  - 위 칩 : 전체 / 해마다 / 나라별로 걸러 보기. 지도는 고른 핀이 다 보이게 저절로 맞춘다
  - 땅 모양은 Natural Earth 50m (public/geo/land-50m.json, world-atlas). 구글 지도 키 없이 그린다
*/
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { geoMercator, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { Topology } from "topojson-specification";
import type { FeatureCollection } from "geojson";
import { TripRow } from "@/components/screen";
import { Icon, Stamp } from "@/components/kit";
import { countryNameOf, COUNTRY_CENTER } from "@/lib/countries";
import type { MapTrip } from "@/lib/trips";

export type WorldTrip = MapTrip & { row: { title: string; sub: string; meta: string; badge?: string; badgeTone?: "hot" | "near" | "far"; country?: string; icon?: string } };

const W = 400, H = 320;
let landCache: Promise<FeatureCollection> | null = null;
const loadLand = () => (landCache ??= fetch("/geo/land-50m.json").then((r) => r.json()).then((t: Topology) => feature(t, t.objects.land) as unknown as FeatureCollection)
  .catch((e) => { landCache = null; throw e; }));

export function WorldTrips({ trips, stamps }: { trips: WorldTrip[]; stamps?: { earned: { name: string; country: string }[]; total: number } }) {
  const router = useRouter();
  const [land, setLand] = useState<FeatureCollection | null>(null);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState("all");
  const [picked, setPicked] = useState<string | null>(null);
  useEffect(() => { loadLand().then(setLand).catch(() => setFailed(true)); }, []);

  const years = useMemo(() => [...new Set(trips.map((t) => t.start.slice(0, 4)))].sort().reverse(), [trips]);
  const countries = useMemo(() => [...new Set(trips.flatMap((t) => t.countries))], [trips]);
  const shown = trips.filter((t) => filter === "all" || (filter.startsWith("y:") ? t.start.startsWith(filter.slice(2)) : t.countries.includes(filter.slice(2))));

  /* 핀은 나라 단위 (2026-11-15 마루님). 위치는 나라 대표 좌표, 모르면 그 나라 첫 도시 좌표 */
  const groups = useMemo(() => {
    const m = new Map<string, { key: string; name: string; lat: number; lng: number; trips: WorldTrip[]; past: boolean }>();
    for (const t of shown) for (const c of t.cities) {
      const key = c.country === "ETC" || !c.country ? `ETC:${c.countryName || c.name}` : c.country;
      const at = c.country ? COUNTRY_CENTER[c.country] : undefined;
      const g = m.get(key) ?? { key, name: countryNameOf(c.country) ?? (c.countryName || c.name), lat: at?.[0] ?? c.lat, lng: at?.[1] ?? c.lng, trips: [], past: false };
      if (!g.trips.includes(t)) g.trips.push(t);
      g.past ||= t.status === "past";
      m.set(key, g);
    }
    return [...m.values()];
  }, [shown]);

  /* 핀이 다 보이게 맞추기. 핀이 한 곳뿐이면 둘레 약 1,200km 가 보이게 */
  const projection = useMemo(() => {
    const pts = groups.map((g) => [g.lng, g.lat] as [number, number]);
    const p = geoMercator();
    if (!pts.length) return p.fitExtent([[10, 30], [W - 10, H - 30]], { type: "MultiPoint", coordinates: [[-170, -50], [170, 72]] });
    const lats = pts.map((x) => x[1]), lngs = pts.map((x) => x[0]);
    const cy = (Math.min(...lats) + Math.max(...lats)) / 2, cx = (Math.min(...lngs) + Math.max(...lngs)) / 2;
    const half = Math.max(9, (Math.max(...lats) - Math.min(...lats)) / 2, (Math.max(...lngs) - Math.min(...lngs)) / 2.6);
    const box: [number, number][] = [[cx - half * 1.3, Math.max(-80, cy - half)], [cx + half * 1.3, Math.min(80, cy + half)]];
    return p.fitExtent([[40, 84], [W - 40, H - 64]], { type: "MultiPoint", coordinates: [...pts, ...box] });
  }, [groups]);
  const path = useMemo(() => geoPath(projection), [projection]);

  /* 이름표가 겹치면 여행이 많은 도시 것만 보인다 (핀은 모두 보임) */
  const labeled = useMemo(() => {
    const placed: { x: number; y: number; w: number }[] = [];
    const ok = new Set<string>();
    for (const g of [...groups].sort((a, b) => b.trips.length - a.trips.length)) {
      const [x, y] = projection([g.lng, g.lat])!;
      const w = Math.max(48, [...g.name].length * 12 + (g.trips.length > 1 ? 34 : 22));
      if (placed.some((q) => Math.abs(q.x - x) < (q.w + w) / 2 && Math.abs(q.y - y) < 24)) continue;
      placed.push({ x, y, w }); ok.add(g.key);
    }
    return ok;
  }, [groups, projection]);

  const pickedGroup = groups.find((g) => g.key === picked);
  const tap = (g: (typeof groups)[number]) => { if (g.trips.length === 1) router.push(`/trips/${g.trips[0].id}`); else setPicked(g.key === picked ? null : g.key); };

  const cityCount = new Set(shown.flatMap((t) => t.cities.map((c) => `${c.country}:${c.name}`))).size;
  const countryCount = new Set(shown.flatMap((t) => t.countries)).size;
  const noPin = shown.filter((t) => !t.cities.length).length;
  const upcoming = shown.filter((t) => t.status !== "past").sort((a, b) => a.start.localeCompare(b.start)); // 가까운 순
  const past = shown.filter((t) => t.status === "past").sort((a, b) => b.start.localeCompare(a.start)); // 최근 순
  // 처음에는 다가오는 여행. 다가오는 여행이 없으면 다녀온 여행
  const [tabPick, setTab] = useState<"upcoming" | "past" | null>(null);
  const tab = tabPick ?? (upcoming.length || !past.length ? "upcoming" : "past");
  const list = tab === "past" ? past : upcoming;
  const nextTrip = filter === "all" ? upcoming[0] : undefined;
  const chip = (key: string, label: string) => (
    <button key={key} type="button" onClick={() => { setFilter(key); setPicked(null); }} aria-pressed={filter === key}
      className={"press inline-flex h-10 flex-none items-center rounded-full px-4 text-sub font-semibold " + (filter === key ? "bg-deep text-on-deep" : "bg-surface text-ink")}>
      {label}
    </button>
  );

  return (
    <>
      <div className="relative">
        {/* 칩은 고를 게 2개 이상일 때만 (2026-11-16 마루님, 나라 하나면 전체와 같아서 뺀다) */}
        {(years.length > 1 || countries.length > 1) && <div className="flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none]" role="group" aria-label="걸러 보기">
          {chip("all", `전체 ${trips.length}`)}
          {years.length > 1 && years.map((y) => chip(`y:${y}`, y))}
          {countries.length > 1 && countries.map((c) => chip(`c:${c}`, countryNameOf(c) ?? c))}
        </div>}
        <div className="relative -mt-2">
          <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full [mask-image:linear-gradient(to_bottom,transparent,black_72px)]" role="img" aria-label={`여행 지도, 핀 ${groups.length}곳`}>
            {land && <path d={path(land) ?? ""} className="fill-land" />}
            {groups.map((g) => {
              const [x, y] = projection([g.lng, g.lat])!;
              const big = g.trips.length > 1;
              const label = g.name + (big ? ` ${g.trips.length}` : "");
              const w = Math.max(48, [...label].length * 12 + 22);
              return (
                <g key={g.key} transform={`translate(${x},${y})`} className="cursor-pointer" role="link" tabIndex={0}
                  aria-label={big ? `${g.name}, 여행 ${g.trips.length}개` : `${g.trips[0].title}, ${g.name}`}
                  onClick={() => tap(g)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); tap(g); } }}>
                  <path d="M0 0c-7-9-12-14-12-20a12 12 0 1 1 24 0c0 6-5 11-12 20z" transform="translate(0,-2)" className={g.past ? "fill-point" : "fill-deep"} />
                  <circle cx={0} cy={-22} r={4.5} className="fill-surface" />
                  {labeled.has(g.key) && <g transform="translate(0,8)">
                    <rect x={-w / 2} y={0} width={w} height={24} rx={12} className="fill-surface" style={{ filter: "drop-shadow(0 1px 2px rgb(0 0 0 / 0.12))" }} />
                    <text x={0} y={16.5} textAnchor="middle" className="fill-ink text-[12.5px] font-bold">
                      {g.name}{big && <tspan className="fill-point-text"> {g.trips.length}</tspan>}
                    </text>
                  </g>}
                </g>
              );
            })}
          </svg>
          {!land && <p className="absolute inset-x-0 top-1/2 text-center text-sub text-ink-sub">{failed ? "지도를 불러오지 못했어요" : "지도를 불러오는 중"}</p>}
          {!groups.length && land && <p className="absolute inset-x-6 top-1/2 rounded-full bg-surface/90 px-4 py-2 text-center text-sub text-ink-sub">여행을 만들면 도시마다 핀이 꽂혀요</p>}
        </div>
        {pickedGroup && (
          <div className="absolute inset-x-5 bottom-3 z-10 rounded-card bg-surface p-2 shadow-float">
            <p className="px-2 pb-1 pt-1 text-tiny font-bold text-ink-sub">{pickedGroup.name}에 간 여행</p>
            {pickedGroup.trips.map((t) => (
              <Link key={t.id} href={`/trips/${t.id}`} className="press flex h-12 items-center gap-2 rounded-field px-2">
                <span className={"size-2.5 flex-none rounded-full " + (t.status === "past" ? "bg-point" : "bg-deep")} />
                <span className="min-w-0 flex-1 truncate text-body font-semibold text-ink">{t.title}</span>
                <span className="text-tiny text-ink-sub">{t.start.slice(2, 4)}.{Number(t.start.slice(5, 7))}</span>
                <Icon name="right" size={16} className="text-ink-sub" />
              </Link>
            ))}
          </div>
        )}
      </div>

      <section className="relative -mt-4 flex flex-col gap-5 rounded-t-[28px] bg-surface px-5 pb-8 pt-6">
        {/* 다음 여행 카드 (2026-11-16 마루님). 여행 중이면 오늘 일정으로 */}
        {nextTrip && (
          <Link href={`/trips/${nextTrip.id}`} className="press flex items-center gap-3 rounded-card bg-deep px-5 py-4 text-on-deep">
            <span className="min-w-0 flex-1">
              <span className="block text-tiny font-semibold opacity-80">{nextTrip.status === "ongoing" ? "지금 여행 중이에요" : "다음 여행"}</span>
              <span className="mt-0.5 block truncate text-title font-extrabold">{nextTrip.title}</span>
              <span className="mt-1 block text-sub font-semibold opacity-80">{nextTrip.status === "ongoing" ? "오늘 일정 보기" : nextTrip.row.sub}</span>
            </span>
            {nextTrip.status !== "ongoing" && nextTrip.row.badge && <span className="flex-none text-[28px] font-extrabold tabular-nums">{nextTrip.row.badge}</span>}
            <Icon name="right" size={18} className="flex-none opacity-80" />
          </Link>
        )}
        {/* 목록은 다가오는 여행 / 다녀온 여행 탭으로 나눠 본다 (2026-11-16 마루님). 점 색은 지도 핀 색과 같다 */}
        <div className="flex flex-col gap-3">
          <div role="tablist" aria-label="여행 나눠 보기" className="flex gap-1 rounded-btn bg-bg p-1">
            {([["upcoming", "다가오는 여행", upcoming.length, "bg-deep"], ["past", "다녀온 여행", past.length, "bg-point"]] as const).map(([k, label, n, dot]) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
                className={"press flex h-10 flex-1 items-center justify-center gap-1.5 rounded-[14px] text-sub font-bold " + (tab === k ? "bg-surface text-ink shadow-sm" : "text-ink-sub")}>
                <span className={"size-2.5 rounded-full " + dot} />{label} {n}
              </button>
            ))}
          </div>
          {noPin > 0 && <p className="text-tiny text-ink-sub">위치 모르는 여행 {noPin}개는 지도에 핀이 없어요</p>}
        </div>
        <div role="tabpanel" className="flex flex-col gap-2">
          {list.length ? list.map((t) => (
            <div key={t.id} className="[&>a]:bg-bg">
              <TripRow href={`/trips/${t.id}`} {...t.row} />
            </div>
          )) : (
            <p className="rounded-pin bg-bg px-4 py-6 text-center text-sub text-ink-sub">{tab === "past" ? "아직 다녀온 여행이 없어요" : "다가오는 여행이 없어요"}</p>
          )}
        </div>
        <dl className="grid grid-cols-3 gap-2 border-t border-line pt-5" aria-label="여행 숫자">
          {[["여행", shown.length], ["도시", cityCount], ["나라", countryCount]].map(([k, n]) => (
            <div key={String(k)} className="flex flex-col-reverse">
              <dt className="text-sub text-ink-sub">{k}</dt>
              <dd className={"text-[34px] font-extrabold leading-tight tabular-nums " + "text-ink"}>{n}</dd>
            </div>
          ))}
        </dl>
        {stamps && (
          <div className="border-t border-line pt-5">
            <Link href="/stamps" className="press flex items-center justify-between gap-2">
              <h2 className="text-body font-bold text-ink">모은 도장</h2>
              <span className="flex items-center gap-0.5 text-sub font-semibold text-ink-sub">{stamps.earned.length} / {stamps.total}<Icon name="right" size={16} /></span>
            </Link>
            {stamps.earned.length > 0 ? (
              <Link href="/stamps" aria-label="도장 모두 보기" className="-mx-5 mt-3 flex gap-1 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
                {stamps.earned.map((x) => <div key={`${x.country}:${x.name}`} className="flex-none"><Stamp name={x.name} country={x.country} tilt={([...x.name].reduce((a, c) => a + c.charCodeAt(0), 0) % 17) - 8} /></div>)}
              </Link>
            ) : <p className="mt-2 text-sub text-ink-sub">여행 중에 그 도시에 있으면 도장이 찍혀요</p>}
          </div>
        )}
      </section>
    </>
  );
}
