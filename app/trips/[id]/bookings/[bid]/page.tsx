/* 예약 지갑 (0034, 2026-11-16 마루님) : 준비 탭 예약 하나의 예약번호, 메모, 첨부 파일(항공권, 바우처 PDF, 캡처). 보기만인 사람은 보기만 */
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Icon } from "@/components/kit";
import { AppShell } from "@/components/screen";
import { BookingForm } from "@/components/booking-form";
import { getViewer } from "@/lib/viewer";
import { loadBooking } from "@/lib/trips";
import { md } from "@/lib/mock";

export const metadata = { title: "예약" };

export default async function Booking({ params }: { params: Promise<{ id: string; bid: string }> }) {
  const { id, bid } = await params;
  const viewer = await getViewer();
  if (viewer.kind === "guest") redirect(`/login?next=/trips/${id}/bookings/${bid}`);
  if (viewer.kind === "preview") redirect(`/trips/${id}`);
  const view = await loadBooking(viewer, id, bid);
  if (!view) notFound();
  return (
    <AppShell>
      <div className="flex items-center gap-2 px-5 pt-4">
        <Link href={`/trips/${id}/prep`} aria-label="준비로" className="press flex size-11 items-center justify-center rounded-full bg-surface text-ink"><Icon name="back" size={20} /></Link>
        <div className="min-w-0">
          <h1 className="text-title-lg font-extrabold text-ink">{view.canEdit ? "예약 수정" : "예약"}</h1>
          <p className="truncate text-tiny text-ink-sub">{view.tripTitle}, {md(view.start)} ~ {md(view.end)}</p>
        </div>
      </div>
      <BookingForm view={view} />
    </AppShell>
  );
}
