/* 알림 (4단계 8) : 함께하는 사람 참여, 장소 고침, 함께 받은 도장. 열면 모두 읽음. */
import Link from "next/link";
import { EmptyState, Icon } from "@/components/kit";
import { AppShell, MockNote } from "@/components/screen";
import { ReadAll } from "@/components/read-all";
import { ClearRead } from "@/components/clear-read";
import { getViewer } from "@/lib/viewer";
import { loadNotices, type Notice } from "@/lib/trips";

export const metadata = { title: "알림" };

function textOf(n: Notice) {
  switch (n.kind) {
    case "joined": return `${n.actor}님이 여행에 함께하기 시작했어요`;
    case "items": return n.count > 1 ? `${n.actor}님이 장소를 ${n.count}번 고쳤어요${n.detail ? ` (${n.detail} 등)` : ""}` : `${n.actor}님이 장소를 고쳤어요${n.detail ? ` (${n.detail})` : ""}`;
    case "stamp": return `${n.actor}님 덕분에 ${n.detail ?? "도시"} 도장을 받았어요`;
    case "quota": return n.detail ?? "구글 지도 하루 상한 알림"; // 0048 운영자에게만 (상한 80%, 다 참)
  }
}
function hrefOf(n: Notice) {
  if (!n.tripId) return "#";
  if (n.kind === "stamp" && n.refId) return `/stamps?c=${n.refId}`;
  if (n.kind === "joined") return `/trips/${n.tripId}/members`;
  return `/trips/${n.tripId}`;
}
function ago(at: string) {
  const m = Math.max(0, Math.round((Date.now() - new Date(at).getTime()) / 60e3));
  if (m < 1) return "방금";
  if (m < 60) return `${m}분 전`;
  if (m < 60 * 24) return `${Math.floor(m / 60)}시간 전`;
  return `${Math.floor(m / 1440)}일 전`;
}

export default async function Notifications() {
  const viewer = await getViewer();
  const list = await loadNotices(viewer);
  const unread = list.some((n) => !n.read);
  return (
    <AppShell bottomGap={false}>
      <div className="relative flex items-center gap-2 px-5 pt-4">
        <Link href="/" aria-label="홈으로" className="press flex size-11 items-center justify-center rounded-full bg-surface text-ink"><Icon name="back" size={20} /></Link>
        <h1 className="min-w-0 flex-1 truncate text-title font-extrabold text-ink">알림</h1>
        {viewer.kind === "user" && list.length > 0 && <ClearRead />}
      </div>
      {viewer.kind === "preview" && <MockNote />}
      {viewer.kind === "user" && unread && <ReadAll />}
      <div className="px-5 pb-10 pt-4">
        {list.length ? (
          <ul className="flex flex-col gap-2">
            {list.map((n) => (
              <li key={n.id}>
                <Link href={hrefOf(n)} className={`press flex gap-3 rounded-card px-4 py-3 ${n.read ? "bg-bg" : "bg-surface"}`}>
                  <span aria-hidden className={`mt-1.5 size-2 flex-none rounded-full ${n.read ? "bg-transparent" : "bg-point"}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sub font-semibold text-ink">{textOf(n)}</span>
                    <span className="mt-0.5 block text-tiny text-ink-sub">{n.tripTitle} · {ago(n.at)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="아직 알림이 없어요" desc="함께하는 사람이 들어오거나 장소를 수정하면 여기에 보여요" />
        )}
      </div>
    </AppShell>
  );
}
