/* S13 탈퇴하기 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { Icon } from "@/components/kit";
import { AppShell } from "@/components/screen";
import { WithdrawForm } from "@/components/withdraw-form";
import { getViewer } from "@/lib/viewer";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "탈퇴하기" };

export default async function Withdraw() {
  const v = await getViewer();
  if (v.kind !== "user") redirect("/login?next=/me/withdraw");
  const sb = (await createClient())!;
  // 내가 호스트인 여행과, 그중 다른 사람이 함께하는 여행 수
  const { data: mine } = await sb.from("trip_members").select("trip_id").eq("user_id", v.id).eq("role", "owner").is("removed_at", null);
  const ids = (mine ?? []).map((m: { trip_id: string }) => m.trip_id);
  let shared = 0;
  if (ids.length) {
    const { data: others } = await sb.from("trip_members").select("trip_id").in("trip_id", ids).neq("user_id", v.id).is("removed_at", null);
    shared = new Set((others ?? []).map((o: { trip_id: string }) => o.trip_id)).size;
  }

  return (
    <AppShell bottomGap={false}>
      <div className="flex items-center gap-2 px-5 pt-4">
        <Link href="/me" aria-label="설정으로" className="press flex size-11 items-center justify-center rounded-full bg-surface text-ink">
          <Icon name="back" size={20} />
        </Link>
        <h1 className="text-title-lg font-extrabold text-ink">탈퇴하기</h1>
      </div>
      <div className="flex flex-col gap-4 px-5 pt-6">
        <section className="flex flex-col gap-2 rounded-card bg-surface p-5">
          <h2 className="text-title font-bold text-ink">탈퇴하면 이렇게 돼요</h2>
          <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sub text-ink marker:text-ink-sub">
            <li>내가 만든 여행 <b className="font-bold">{ids.length}개</b>가 일정, 장소와 함께 바로 삭제돼요</li>
            <li>지운 여행은 되살릴 수 없어요</li>
            <li>같은 이메일로 다시 가입하면 새 계정으로 시작해요</li>
          </ul>
        </section>
        {shared > 0 ? (
          <p role="alert" className="rounded-field bg-warn-soft px-4 py-3 text-sub font-semibold text-warn-text">
            함께하는 사람이 있는 여행이 {shared}개 있어요. 그 여행의 호스트를 다른 사람에게 넘긴 뒤 탈퇴할 수 있어요
          </p>
        ) : (
          <WithdrawForm email={v.email} />
        )}
      </div>
    </AppShell>
  );
}
