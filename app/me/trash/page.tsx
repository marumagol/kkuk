/* 설정 > 최근 삭제한 여행 (5단계 3번). 내가 주인인 여행만, 지운 지 30일 안 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { Icon } from "@/components/kit";
import { AppShell } from "@/components/screen";
import { RestoreButton } from "@/components/restore-button";
import { getViewer } from "@/lib/viewer";
import { loadRemovedTrips } from "@/lib/trips";

export const metadata = { title: "최근 삭제한 여행" };

const short = (d: string) => d.slice(5).replace("-", ".");

export default async function Trash() {
  const v = await getViewer();
  if (v.kind !== "user") redirect("/login?next=/me/trash");
  const trips = await loadRemovedTrips(v);
  return (
    <AppShell bottomGap={false}>
      <div className="flex items-center gap-2 px-5 pt-4">
        <Link href="/me" aria-label="설정으로" className="press flex size-11 items-center justify-center rounded-full bg-surface text-ink">
          <Icon name="back" size={20} />
        </Link>
        <h1 className="text-title-lg font-extrabold text-ink">최근 삭제한 여행</h1>
      </div>
      <p className="px-5 pt-3 text-sub text-ink-sub">지운 지 30일 안에는 되살릴 수 있어요. 30일이 지나면 되돌릴 수 없게 지워져요. 여행 주인이 지운 여행만 보여요</p>
      {trips.length === 0 ? (
        <p className="mx-5 mt-5 rounded-card bg-surface p-5 text-center text-sub text-ink-sub">최근 30일 안에 삭제한 여행이 없어요</p>
      ) : (
        <ul className="flex flex-col gap-3 px-5 pb-10 pt-5">
          {trips.map((t) => (
            <li key={t.id} className="flex items-center gap-3 rounded-card bg-surface p-4">
              <div className="min-w-0 flex-1">
                <p className="truncate text-body font-bold text-ink">{t.title}</p>
                <p className="truncate text-tiny text-ink-sub">{t.cities.join(", ")}, {short(t.start)} ~ {short(t.end)}</p>
                <p className="text-tiny font-semibold text-point-text">{t.daysLeft}일 뒤 사진과 함께 완전히 지워져요</p>
              </div>
              <RestoreButton id={t.id} />
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
