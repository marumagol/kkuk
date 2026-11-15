/* 일정 공유 : 여행 전체(기본) 또는 고른 일차 링크 만들기와 끊기. 편집 가능 이상만 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/kit";
import { AppShell } from "@/components/screen";
import { DayShareForm } from "@/components/day-share";
import { getViewer } from "@/lib/viewer";
import { loadDayShares, loadTrip } from "@/lib/trips";
import { addDays, md, weekday } from "@/lib/mock";

export const metadata = { title: "일정 공유" };

export default async function SharePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getViewer();
  const r = await loadTrip(viewer, id);
  if (!("trip" in r)) notFound();
  const trip = r.trip;
  const canEdit = "role" in r && (r.role === "owner" || r.role === "editor");
  const days = trip.days.map((d, i) => ({ index: i, label: `${i + 1}일차`, sub: `${md(addDays(trip.start, i))} ${weekday(addDays(trip.start, i))}`, count: d.items.length }));
  const shares = canEdit ? await loadDayShares(viewer, trip.id) : [];

  return (
    <AppShell bottomGap={false}>
      <div className="flex items-center gap-2 px-5 pt-4">
        <Link href={`/trips/${trip.id}`} aria-label="일정으로" className="press flex size-11 items-center justify-center rounded-full bg-surface text-ink"><Icon name="back" size={20} /></Link>
        <h1 className="min-w-0 flex-1 truncate text-title font-extrabold text-ink">일정 공유</h1>
      </div>
      {canEdit ? (
        <DayShareForm tripId={trip.id} days={days} shares={shares} />
      ) : (
        <p className="mx-5 mt-5 rounded-card bg-surface px-4 py-8 text-center text-sub text-ink-sub">편집 가능 권한이 있는 사람만 일정을 공유할 수 있어요</p>
      )}
    </AppShell>
  );
}
