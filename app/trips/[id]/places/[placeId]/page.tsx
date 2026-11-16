/* S08 장소 수정 */
import { redirect } from "next/navigation";
import { PlaceShell } from "../place-shell";
import { PlaceForm } from "@/components/place-form";
import { MemoForm } from "@/components/memo-form";
import { AppShell } from "@/components/screen";
import { getViewer } from "@/lib/viewer";
import { loadPlaceContext } from "@/lib/trips";

export const metadata = { title: "장소 수정" };

export default async function EditPlace({ params }: { params: Promise<{ id: string; placeId: string }> }) {
  const { id, placeId } = await params;
  const v = await getViewer();
  if (v.kind === "guest") redirect(`/login?next=/trips/${id}`);
  const ctx = await loadPlaceContext(v, id, placeId);
  if (!ctx?.place || ctx.role === "viewer") redirect(`/trips/${id}`);
  const day = ctx.place.day_index != null && ctx.place.day_index < ctx.days ? ctx.place.day_index : null;
  if (ctx.place.category === "memo") return <AppShell bottomGap={false}><MemoForm ctx={ctx} day={day} back={`/trips/${id}${day == null ? "?undated=1" : `?day=${day + 1}`}`} /></AppShell>;
  return (
    <PlaceShell tripId={id} title="장소 수정" back={`/trips/${id}${day == null ? "" : `?day=${day + 1}`}`}>
      <PlaceForm ctx={ctx} day={day} />
    </PlaceShell>
  );
}
