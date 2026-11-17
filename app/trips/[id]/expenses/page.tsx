/* 경비 탭 (2026-11-16 마루님 "일정, 준비, 경비 세 개로") : 예산 카드(준비 탭에서 옮김), 정산 요약, 경비 추가, 날짜별 목록. 보기만인 사람은 보기만 */
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/screen";
import { TripTabs, TripHeader } from "@/components/trip-tabs";
import { ExpensesPanel } from "@/components/expenses-panel";
import { getViewer } from "@/lib/viewer";
import { loadExpenses, loadTrip } from "@/lib/trips";

export const metadata = { title: "비용" };

export default async function Expenses({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ add?: string }> }) {
  const { id } = await params;
  const { add } = await searchParams;
  const viewer = await getViewer();
  if (viewer.kind === "guest") redirect(`/login?next=/trips/${id}/expenses`);
  if (viewer.kind === "preview") redirect(`/trips/${id}`);
  const [view, r] = await Promise.all([loadExpenses(viewer, id), loadTrip(viewer, id)]);
  if (!view || !("trip" in r)) notFound();
  return (
    <AppShell>
      <TripHeader trip={r.trip} meId={viewer.id} user owner={r.role === "owner"} editable={r.role !== "viewer"} />
      <TripTabs tripId={id} active="비용" />
      <ExpensesPanel openAdd={add === "1"} view={view} />
    </AppShell>
  );
}
