/*
  여행 한 권 (5단계 6번, 2026-11-15) : 일정, 일기, 도장을 한 장씩 이어 인쇄용 화면으로.
  [인쇄, PDF로 저장] 은 브라우저 인쇄 창. 지금은 누구나 무료 (나중에 여행 패스 후보, 기획/10)
  메모와 예상 비용은 함께하는 사람끼리 보는 내용이라 그대로 싣는다. 나만 보기 일기는 내 것만 (RLS)
*/
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Icon, Stamp } from "@/components/kit";
import { PrintButton } from "@/components/print-button";
import { getViewer } from "@/lib/viewer";
import { loadTrip, loadTripBook } from "@/lib/trips";
import { addDays, md, weekday, tripLength, type Item } from "@/lib/mock";

export const metadata = { title: "여행 한 권", robots: { index: false } };



function Place({ n, it }: { n: number; it: Item }) {
  return (
    <li className="flex gap-3 break-inside-avoid py-2">
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
  const dayEntries = (d: number) => book.entries.filter((e) => e.kind === "day" && e.dayIndex === d);
  const recaps = book.entries.filter((e) => e.kind === "recap");

  return (
    <main className="mx-auto w-full max-w-[720px] px-5 pb-16 pt-4 print:max-w-none print:px-0 print:pt-0">
      <div className="flex items-center gap-2 print:hidden">
        <Link href={`/trips/${id}`} aria-label="여행으로" className="press flex size-11 items-center justify-center rounded-full bg-surface text-ink">
          <Icon name="back" size={20} />
        </Link>
        <h1 className="text-title-lg font-extrabold text-ink">여행 한 권</h1>
      </div>
      <div className="mt-3 flex flex-col gap-2 print:hidden">
        <p className="text-sub text-ink-sub">일정, 일기, 도장을 한 권으로 모았어요. 인쇄 창에서 &quot;PDF로 저장&quot;을 고르면 파일로 받을 수 있어요</p>
        <PrintButton />
      </div>

      {/* 표지 */}
      <section className="mt-8 flex min-h-[40vh] flex-col justify-end rounded-card bg-surface p-6 print:mt-0 print:min-h-[90vh] print:break-after-page print:rounded-none print:bg-transparent">
        <p className="text-sub font-semibold text-point-text">{trip.cities.join(", ")}</p>
        <h2 className="mt-1 text-[32px] font-extrabold leading-tight text-ink">{trip.title}</h2>
        <p className="mt-2 text-body text-ink-sub">{md(trip.start)} ~ {md(trip.end)}, {len}일</p>
      </section>

      {/* 일차별 : 장소 + 그날 일기 */}
      {trip.days.map((day, d) => (
        <section key={d} className="mt-8 break-inside-avoid-page print:mt-0 print:break-before-page">
          <h3 className="border-b border-line pb-2 text-title font-extrabold text-ink">
            {d + 1}일차 <span className="text-sub font-semibold text-ink-sub">{md(addDays(trip.start, d))} ({weekday(addDays(trip.start, d))})</span>
          </h3>
          {day.items.length ? (
            <ol className="mt-2">{day.items.map((it, i) => <Place key={it.id ?? i} n={i + 1} it={it} />)}</ol>
          ) : <p className="mt-3 text-sub text-ink-sub">이날은 정한 장소가 없어요</p>}
          {dayEntries(d).map((e) => (
            <article key={e.id} className="mt-4 break-inside-avoid rounded-card bg-surface p-4 print:border print:border-line print:bg-transparent">
              <p className="text-tiny font-semibold text-ink-sub">{e.author}의 일기</p>
              {e.title && <h4 className="mt-1 text-body font-bold text-ink">{e.title}</h4>}
              {e.body && <p className="mt-1 whitespace-pre-line text-sub text-ink">{e.body}</p>}
              {e.photos.length > 0 && (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {e.photos.slice(0, 6).map((p) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={p.path} src={p.url} alt="" className="aspect-square w-full rounded-field object-cover" />
                  ))}
                </div>
              )}
            </article>
          ))}
        </section>
      ))}

      {trip.undated.length > 0 && (
        <section className="mt-8 print:mt-0 print:break-before-page">
          <h3 className="border-b border-line pb-2 text-title font-extrabold text-ink">날짜 미정</h3>
          <ol className="mt-2">{trip.undated.map((it, i) => <Place key={it.id ?? i} n={i + 1} it={it} />)}</ol>
        </section>
      )}

      {recaps.length > 0 && (
        <section className="mt-8 print:mt-0 print:break-before-page">
          <h3 className="border-b border-line pb-2 text-title font-extrabold text-ink">여행 회고</h3>
          {recaps.map((e) => (
            <article key={e.id} className="mt-4 break-inside-avoid">
              <p className="text-tiny font-semibold text-ink-sub">{e.author}</p>
              {e.title && <h4 className="mt-1 text-body font-bold text-ink">{e.title}</h4>}
              <p className="mt-1 whitespace-pre-line text-sub text-ink">{e.body}</p>
            </article>
          ))}
        </section>
      )}

      {book.stamps.length > 0 && (
        <section className="mt-8 break-inside-avoid print:mt-0 print:break-before-page">
          <h3 className="border-b border-line pb-2 text-title font-extrabold text-ink">이 여행에서 받은 도장</h3>
          <div className="mt-4 grid grid-cols-3 gap-4">
            {book.stamps.map((s) => <Stamp key={s.name + s.date} name={s.name} country={s.country} date={md(s.date)} fluid />)}
          </div>
        </section>
      )}
      <p className="mt-10 text-center text-tiny text-ink-sub">꾹(KKuK)으로 만든 여행 한 권</p>
    </main>
  );
}
