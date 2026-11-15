/* S18 준비 탭 (2단계) : 예산, 챙길 것, 예약. 보기만인 사람은 보기만 */
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Icon } from "@/components/kit";
import { AppShell } from "@/components/screen";
import { TripTabs } from "@/components/trip-tabs";
import { PrepPanel } from "@/components/prep-panel";
import { getViewer } from "@/lib/viewer";
import { loadPrep } from "@/lib/trips";
import { md, todayKST, daysBetween } from "@/lib/mock";

export const metadata = { title: "준비" };

export default async function Prep({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getViewer();
  if (viewer.kind === "guest") redirect(`/login?next=/trips/${id}/prep`);
  if (viewer.kind === "preview") redirect(`/trips/${id}`);
  const view = await loadPrep(viewer, id);
  if (!view) notFound();
  const today = todayKST();
  const left = daysBetween(today, view.start);
  const done = view.items.filter((x) => x.done).length;
  const when = left > 0 ? `출발까지 ${left}일` : today <= view.end ? "여행 중" : `${md(view.start)} ~ ${md(view.end)}`;
  const ready = view.items.length ? ` · 준비 ${Math.round((done / view.items.length) * 100)}%` : "";
  return (
    <AppShell>
      <div className="px-5 pt-4">
        <Link href="/trips" aria-label="여행 목록으로" className="press flex size-11 items-center justify-center rounded-full bg-surface text-ink"><Icon name="back" size={20} /></Link>
      </div>
      <div className="px-5 pt-3">
        <h1 className="text-title-xl font-extrabold text-ink">{view.tripTitle}</h1>
        <p className="mt-1 text-sub text-ink-sub">{when}{ready}</p>
      </div>
      <TripTabs tripId={id} active="준비" />
      <PrepPanel view={view} />
    </AppShell>
  );
}
