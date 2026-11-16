/* S18 준비 탭 (2단계) : 예산, 챙길 것, 예약. 보기만인 사람은 보기만 */
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/screen";
import { TripTabs, TripHeader } from "@/components/trip-tabs";
import { PrepPanel } from "@/components/prep-panel";
import { getViewer } from "@/lib/viewer";
import { loadPrep, loadTrip } from "@/lib/trips";

export const metadata = { title: "준비" };

export default async function Prep({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getViewer();
  if (viewer.kind === "guest") redirect(`/login?next=/trips/${id}/prep`);
  if (viewer.kind === "preview") redirect(`/trips/${id}`);
  const [view, r] = await Promise.all([loadPrep(viewer, id), loadTrip(viewer, id)]);
  if (!view || !("trip" in r)) notFound();
  return (
    <AppShell>
      <TripHeader trip={r.trip} meId={viewer.id} user owner={r.role === "owner"} editable={r.role !== "viewer"} />
      <TripTabs tripId={id} active="준비" />
      <PrepPanel view={view} />
    </AppShell>
  );
}
