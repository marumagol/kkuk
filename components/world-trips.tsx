"use client";
/*
  여행 탭 (2026-11-17 마루님 "여행 탭 개선" 시안 반영, 피그마 핀모리 v2 > 여행 탭 개선 (11.17))
  - 발자취 지도 : 다녀온 나라는 주황으로 칠하고, 다녀온 도시는 점과 이름, 다가오는 여행은 핀과 "D-41 삿포로" 이름표
  - 지도 위 : 다녀온 나라, 도시 수와 총 박 수 요약, 연도 칩. 지도는 보이는 곳이 다 들어오게 저절로 맞춘다
  - 아래 시트 : 다가오는 여행은 할 일 허브 카드(준비율, 챙길 것, 남은 예약, 날짜 미정 장소, 칸을 누르면 준비/일정으로),
    다녀온 여행은 해마다 묶어 박 수와 장소 수
  - 나라 모양은 Natural Earth 50m (public/geo/countries-50m.json, world-atlas). 구글 지도 키 없이 그린다
*/
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { geoMercator, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { Topology } from "topojson-specification";
import type { FeatureCollection, Feature } from "geojson";
import { Icon } from "@/components/kit";
import { flagOf, COUNTRY_CENTER } from "@/lib/countries";
import { ISO_NUM } from "@/lib/iso-numeric";
import { md } from "@/lib/mock";
import type { MapTrip, TripHub } from "@/lib/trips";

export type WorldTrip = MapTrip & { title: string; sub: string; nights: number; places: number; country?: string; icon?: string; dday?: { label: string; tone: "hot" | "near" | "far" } };

const W = 400, H = 300; // 지도 높이 줄여 아래 목록이 더 올라오게 (2026-11-17 마루님)
let geoCache: Promise<FeatureCollection> | null = null;
const loadGeo = () => (geoCache ??= fetch("/geo/countries-50m.json").then((r) => r.json()).then((t: Topology) => feature(t, t.objects.countries) as unknown as FeatureCollection)
  .catch((e) => { geoCache = null; throw e; }));

export function WorldTrips({ trips, hubs }: { trips: WorldTrip[]; hubs: Record<string, TripHub> }) {
  const router = useRouter();
  const [geo, setGeo] = useState<FeatureCollection | null>(null);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState("all");
  useEffect(() => { loadGeo().then(setGeo).catch(() => setFailed(true)); }, []);

  const years = useMemo(() => [...new Set(trips.map((t) => t.start.slice(0, 4)))].sort().reverse(), [trips]);
  const shown = trips.filter((t) => filter === "all" || t.start.startsWith(filter.slice(2)));
  const gone = shown.filter((t) => t.status !== "upcoming"); // 다녀온(여행 중 포함) 여행
  const coming = shown.filter((t) => t.status !== "past");

  /* 다녀온 나라 (지도 숫자 id), 다녀온 도시 점, 다가오는 여행 핀 */
  const visited = useMemo(() => new Set(gone.flatMap((t) => t.cities.map((c) => (c.country ? ISO_NUM[c.country] : undefined)).filter(Boolean) as string[])), [gone]);
  const dots = useMemo(() => {
    const m = new Map<string, { name: string; lat: number; lng: number; trips: WorldTrip[] }>();
    for (const t of gone) for (const c of t.cities) { const k = `${c.country}:${c.name}`; const d = m.get(k) ?? { name: c.name, lat: c.lat, lng: c.lng, trips: [] }; d.trips.push(t); m.set(k, d); }
    return [...m.values()];
  }, [gone]);
  const pins = useMemo(() => coming.flatMap((t) => {
    const c = t.cities[0];
    const at = c ? [c.lat, c.lng] : t.countries[0] ? COUNTRY_CENTER[t.countries[0]] : undefined;
    return at ? [{ trip: t, name: c?.name ?? t.title, lat: at[0], lng: at[1] }] : [];
  }), [coming]);

  const summary = {
    countries: new Set(gone.flatMap((t) => t.countries)).size,
    cities: dots.length,
    nights: gone.reduce((n, t) => n + t.nights, 0),
  };

  /* 보이는 점과 핀이 다 들어오게. 하나뿐이면 둘레 약 1,200km. 위쪽 요약 카드 자리는 비워 둔다 */
  const projection = useMemo(() => {
    const pts = [...dots, ...pins].map((g) => [g.lng, g.lat] as [number, number]);
    const p = geoMercator();
    if (!pts.length) return p.fitExtent([[10, 100], [W - 10, H - 25]], { type: "MultiPoint", coordinates: [[-170, -50], [170, 72]] });
    const lats = pts.map((x) => x[1]), lngs = pts.map((x) => x[0]);
    const cy = (Math.min(...lats) + Math.max(...lats)) / 2, cx = (Math.min(...lngs) + Math.max(...lngs)) / 2;
    const half = Math.max(7, (Math.max(...lats) - Math.min(...lats)) / 2, (Math.max(...lngs) - Math.min(...lngs)) / 2.6);
    const box: [number, number][] = [[cx - half * 1.2, Math.max(-80, cy - half)], [cx + half * 1.2, Math.min(80, cy + half)]];
    return p.fitExtent([[44, 118], [W - 60, H - 40]], { type: "MultiPoint", coordinates: [...pts, ...box] });
  }, [dots, pins]);
  const path = useMemo(() => geoPath(projection), [projection]);

  /* 도시 이름은 겹치면 여행이 많은 곳 것만 */
  const named = useMemo(() => {
    const placed: { x: number; y: number; w: number }[] = pins.map((p) => { const [x, y] = projection([p.lng, p.lat])!; return { x, y: y + 16, w: 100 }; });
    const ok = new Map<string, "r" | "l">(); // 이름을 점 오른쪽(r) 또는 왼쪽(l)에
    const hit = (cx: number, y: number, w: number) => placed.some((q) => Math.abs(q.x - cx) < (q.w + w) / 2 && Math.abs(q.y - y) < 16);
    for (const d of [...dots].sort((a, b) => b.trips.length - a.trips.length)) {
      const [x, y] = projection([d.lng, d.lat])!;
      const w = [...d.name].length * 11 + 10;
      const side = !hit(x + 7 + w / 2, y, w) ? "r" : !hit(x - 7 - w / 2, y, w) ? "l" : null;
      if (!side) continue;
      placed.push({ x: side === "r" ? x + 7 + w / 2 : x - 7 - w / 2, y, w }); ok.set(d.name, side);
    }
    return ok;
  }, [dots, pins, projection]);

  const upcoming = coming.sort((a, b) => a.start.localeCompare(b.start));
  const past = shown.filter((t) => t.status === "past").sort((a, b) => b.start.localeCompare(a.start));
  const [tabPick, setTab] = useState<"upcoming" | "past" | null>(null);
  const tab = tabPick ?? (upcoming.length || !past.length ? "upcoming" : "past");
  const noPin = shown.filter((t) => !t.cities.length).length;
  const chip = (key: string, label: string) => (
    <button key={key} type="button" onClick={() => setFilter(key)} aria-pressed={filter === key}
      className={"press inline-flex h-8 flex-none items-center rounded-full px-3.5 text-tiny font-bold shadow-[0_1px_2px_rgb(0_0_0/0.08)] " + (filter === key ? "bg-deep text-on-deep" : "bg-surface text-ink")}>
      {label}
    </button>
  );

  return (
    <>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={`여행 발자취 지도, 다녀온 나라 ${summary.countries}곳, 도시 ${summary.cities}곳`}>
          {geo && geo.features.map((f: Feature, i) => {
            const on = visited.has(String(f.id));
            return <path key={String(f.id ?? i)} d={path(f) ?? ""} className={on ? "fill-point/40 stroke-point/70" : "fill-land stroke-land"} strokeWidth={on ? 0.8 : 0.4} />;
          })}
          {dots.map((d) => {
            const [x, y] = projection([d.lng, d.lat])!;
            const go = () => (d.trips.length === 1 ? router.push(`/trips/${d.trips[0].id}`) : setTab("past"));
            return (
              <g key={d.name + x} transform={`translate(${x},${y})`} className="cursor-pointer" role="link" tabIndex={0} aria-label={`${d.name}, 다녀온 여행 ${d.trips.length}개`}
                onClick={go} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } }}>
                <circle r={4.5} className="fill-point-text stroke-surface" strokeWidth={1.8} />
                {named.has(d.name) && <text x={named.get(d.name) === "l" ? -7 : 7} y={4} textAnchor={named.get(d.name) === "l" ? "end" : "start"} className="fill-point-text text-[11px] font-extrabold" style={{ paintOrder: "stroke", stroke: "var(--surface)", strokeWidth: 3 }}>{d.name}</text>}
              </g>
            );
          })}
          {pins.map(({ trip, name, lat, lng }) => {
            const [x, y] = projection([lng, lat])!;
            const dd = trip.dday?.label ?? "";
            const w = [...dd].length * 7.5 + [...name].length * 12.5 + 26;
            return (
              <g key={trip.id} transform={`translate(${x},${y})`} className="cursor-pointer" role="link" tabIndex={0} aria-label={`${trip.title}, ${dd}`}
                onClick={() => router.push(`/trips/${trip.id}`)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); router.push(`/trips/${trip.id}`); } }}>
                <path d="M0 0c-8-10-14-16-14-23a14 14 0 1 1 28 0c0 7-6 13-14 23z" className="fill-point" style={{ filter: "drop-shadow(0 2px 3px rgb(0 0 0 / 0.2))" }} />
                <circle cx={0} cy={-23} r={5} className="fill-surface" />
                <g transform={`translate(${-w / 2},6)`}>
                  <rect width={w} height={26} rx={13} className="fill-deep" />
                  <text x={11} y={17.5} className="text-[12px] font-extrabold"><tspan className="fill-point">{dd}</tspan><tspan dx={6} className="fill-on-deep">{name}</tspan></text>
                </g>
              </g>
            );
          })}
        </svg>
        {/* 지도 위 : 누적 요약과 연도 칩 */}
        <div className="pointer-events-none absolute left-5 right-5 top-0 flex flex-col items-start gap-3">
          <div className="pointer-events-auto rounded-[18px] bg-surface/95 px-3.5 py-2.5 shadow-[0_2px_8px_rgb(0_0_0/0.08)]">
            <p className="flex items-baseline gap-3 text-ink">
              {[[summary.countries, "개 나라"], [summary.cities, "개 도시"], [summary.nights, "박"]].map(([n, u], k) => (
                <span key={k} className="flex items-baseline gap-0.5"><b className={"text-title font-extrabold tabular-nums " + (k === 0 ? "text-point-text" : "")}>{k === 2 ? `총 ${n}` : n}</b><span className="text-tiny font-semibold text-ink-sub">{u}</span></span>
              ))}
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-ink-sub">
              <span className="flex items-center gap-1"><span className="size-2.5 rounded-[3px] border border-point/70 bg-point/40" />다녀온 나라</span>
              <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-point-text" />다녀온 도시</span>
              <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-point" />다가오는 여행</span>
            </p>
          </div>
          {years.length > 1 && <div className="pointer-events-auto -mx-5 flex max-w-[calc(100%+40px)] gap-1.5 overflow-x-auto px-5 pb-1 [scrollbar-width:none]" role="group" aria-label="연도로 걸러 보기">
            {chip("all", "전체")}
            {years.map((y) => chip(`y:${y}`, y))}
          </div>}
        </div>
        {!geo && <p className="absolute inset-x-0 top-2/3 text-center text-sub text-ink-sub">{failed ? "지도를 불러오지 못했어요" : "지도를 불러오는 중"}</p>}
      </div>

      <section className="relative -mt-6 flex flex-col gap-4 rounded-t-[28px] bg-surface px-5 pb-8 pt-4">
        <div className="flex flex-col gap-2">
          <div role="tablist" aria-label="여행 나눠 보기" className="flex gap-1 rounded-btn bg-bg p-1">
            {([["upcoming", "다가오는 여행", upcoming.length, "bg-point"], ["past", "다녀온 여행", past.length, "bg-deep"]] as const).map(([k, label, n, dot]) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
                className={"press flex h-11 flex-1 items-center justify-center gap-1.5 rounded-[14px] text-sub font-bold " + (tab === k ? "bg-surface text-ink shadow-sm" : "text-ink-sub")}>
                <span className={"size-2 rounded-full " + dot} />{label} {n}
              </button>
            ))}
          </div>
          {noPin > 0 && <p className="text-tiny text-ink-sub">위치 모르는 여행 {noPin}개는 지도에 표시되지 않아요</p>}
        </div>
        <div role="tabpanel" className="flex flex-col gap-3">
          {tab === "upcoming" ? (
            upcoming.length ? upcoming.map((t) => <Hub key={t.id} t={t} hub={hubs[t.id]} />)
              : <p className="rounded-pin bg-bg px-4 py-6 text-center text-sub text-ink-sub">다가오는 여행이 없어요</p>
          ) : past.length ? (
            [...new Set(past.map((t) => t.start.slice(0, 4)))].map((y) => (
              <div key={y} className="flex flex-col">
                <h3 className="pb-1 pt-2 text-tiny font-bold text-ink-sub">{y}년</h3>
                {past.filter((t) => t.start.startsWith(y)).map((t) => <PastRow key={t.id} t={t} />)}
              </div>
            ))
          ) : <p className="rounded-pin bg-bg px-4 py-6 text-center text-sub text-ink-sub">아직 다녀온 여행이 없어요</p>}
        </div>
      </section>
    </>
  );
}

function Flag({ t }: { t: WorldTrip }) {
  const f = t.icon || flagOf(t.country);
  // eslint-disable-next-line @next/next/no-img-element
  return f ? <img src={f} alt="" width={44} height={44} className="size-11 flex-none rounded-full object-cover ring-1 ring-line" />
    : <span className="flex size-11 flex-none items-center justify-center rounded-full bg-point-soft text-point-text"><Icon name="pin" size={20} /></span>;
}

/* 다녀온 여행 한 줄 : 국기, 이름, "5.2 ~ 5.4 · 2박 · 후쿠오카", 오른쪽 장소 수 */
function PastRow({ t }: { t: WorldTrip }) {
  return (
    <Link href={`/trips/${t.id}`} className="press flex min-h-[60px] items-center gap-3 rounded-field py-2">
      <Flag t={t} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-body font-bold text-ink">{t.title}</span>
        <span className="block truncate text-tiny text-ink-sub">{md(t.start)} ~ {md(t.end)} · {t.nights}박{t.cities.length || t.allCities ? ` · ${t.cities.map((c) => c.name).join(", ")}` : ""}</span>
      </span>
      <span className="flex flex-none flex-col items-end leading-tight">
        <b className="text-body font-extrabold tabular-nums text-ink">{t.places}</b>
        <span className="text-[11px] text-ink-sub">장소</span>
      </span>
    </Link>
  );
}

/* 다가오는 여행 : 할 일 허브 카드 */
function Hub({ t, hub }: { t: WorldTrip; hub?: TripHub }) {
  const tone = t.dday?.tone === "hot" ? "bg-[#C23A18] text-white" : "bg-point-soft text-point-text";
  /* 칸을 누르면 바로 그 화면으로 : 챙길 것, 예약 남음 → 준비 / 날짜 미정 → 일정 (2026-11-17 마루님) */
  const stat = (href: string, icon: "check" | "book" | "pin", label: string, value: string, warn?: boolean) => (
    <Link href={href} className="press flex flex-col gap-1 rounded-field bg-surface px-2.5 py-2.5">
      <span className="flex items-center gap-1 text-[11px] font-semibold text-ink-sub"><Icon name={icon} size={13} />{label}</span>
      <b className={"text-body font-extrabold tabular-nums " + (warn ? "text-point-text" : "text-ink")}>{value}</b>
    </Link>
  );
  return (
    <>
      <div className="flex flex-col gap-3.5 rounded-card bg-bg p-4">
        <Link href={`/trips/${t.id}`} className="press flex items-center gap-3">
          <Flag t={t} />
          <span className="min-w-0 flex-1">
            <span className="flex min-w-0 items-center gap-1.5">
              {t.dday && <span className={"flex-none rounded-full px-2 py-0.5 text-tiny font-bold " + tone}>{t.dday.label}</span>}
              <span className="truncate text-body font-extrabold text-ink">{t.title}</span>
            </span>
            <span className="block truncate text-tiny text-ink-sub">{t.sub}</span>
          </span>
          <Icon name="right" size={18} className="flex-none text-ink-sub" />
        </Link>
        {hub && <>
          <div className="flex flex-col gap-1.5">
            <p className="flex justify-between text-tiny font-bold text-ink"><span>준비 진행률</span><span className="tabular-nums text-point-text">{hub.pct}%</span></p>
            <div className="h-2 overflow-hidden rounded-full bg-line" role="img" aria-label={`준비 ${hub.pct}% 끝냄`}>
              <span className="block h-full rounded-full bg-point" style={{ width: `${hub.pct}%` }} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {stat(`/trips/${t.id}/prep`, "check", "챙길 것", hub.items.total ? `${hub.items.done}/${hub.items.total}` : "없음")}
            {stat(`/trips/${t.id}/prep`, "book", "예약 남음", `${hub.resLeft}건`, hub.resLeft > 0)}
            {stat(`/trips/${t.id}`, "pin", "날짜 미정", `${hub.undated}곳`)}
          </div>
        </>}
      </div>
    </>
  );
}
