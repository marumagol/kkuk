/* S08 장소 추가. ?day=2 (일차) 또는 ?day=none (날짜 미정) */
import { FlashToast } from "@/components/toast";
import { redirect } from "next/navigation";
import { PlaceShell } from "../place-shell";
import { PlaceForm } from "@/components/place-form";
import { MemoForm } from "@/components/memo-form";
import { AppShell } from "@/components/screen";
import { getViewer } from "@/lib/viewer";
import { loadPlaceContext } from "@/lib/trips";

export const metadata = { title: "장소 추가" };

export default async function NewPlace({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ day?: string; kind?: string; added?: string }> }) {
  const { id } = await params;
  const { day, kind, added } = await searchParams;
  const memo = kind === "memo";
  const v = await getViewer();
  if (v.kind === "guest") redirect(`/login?next=/trips/${id}`);
  const ctx = await loadPlaceContext(v, id);
  if (!ctx || ctx.role === "viewer") redirect(`/trips/${id}`);
  const n = Number(day);
  const start = day === "none" ? null : Number.isInteger(n) && n >= 1 && n <= ctx.days ? n - 1 : 0;
  const back = `/trips/${id}${start == null ? "?undated=1" : `?day=${start + 1}`}`;
  if (memo) return <AppShell bottomGap={false}><MemoForm ctx={ctx} day={start} back={back} /></AppShell>;
  return (
    <PlaceShell tripId={id} title={memo ? "메모 추가" : "장소 추가"} back={`/trips/${id}${start == null ? "" : `?day=${start + 1}`}`}>
      {/* 이어서 추가 : 저장 뒤 같은 날로 다시 열린다. key 로 칸을 비운다 */}
      {added && <FlashToast key={added} message="장소를 추가했어요. 이어서 다음 장소를 적어 주세요" />}
      <PlaceForm key={added ?? "first"} ctx={ctx} day={start} memo={memo} />
    </PlaceShell>
  );
}
