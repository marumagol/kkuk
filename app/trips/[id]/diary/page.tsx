/* 일기 쓰기 / 고치기. ?day=2 (2일차) 또는 ?recap=1 (여행 회고). 내 일기만 */
import { notFound, redirect } from "next/navigation";
import { getViewer } from "@/lib/viewer";
import { loadEntryContext, loadTrip, loadTripSummary } from "@/lib/trips";
import { TripSummaryRow } from "@/components/trip-summary";
import { addDays, md } from "@/lib/mock";
import { PlaceShell } from "../places/place-shell";
import { JournalForm } from "@/components/journal-form";

export const metadata = { title: "일기 쓰기" };

export default async function WriteDiary({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ day?: string; recap?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const viewer = await getViewer();
  const q = sp.recap ? "recap=1" : `day=${sp.day ?? 1}`;
  if (viewer.kind === "guest") redirect(`/login?next=${encodeURIComponent(`/trips/${id}/diary?${q}`)}`);
  if (viewer.kind === "preview") redirect(`/trips/${id}`);
  const kind = sp.recap ? "recap" : "day";
  const ctx = await loadEntryContext(viewer, id, kind, kind === "day" ? Number(sp.day ?? 1) - 1 : null);
  if (!ctx) notFound();
  const slot = kind === "recap" ? "여행 회고" : `${ctx.dayIndex! + 1}일차 · ${md(addDays(ctx.start, ctx.dayIndex!))}`;
  const full = kind === "recap" ? await loadTrip(viewer, id) : null;
  const summary = full && "trip" in full ? await loadTripSummary(viewer, full.trip) : null;
  return (
    <PlaceShell tripId={id} title={ctx.entry ? "일기 고치기" : "일기 쓰기"} back={ctx.entry ? `/diary/${ctx.entry.id}` : `/trips/${id}${kind === "day" ? `?day=${ctx.dayIndex! + 1}` : ""}`}>
      <p className="mx-5 mt-2 inline-flex h-8 items-center self-start rounded-full bg-point-soft px-3 text-tiny font-bold text-point-text">{ctx.tripTitle} · {slot}</p>
      {summary && <TripSummaryRow s={summary} className="mx-5 mt-3" />}
      <JournalForm ctx={ctx} />
    </PlaceShell>
  );
}
