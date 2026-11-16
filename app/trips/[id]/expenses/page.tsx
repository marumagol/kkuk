/* 경비 탭 (2026-11-16 마루님 "일정, 준비, 경비 세 개로") : 정산 요약, 경비 추가, 날짜별 목록. 보기만인 사람은 보기만 */
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/screen";
import { TripTabs, TripHeader } from "@/components/trip-tabs";
import { ExpensesPanel } from "@/components/expenses-panel";
import { getViewer } from "@/lib/viewer";
import { loadExpenses, loadTrip } from "@/lib/trips";

export const metadata = { title: "경비" };

export default async function Expenses({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getViewer();
  if (viewer.kind === "guest") redirect(`/login?next=/trips/${id}/expenses`);
  if (viewer.kind === "preview") redirect(`/trips/${id}`);
  const [view, r] = await Promise.all([loadExpenses(viewer, id), loadTrip(viewer, id)]);
  if (!view || !("trip" in r)) notFound();
  return (
    <AppShell>
      <TripHeader trip={r.trip} meId={viewer.id} user owner={r.role === "owner"} editable={r.role !== "viewer"} />
      <TripTabs tripId={id} active="경비" />
      <ExpensesPanel view={view} />
    </AppShell>
  );
}
