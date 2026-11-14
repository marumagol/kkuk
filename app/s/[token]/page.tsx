/* 일부 일정 공유 링크 (4단계 7) : 로그인 없이 고른 날만 보기. 검색에는 나오지 않게 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CategoryChip } from "@/components/kit";
import { AppShell, Logo } from "@/components/screen";
import { TripMap, type MapPoint } from "@/components/trip-map";
import { loadPublicShare } from "@/lib/trips";
import { addDays, md, weekday } from "@/lib/mock";

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const s = await loadPublicShare((await params).token);
  if (!s) return { title: "일정", robots: { index: false, follow: false } };
  const title = `${s.title} 일정`;
  const description = s.days.map((d) => `${d + 1}일차 ${md(addDays(s.start_date, d))}`).join(", ");
  return { title, description, robots: { index: false, follow: false }, openGraph: { title, description, siteName: "KKuK", images: [{ url: "/icon-512.png", width: 512, height: 512 }] } };
}

export default async function SharedDays({ params }: Props) {
  const s = await loadPublicShare((await params).token);
  if (!s) notFound();
  return (
    <AppShell bottomGap={false}>
      <div className="flex items-center justify-between px-5 pt-4">
        <Link href="/" aria-label="KKuK 처음으로" className="press flex h-11 items-center"><Logo /></Link>
      </div>
      <header className="px-5 pt-3">
        <h1 className="text-title-xl font-extrabold text-ink">{s.title}</h1>
        <p className="mt-1 text-sub text-ink-sub">{md(s.start_date)} ~ {md(s.end_date)} 중 {s.days.length}일 공유</p>
      </header>
      <div className="flex flex-col gap-6 px-5 pb-10 pt-5">
        {s.days.map((d) => {
          const date = addDays(s.start_date, d);
          const items = s.items.filter((i) => i.day_index === d);
          const points: MapPoint[] = items.flatMap((i) => (i.lat != null && i.lng != null ? [{ lat: i.lat, lng: i.lng, title: i.title, sub: i.start_time ?? undefined }] : []));
          return (
            <section key={d} aria-label={`${d + 1}일차`} className="flex flex-col gap-3">
              <h2 className="text-body font-bold text-ink">{d + 1}일차 <span className="text-sub font-semibold text-ink-sub">{md(date)} {weekday(date)}</span></h2>
              {points.length > 0 && <TripMap points={points} height={240} />}
              {items.length ? (
                <ol className="flex flex-col gap-2">
                  {items.map((i, n) => (
                    <li key={n} className="flex items-start gap-3 rounded-card bg-surface px-4 py-3">
                      <span className="mt-0.5 w-11 flex-none text-sub font-bold text-ink-sub">{i.start_time ?? "-"}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-body font-semibold text-ink">{i.title}</p>
                        {i.address && <p className="mt-0.5 truncate text-tiny text-ink-sub">{i.address}</p>}
                      </div>
                      <CategoryChip category={i.category} />
                    </li>
                  ))}
                </ol>
              ) : <p className="rounded-card bg-surface px-4 py-6 text-center text-sub text-ink-sub">이 날은 아직 장소가 없어요</p>}
            </section>
          );
        })}
        <Link href="/" className="press flex h-12 items-center justify-center rounded-full bg-btn text-body font-bold text-on-btn">KKuK 로 내 여행 계획하기</Link>
      </div>
    </AppShell>
  );
}
