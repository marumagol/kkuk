/* S08 장소 추가. ?day=2 (일차) 또는 ?day=none (날짜 미정) */
import { redirect } from "next/navigation";
import { PlaceShell } from "../place-shell";
import { PlaceForm } from "@/components/place-form";
import { getViewer } from "@/lib/viewer";
import { loadPlaceContext } from "@/lib/trips";

export const metadata = { title: "장소 추가" };

export default async function NewPlace({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ day?: string }> }) {
  const { id } = await params;
  const { day } = await searchParams;
  const v = await getViewer();
  if (v.kind === "guest") redirect(`/login?next=/trips/${id}`);
  const ctx = await loadPlaceContext(v, id);
  if (!ctx || ctx.role === "viewer") redirect(`/trips/${id}`);
  const n = Number(day);
  const start = day === "none" ? null : Number.isInteger(n) && n >= 1 && n <= ctx.days ? n - 1 : 0;
  return (
    <PlaceShell tripId={id} title="장소 추가" back={`/trips/${id}${start == null ? "" : `?day=${start + 1}`}`}>
      <PlaceForm ctx={ctx} day={start} />
    </PlaceShell>
  );
}
