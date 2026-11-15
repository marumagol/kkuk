/* S02 로그인 + S03 코드 입력. 1단계는 이메일 로그인 코드만 (Google 은 나중에, 2026-11-14 마루님 결정) */
import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseEnv } from "@/lib/supabase/env";
import { getViewer, isIn, safeNext } from "@/lib/viewer";
import { startPreview } from "@/app/actions";
import { AppShell, Logo } from "@/components/screen";
import { LoginForm } from "./login-form";

export const metadata = { title: "로그인" };

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  if (isIn(await getViewer())) redirect(next);
  const configured = !!supabaseEnv();

  return (
    <AppShell bottomGap={false}>
      <div className="flex flex-1 flex-col px-5 pb-8 pt-10">
        <div className="flex items-center justify-between">
          <Logo />
          <Link href={next} className="press inline-flex h-11 items-center px-1 text-sub font-semibold text-ink-sub underline underline-offset-4">둘러보기</Link>
        </div>
        <h1 className="mt-8 text-title-xl font-extrabold text-ink">이메일로<br />시작해요</h1>
        <p className="mt-2 text-sub text-ink-sub">메일로 받은 6자리 코드를 넣으면 로그인돼요. 비밀번호는 없어요</p>

        <div className="mt-8">
          <LoginForm next={next} configured={configured} />
        </div>
        <p className="mt-4 text-tiny text-ink-sub">
          시작하면 <Link href="/terms" className="font-semibold underline underline-offset-2">이용약관</Link>과{" "}
          <Link href="/privacy" className="font-semibold underline underline-offset-2">개인정보 처리방침</Link>에 동의하는 것으로 봐요
        </p>

        {!configured && (
          <section className="mt-8 flex flex-col gap-3 rounded-card bg-surface p-5">
            <h2 className="text-body font-bold text-ink">아직 로그인 서버(Supabase)가 연결되지 않았어요</h2>
            <p className="text-sub text-ink-sub">연결 전에는 화면만 확인할 수 있어요. 아래 버튼을 누르면 로그인한 것처럼 가짜 여행이 보여요</p>
            <form action={startPreview}>
              <input type="hidden" name="next" value={next} />
              <button className="press h-12 w-full rounded-btn border border-line-strong bg-surface text-body font-bold text-ink">로그인한 것처럼 보기</button>
            </form>
          </section>
        )}
      </div>
    </AppShell>
  );
}
