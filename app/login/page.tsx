/* S02 로그인. 카카오, 구글 로그인만 (2026-11-18 이메일 코드 로그인 뺌) */
import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseEnv } from "@/lib/supabase/env";
import { getViewer, isAnon, isIn, safeNext } from "@/lib/viewer";
import { GUEST_NOTE } from "@/lib/guest";
import { startPreview } from "@/app/actions";
import { AppShell, Logo } from "@/components/screen";
import { LoginForm } from "./login-form";

export const metadata = { title: "로그인" };

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  const v = await getViewer();
  // 손님 계정은 로그인 화면을 본다 : 로그인하면 지금 계정에 카카오/구글을 이어 붙여 기록이 그대로 남는다 (0.107.0)
  const anon = isAnon(v);
  if (isIn(v) && !anon) redirect(next);
  const configured = !!supabaseEnv();
  const err = sp.error;

  return (
    <AppShell bottomGap={false}>
      <div className="flex flex-1 flex-col px-5 pb-8 pt-10">
        {/* 둘러보기 버튼은 뺐다 (2026-11-26 마루님) */}
        <div className="flex h-11 items-center">
          <Logo />
        </div>
        <h1 className="mt-8 text-title-xl font-extrabold text-ink">{anon ? "로그인하고 기록 지키기" : "트립추얼 시작해요"}</h1>
        <p className="mt-2 text-sub text-ink-sub">{anon ? "로그인하면 지금까지 만든 여행과 카드가 그대로 이어지고, 초대와 공유도 쓸 수 있어요" : "카카오나 구글 계정으로 바로 시작해요"}</p>

        <div className="mt-8">
          <LoginForm next={next} configured={configured} anon={anon} taken={err === "taken_kakao" ? "kakao" : err === "taken_google" ? "google" : undefined}
            failed={err === "kakao" || err === "google" ? err : err === "guest" ? "guest" : err && !err.startsWith("taken") ? "any" : undefined} />
        </div>
        {anon && <p className="mt-4 text-tiny text-ink-sub">이미 트립추얼 계정이 있다면 그 계정으로 들어가고, 지금 손님으로 만든 기록은 사라져요</p>}
        {!anon && configured && <p className="mt-4 text-tiny text-ink-sub">{GUEST_NOTE}</p>}
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
