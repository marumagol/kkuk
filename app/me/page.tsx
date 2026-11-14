/* S14 마이 : 로그인 / 로그아웃, 약관, 앱 버전 */
import Link from "next/link";
import { Icon } from "@/components/kit";
import { AppShell, Avatar, MainTabs } from "@/components/screen";
import { getViewer } from "@/lib/viewer";
import { signOut } from "@/app/actions";
import pkg from "@/package.json";

export const metadata = { title: "마이" };

function Row({ label, aside }: { label: string; aside?: string }) {
  return (
    <li className="flex min-h-14 items-center justify-between gap-3 px-4">
      <span className="text-body text-ink">{label}</span>
      {aside && <span className="text-sub text-ink-sub">{aside}</span>}
    </li>
  );
}

export default async function Me() {
  const v = await getViewer();
  return (
    <AppShell>
      <header className="px-5 pt-6"><h1 className="text-title-xl font-extrabold text-ink">마이</h1></header>
      <div className="flex flex-col gap-4 px-5 pt-5">
        {v.kind === "guest" ? (
          <section className="flex flex-col gap-3 rounded-card bg-surface p-5">
            <h2 className="text-title font-bold text-ink">로그인하고 여행을 저장해 보세요</h2>
            <p className="text-sub text-ink-sub">이메일로 받은 6자리 코드로 로그인해요. 비밀번호는 없어요</p>
            <Link href="/login?next=/me" className="press inline-flex h-14 items-center justify-center gap-2 rounded-btn bg-btn text-[16px] font-bold text-on-btn">
              로그인 <Icon name="arrow" size={20} />
            </Link>
          </section>
        ) : (
          <section className="flex items-center gap-3 rounded-card bg-surface p-5">
            <Avatar initial="도" size={48} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-body font-bold text-ink">{v.kind === "user" ? v.email : "미리보기 계정"}</p>
              <p className="text-tiny text-ink-sub">{v.kind === "user" ? "이메일 로그인" : "Supabase 연결 전 화면 확인용"}</p>
            </div>
          </section>
        )}

        <ul className="divide-y divide-line rounded-card bg-surface">
          <Row label="이용약관" aside="준비 중" />
          <Row label="개인정보 처리방침" aside="준비 중" />
          <Row label="앱 버전" aside={pkg.version} />
        </ul>

        {v.kind !== "guest" && (
          <form action={signOut}>
            <button className="press h-12 w-full rounded-btn border border-line-strong bg-surface text-body font-bold text-ink">로그아웃</button>
          </form>
        )}
      </div>
      <MainTabs active="마이" />
    </AppShell>
  );
}
