/*
  여행 한 권 (5단계 6번, 2026-11-15) : 일정과 도장을 한 장씩 이어 인쇄용 화면으로.
  [인쇄, PDF로 저장] 은 브라우저 인쇄 창. 지금은 누구나 무료 (나중에 여행 패스 후보, 기획/10)
  메모와 예상 비용은 함께하는 사람끼리 보는 내용이라 그대로 싣는다.
*/
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Icon } from "@/components/kit";
import { Stamp } from "@/components/stamp-face";
import { PrintButton } from "@/components/print-button";
import { getViewer } from "@/lib/viewer";
import { loadTrip, loadTripBook, loadTripSummary } from "@/lib/trips";
import { TripSummaryRow, PhotoStack } from "@/components/trip-summary";
import { addDays, md, weekday, tripLength, type Item } from "@/lib/mock";

export const metadata = { title: "여행 한 권", robots: { index: false } };



function Place({ n, it }: { n: number; it: Item }) {
  return (
    <li className="flex gap-3 break-inside-avoid border-t border-line py-3 first:border-t-0">
      <span className="w-5 flex-none pt-0.5 text-right text-tiny font-bold text-ink-sub">{n}</span>
      <div className="min-w-0 flex-1">
        <p className="text-body font-bold text-ink">{it.title}</p>
        <p className="text-tiny text-ink-sub">{[it.time, it.category].filter(Boolean).join(", ")}</p>
        {it.desc && <p className="mt-0.5 whitespace-pre-line text-sub text-ink">{it.desc}</p>}
      </div>
    </li>
  );
}

export default async function TripBookPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getViewer();
  if (viewer.kind === "guest") redirect(`/login?next=${encodeURIComponent(`/trips/${id}/book`)}`);
  const r = await loadTrip(viewer, id);
  if (!("trip" in r)) notFound();
  const trip = r.trip;
  const book = await loadTripBook(viewer, id);
  const len = tripLength(trip);
  const summary = await loadTripSummary(viewer, trip);
  // 장소가 없는 날은 이어지는 것끼리 한 줄로 묶는다 ("2일차 ~ 9일차")
  const blocks: ({ kind: "day"; d: number } | { kind: "empty"; from: number; to: number })[] = [];
  trip.days.forEach((day, d) => {
    if (day.items.length) return void blocks.push({ kind: "day", d });
    const last = blocks[blocks.length - 1];
    if (last?.kind === "empty" && last.to === d - 1) last.to = d; else blocks.push({ kind: "empty", from: d, to: d });
  });
  const dayLabel = (d: number) => `${md(addDays(trip.start, d))} (${weekday(addDays(trip.start, d))})`;

  return (
    <main className="mx-auto w-full max-w-[720px] px-5 pb-16 pt-4 print:max-w-none print:px-0 print:pt-0">
      <div className="flex items-center gap-2 print:hidden">
        <Link href={`/trips/${id}`} aria-label="여행으로" className="press flex size-11 items-center justify-center rounded-full bg-surface text-ink">
          <Icon name="back" size={20} />
        </Link>
        <h1 className="text-title-lg font-extrabold text-ink">여행 한 권</h1>
      </div>
      <div className="mt-3 flex flex-col gap-2 print:hidden">
        <p className="text-sub text-ink-sub">일정과 도장을 한 권으로 모았어요. 인쇄 창에서 &quot;PDF로 저장&quot;을 고르면 파일로 받을 수 있어요</p>
        <PrintButton />
      </div>

      {/* 표지 : 제목 + 어두운 요약 숫자 */}
      <section className="mt-6 flex flex-col gap-4 print:mt-0 print:min-h-[90vh] print:justify-end print:break-after-page">
        <div>
          <p className="text-sub font-bold text-point-text">{trip.cities.join(", ")}</p>
          <h2 className="mt-1 text-[32px] font-extrabold leading-tight text-ink">{trip.title}</h2>
          <p className="mt-1 text-body text-ink-sub">{md(trip.start)} ~ {md(trip.end)}, {len}일</p>
        </div>
        <TripSummaryRow s={summary} />
      </section>

      {/* 일차별 카드 : 사진 묶음 + 그날 장소 */}
      <div className="mt-6 flex flex-col gap-3 print:mt-0">
        {blocks.map((b) => {
          if (b.kind === "empty") return (
            <p key={`e${b.from}`} className="flex flex-wrap items-baseline gap-x-2 rounded-card border border-dashed border-line-strong/60 px-5 py-3.5 print:hidden">
              <span className="text-body font-bold text-ink">{b.from === b.to ? `${b.from + 1}일차` : `${b.from + 1}일차 ~ ${b.to + 1}일차`}</span>
              <span className="text-sub text-ink-sub">{b.from === b.to ? dayLabel(b.from) : `${md(addDays(trip.start, b.from))} ~ ${md(addDays(trip.start, b.to))}`} · 장소가 없어요</span>
            </p>
          );
          const d = b.d, day = trip.days[d];
          const photos = [...day.items.flatMap((it) => (it.photos ?? []).filter((p) => !p.path.endsWith(".pdf")).map((p) => p.url))].filter(Boolean);
          return (
            <section key={d} className="flex flex-col gap-3 rounded-card bg-surface p-4 break-inside-avoid-page print:break-before-page print:bg-transparent print:p-0">
              <PhotoStack urls={photos} label={day.items[0]?.title} />
              <div className="px-1">
                <p className="text-sub font-bold text-point-text">{d + 1}일차 · {dayLabel(d)}</p>
                {day.title && <h3 className="text-title font-extrabold text-ink">{day.title}</h3>}
              </div>
              {day.items.length > 0 && <ol className="rounded-field bg-bg px-3 print:bg-transparent">{day.items.map((it, i) => <Place key={it.id ?? i} n={i + 1} it={it} />)}</ol>}
            </section>
          );
        })}
      </div>

      {trip.undated.length > 0 && (
        <section className="mt-8 print:mt-0 print:break-before-page">
          <h3 className="text-title font-extrabold text-ink">날짜 미정</h3>
          <ol className="mt-2">{trip.undated.map((it, i) => <Place key={it.id ?? i} n={i + 1} it={it} />)}</ol>
        </section>
      )}

      {book.stamps.length > 0 && (
        <section className="mt-8 break-inside-avoid print:mt-0 print:break-before-page">
          <h3 className="text-title font-extrabold text-ink">이 여행에서 받은 도장</h3>
          <div className="mt-4 grid grid-cols-3 gap-4">
            {book.stamps.map((s) => <Stamp key={s.name + s.date} name={s.name} country={s.country} date={md(s.date)} fluid />)}
          </div>
        </section>
      )}
      <p className="mt-10 text-center text-tiny text-ink-sub">트립추얼로 만든 여행 한 권</p>
    </main>
  );
}
