/*
  여행 안 "기록" 탭 (2026-11-15 여행 메뉴 개편, 참고 이미지와 같게)
  - 어두운 요약 카드 : 함께한 시간 / 꽂은 핀(장소) / 남긴 사진 / 새 도장
  - 이 여행의 일기 카드 : 사진 묶음(큰 1 + 작은 2, "+4") + 첫 장소 표, "2일차 · 12.29", 제목, 글 2줄, 그날 간 곳 칩
  - 일기를 누르면 일기 한 편 (/diary/[id]). 일기 탭(아래 탭)은 그대로 둔다
  RLS 가 남의 "나만 보기" 일기는 걸러 낸다
*/
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Icon } from "@/components/kit";
import { AppShell } from "@/components/screen";
import { TripTabs, TripHeader } from "@/components/trip-tabs";
import { TripSummaryRow, PhotoStack } from "@/components/trip-summary";
import { getViewer } from "@/lib/viewer";
import { loadTrip, loadTripBook, loadTripSummary, type Entry } from "@/lib/trips";
import { addDays, md, statusOf, todayOf, daysBetween, type Trip } from "@/lib/mock";

export const metadata = { title: "기록" };

function RecordCard({ e, trip }: { e: Entry; trip: Trip }) {
  const items = e.dayIndex != null ? trip.days[e.dayIndex]?.items ?? [] : [];
  const places = items.map((i) => i.title);
  const head = e.kind === "recap" ? "여행 회고" : `${e.dayIndex! + 1}일차 · ${md(addDays(trip.start, e.dayIndex!))}`;
  const tag = items.find((i) => i.photos?.length)?.title ?? places[0];
  return (
    <Link href={`/diary/${e.id}`} className="press flex flex-col gap-3 rounded-[24px] bg-surface p-3">
      {e.photos.length > 0 && <PhotoStack urls={e.photos.map((p) => p.url)} label={tag} aspect="aspect-[9/4]" />}
      <div className="flex flex-col gap-1 px-1 pb-1">
        <p className="text-sub font-bold text-point-text">{head}{!e.mine && <span className="font-semibold text-ink-sub"> · {e.author}</span>}</p>
        {e.title && <h2 className="text-title font-extrabold text-ink">{e.title}</h2>}
        {e.body && <p className="line-clamp-2 text-body text-ink-sub">{e.body}</p>}
        {places.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="그날 간 곳">
            {places.slice(0, 2).map((p, i) => <li key={i} className="flex h-8 max-w-[60%] items-center truncate rounded-full bg-surface-soft px-3 text-sub font-semibold text-ink">{p}</li>)}
            {places.length > 2 && <li className="flex h-8 items-center rounded-full bg-surface-soft px-3 text-sub font-semibold text-ink">+{places.length - 2}</li>}
          </ul>
        )}
      </div>
    </Link>
  );
}

export default async function Record({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getViewer();
  if (viewer.kind === "guest") redirect(`/login?next=/trips/${id}/record`);
  if (viewer.kind === "preview") redirect(`/trips/${id}`);
  const r = await loadTrip(viewer, id);
  if (!("trip" in r)) notFound();
  const trip = r.trip;
  const [summary, book] = await Promise.all([loadTripSummary(viewer, trip), loadTripBook(viewer, id)]);
  const entries = book.entries;
  const status = statusOf(trip, todayOf(trip));
  const today = status === "ongoing" ? daysBetween(trip.start, todayOf(trip)) + 1 : 1;
  const writeHref = status === "past" ? `/trips/${id}/diary?recap=1` : `/trips/${id}/diary?day=${today}`;

  return (
    <AppShell>
      <TripHeader trip={trip} meId={viewer.id} user owner={r.role === "owner"} editable={r.role !== "viewer"} />
      <TripTabs tripId={id} active="기록" />
      <TripSummaryRow s={summary} className="mx-5 mt-4" />

      <div className="flex items-center justify-between px-5 pt-5">
        <h2 className="text-body font-bold text-ink">일기 <span className="text-ink-sub">{entries.length}</span></h2>
        <Link href={writeHref} className="press inline-flex h-10 items-center gap-1 rounded-full bg-surface px-3.5 text-tiny font-bold text-ink">
          <Icon name="pencil" size={16} />{status === "past" ? "회고 쓰기" : "일기 쓰기"}
        </Link>
      </div>
      <div className="flex flex-col gap-3 px-5 pb-8 pt-3">
        {entries.length ? entries.map((e) => <RecordCard key={e.id} e={e} trip={trip} />) : (
          <div className="flex flex-col items-center gap-2 rounded-[24px] bg-surface px-6 py-10 text-center">
            <p className="text-body font-bold text-ink">아직 남긴 기록이 없어요</p>
            <p className="text-sub text-ink-sub">{status === "upcoming" ? "여행이 시작되면 그날그날 사진과 일기를 남겨 보세요" : "그날 간 곳과 사진으로 일기를 남겨 보세요"}</p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
