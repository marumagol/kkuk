/*
  S17 초대 링크 열기 (2단계). 로그인 전에는 여행 이름, 기간, 초대한 사람만 보여 주고 [참여하기] → 로그인 → 다시 여기
  상태 : ok / joined(이미 함께함) / revoked / expired / trip_removed / not_found
*/
import Link from "next/link";
import { AppShell, BRAND, Logo } from "@/components/screen";
import { getViewer } from "@/lib/viewer";
import { createClient } from "@/lib/supabase/server";
import { md } from "@/lib/mock";
import { JoinButton } from "@/components/join-button";

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }) {
  // 카카오톡 등 메신저 미리보기 카드 (4단계 6) : 여행 이름, 날짜, 초대한 사람
  const { token } = await params;
  const sb = /^[0-9a-f]{32}$/.test(token) ? await createClient() : null;
  const { data } = sb ? await sb.rpc("invite_preview", { p_token: token }) : { data: null };
  const p = ((data ?? []) as Preview[])[0];
  if (!p || p.status !== "ok" || !p.title) return { title: "초대", robots: { index: false } };
  const title = `${p.inviter ?? "함께할 사람"}님이 "${p.title}" 여행에 초대했어요`;
  const description = p.start_date && p.end_date ? `${md(p.start_date)} ~ ${md(p.end_date)}, 트립추얼에서 함께 계획해요` : "트립추얼에서 함께 계획해요";
  return {
    title, description, robots: { index: false },
    openGraph: { title, description, siteName: BRAND, images: [{ url: "/og.png", width: 1200, height: 630 }] },
  };
}

type Preview = { trip_id: string | null; title: string | null; start_date: string | null; end_date: string | null; inviter: string | null; role: string | null; status: string };
const BAD: Record<string, string> = {
  revoked: "호스트가 끊은 초대 링크예요",
  expired: "기간이 지난 초대 링크예요",
  trip_removed: "삭제된 여행이에요",
  not_found: "없는 초대 링크예요",
};

export default async function Invite({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const viewer = await getViewer();
  const sb = /^[0-9a-f]{32}$/.test(token) ? await createClient() : null;
  const { data } = sb ? await sb.rpc("invite_preview", { p_token: token }) : { data: null };
  const p = ((data ?? []) as Preview[])[0] ?? { status: "not_found" } as Preview;

  return (
    <AppShell bottomGap={false}>
      <div className="px-5 pt-4"><Link href="/" aria-label="홈" className="flex h-11 items-center"><Logo /></Link></div>
      <div className="flex flex-col gap-4 px-5 pt-8">
        {p.status === "ok" || p.status === "joined" ? (
          <section className="flex flex-col gap-4 rounded-card bg-surface p-6 text-center">
            <p className="text-sub text-ink-sub"><b className="text-ink">{p.inviter}</b>님이 여행에 초대했어요</p>
            <h1 className="text-title-xl font-extrabold text-ink">{p.title}</h1>
            <p className="text-sub text-ink-sub">{p.start_date && p.end_date ? `${md(p.start_date)} ~ ${md(p.end_date)}` : ""} · {p.role === "viewer" ? "보기만" : "편집 가능"}으로 함께해요</p>
            {p.status === "joined" && p.trip_id ? (
              <Link href={`/trips/${p.trip_id}`} className="press inline-flex h-14 items-center justify-center rounded-btn bg-btn text-[16px] font-bold text-on-btn">이미 함께하는 여행이에요. 여행 보기</Link>
            ) : viewer.kind === "user" && !viewer.anon ? (
              <JoinButton token={token} />
            ) : (
              <>
                <Link href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`} className="press inline-flex h-14 items-center justify-center rounded-btn bg-btn text-[16px] font-bold text-on-btn">로그인하고 참여하기</Link>
                <p className="text-tiny text-ink-sub">{viewer.kind === "user" ? "초대받은 여행은 로그인하면 들어갈 수 있어요. 지금까지 만든 기록은 그대로 남아요" : "카카오나 구글 계정으로 로그인해요"}</p>
              </>
            )}
          </section>
        ) : (
          <section role="alert" className="flex flex-col items-center gap-3 rounded-card bg-surface px-6 py-8 text-center">
            <h1 className="text-title font-bold text-ink">{BAD[p.status] ?? BAD.not_found}</h1>
            <p className="text-sub text-ink-sub">초대한 사람에게 새 링크를 받아 주세요</p>
            <Link href="/" className="press inline-flex h-11 items-center rounded-btn border border-line-strong bg-surface px-4 text-sub font-bold text-ink">홈으로</Link>
          </section>
        )}
      </div>
    </AppShell>
  );
}
