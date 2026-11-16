/* S09 여행 정보 수정 (여행 주인, 편집 가능) */
import Link from "next/link";
import { redirect } from "next/navigation";
import { Icon } from "@/components/kit";
import { AppShell } from "@/components/screen";
import { TripEdit } from "@/components/trip-edit";
import { getViewer } from "@/lib/viewer";
import { loadTripForEdit, loadStampCities } from "@/lib/trips";
import { todayIn } from "@/lib/mock";

export const metadata = { title: "여행 정보 수정" };

export default async function EditTrip({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const v = await getViewer();
  if (v.kind === "guest") redirect(`/login?next=/trips/${id}/edit`);
  const trip = await loadTripForEdit(v, id);
  // 볼 수 없거나 고칠 권한이 없으면 여행 화면으로 (그 화면이 이유를 보여 준다)
  if (!trip || trip.role === "viewer") redirect(`/trips/${id}`);

  return (
    <AppShell bottomGap={false}>
      <div className="flex items-center gap-2 px-5 pt-4">
        <Link href={`/trips/${id}`} aria-label="여행으로" className="press flex size-11 items-center justify-center rounded-full bg-surface text-ink">
          <Icon name="back" size={20} />
        </Link>
        <h1 className="text-title-lg font-extrabold text-ink">여행 정보 수정</h1>
      </div>
      <TripEdit trip={trip} today={todayIn(trip.timeZone)} stampCities={await loadStampCities()} />
    </AppShell>
  );
}
