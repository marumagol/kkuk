/*
  여행 안 머리 + 탭 (2026-11-15 여행 메뉴 개편, 참고 이미지 "기록" 화면과 같게)
  - 머리 : 뒤로, (함께하는 사람, 여행 한 권, 수정) + 어두운 [공유] 알약 / 여행 이름 / "2026.12.28 – 2027.1.4 · 윤과 함께"
  - 탭 : 일정 / 준비 / 기록 세그먼트. 고른 탭은 흰 칸 + 굵은 글자, 나머지는 옅은 글자
*/
import Link from "next/link";
import { Icon } from "@/components/kit";
import { Avatar } from "@/components/screen";
import type { Trip } from "@/lib/mock";
import { FEATURES } from "@/lib/features";

export type TripTab = "일정" | "준비" | "기록";

export function TripTabs({ tripId, active }: { tripId: string; active: TripTab }) {
  const tabs = [
    { name: "일정", href: `/trips/${tripId}` }, { name: "준비", href: `/trips/${tripId}/prep` }, { name: "기록", href: `/trips/${tripId}/record` },
  ].filter((t) => FEATURES.diary || t.name !== "기록");
  return (
    <nav aria-label="여행 안 메뉴" className="mx-5 mt-4 flex gap-1 rounded-[18px] bg-surface-soft p-1">
      {tabs.map((t) => (
        <Link key={t.name} href={t.href} replace aria-current={active === t.name ? "page" : undefined}
          className={"press flex h-[38px] flex-1 items-center justify-center rounded-[14px] text-body " +
            (active === t.name ? "bg-surface font-bold text-ink shadow-[0_1px_2px_rgb(0_0_0/0.06)]" : "font-medium text-ink-sub")}>
          {t.name}
        </Link>
      ))}
    </nav>
  );
}

const dot = (d: string) => `${Number(d.slice(0, 4))}.${Number(d.slice(5, 7))}.${Number(d.slice(8))}`;
/* 받침이 있으면 "과", 없으면 "와" */
const wa = (name: string) => {
  const c = name.charCodeAt(name.length - 1);
  return c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 ? "과" : "와";
};
export function withWhom(members: Trip["members"], meId?: string) {
  const others = members.filter((m) => !meId || m.userId !== meId);
  if (!others.length || others.length === members.length && meId) return "";
  const first = others[0].name ?? others[0].initial;
  return others.length === 1 ? `${first}${wa(first)} 함께` : `${first} 외 ${others.length - 1}명과 함께`;
}

export function TripHeader({ trip, meId, user, owner, editable, back = "/trips", note }: {
  trip: Trip; meId?: string; user: boolean; owner: boolean; editable: boolean; back?: string; note?: string;
}) {
  const whom = withWhom(trip.members, meId);
  const round = "press flex size-11 flex-none items-center justify-center rounded-full bg-surface text-ink";
  return (
    <>
      <div className="flex items-center gap-1.5 px-5 pt-4">
        <Link href={back} aria-label="여행 목록으로" className={round}><Icon name="back" size={20} /></Link>
        <span className="flex-1" />
        <Link href={user ? `/trips/${trip.id}/members` : "#"} aria-label={`함께하는 사람 ${trip.members.length}명${owner ? ", 초대하기" : ""}`}
          className="press flex h-11 items-center gap-1 rounded-full bg-surface pl-1.5 pr-2.5">
          <span className="flex -space-x-2">
            {trip.members.slice(0, 3).map((m, i) => <Avatar key={i} initial={m.initial} tone={m.tone} size={30} ring src={m.avatar} />)}
          </span>
          {owner && user ? <Icon name="plus" size={16} className="text-ink-sub" /> : <span className="text-tiny font-bold text-ink-sub">{trip.members.length}</span>}
        </Link>
        {user && FEATURES.book && <Link href={`/trips/${trip.id}/book`} aria-label="여행 한 권 (인쇄, PDF)" className={round}><Icon name="book" size={20} /></Link>}
        {editable && <Link href={`/trips/${trip.id}/edit`} aria-label="여행 정보 수정" className={round}><Icon name="pencil" size={20} /></Link>}
        {editable && (
          <Link href={`/trips/${trip.id}/share`} className="press inline-flex h-11 flex-none items-center gap-1.5 rounded-full bg-deep px-4 text-sub font-bold text-on-deep">
            <Icon name="share" size={18} />공유
          </Link>
        )}
      </div>
      <div className="px-5 pt-4">
        <h1 className="text-title-xl font-extrabold text-ink">{trip.title}</h1>
        <p className="mt-1 text-sub text-ink-sub">{dot(trip.start)} – {dot(trip.end)}{whom && ` · ${whom}`}{note && ` · ${note}`}</p>
      </div>
    </>
  );
}
