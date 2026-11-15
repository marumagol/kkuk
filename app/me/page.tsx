/* S14 설정 (옛 이름 마이, 2026-11-14 마루님) : 로그인 / 로그아웃, 화면 모드, 약관, 앱 버전 */
import Link from "next/link";
import { Icon } from "@/components/kit";
import { AppShell, Avatar, MainTabs } from "@/components/screen";
import { getViewer, initialOf } from "@/lib/viewer";
import { signOut } from "@/app/actions";
import pkg from "@/package.json";
import { cookies } from "next/headers";
import { AvatarEditor } from "@/components/avatar-editor";
import { ThemePicker, type Theme } from "@/components/theme-picker";

export const metadata = { title: "설정" };

function LinkRow({ href, label }: { href: string; label: string }) {
  return (
    <li>
      <Link href={href} className="press flex min-h-14 items-center justify-between gap-3 px-4">
        <span className="text-body text-ink">{label}</span>
        <Icon name="right" size={18} className="text-ink-sub" />
      </Link>
    </li>
  );
}

export default async function Me() {
  const v = await getViewer();
  const saved = (await cookies()).get("kkuk-theme")?.value;
  const theme: Theme = saved === "light" || saved === "dark" ? saved : "system";
  return (
    <AppShell>
      <header className="px-5 pt-6"><h1 className="text-title-xl font-extrabold text-ink">설정</h1></header>
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
            {v.kind === "user" ? <AvatarEditor initial={initialOf(v)} src={v.avatar} userId={v.id} /> : <Avatar initial={initialOf(v)} size={48} />}
            <div className="min-w-0 flex-1">
              <p className="truncate text-body font-bold text-ink">{v.kind === "user" ? v.name : "미리보기 계정"}</p>
              {v.kind === "user" ? (
                <p className="text-tiny text-ink-sub"><span className="block break-all">{v.email}</span><span className="block">이메일 로그인</span></p>
              ) : <p className="text-tiny text-ink-sub">Supabase 연결 전 화면 확인용</p>}
            </div>
            {v.kind === "user" && (
              <Link href="/me/name" className="press inline-flex h-11 flex-none items-center px-1 text-sub font-semibold text-ink-sub underline underline-offset-4">이름 바꾸기</Link>
            )}
          </section>
        )}

        <section className="flex flex-col gap-3 rounded-card bg-surface p-4" aria-labelledby="theme-title">
          <h2 id="theme-title" className="text-body font-bold text-ink">화면 모드</h2>
          <ThemePicker initial={theme} />
        </section>

        <ul className="divide-y divide-line rounded-card bg-surface">
          <LinkRow href="/terms" label="이용약관" />
          <LinkRow href="/privacy" label="개인정보 처리방침" />
          <li>
            <Link href="/me/updates" className="press flex min-h-14 items-center justify-between gap-3 px-4">
              <span className="text-body text-ink">업데이트 내역</span>
              <span className="flex items-center gap-1 text-sub text-ink-sub">버전 {pkg.version}<Icon name="right" size={18} /></span>
            </Link>
          </li>
        </ul>

        {v.kind !== "guest" && (
          <form action={signOut}>
            <button className="press h-12 w-full rounded-btn border border-line-strong bg-surface text-body font-bold text-ink">로그아웃</button>
          </form>
        )}
        {v.kind === "user" && (
          <Link href="/me/withdraw" className="press mx-auto inline-flex h-11 items-center px-2 text-sub font-semibold text-ink-sub underline underline-offset-4">탈퇴하기</Link>
        )}
      </div>
      <MainTabs active="설정" />
    </AppShell>
  );
}
