/* S04 표시 이름 정하기 : 처음 로그인 직후 한 번. 이름을 정하기 전에는 app/layout.tsx 가 여기로 보낸다 */
import { redirect } from "next/navigation";
import { getViewer, safeNext } from "@/lib/viewer";
import { signOut } from "@/app/actions";
import { AppShell, Logo } from "@/components/screen";
import { NameForm } from "@/components/name-form";

export const metadata = { title: "이름 정하기" };

export default async function Welcome({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  const v = await getViewer();
  if (v.kind !== "user") redirect(`/login?next=${encodeURIComponent(next)}`);
  if (v.name) redirect(next);

  return (
    <AppShell bottomGap={false}>
      <div className="flex flex-1 flex-col px-5 pb-8 pt-10">
        <Logo />
        <h1 className="mt-8 text-title-xl font-extrabold text-ink">어떻게 불러 드릴까요?</h1>
        <p className="mt-2 text-sub text-ink-sub">앱에서 쓸 이름을 정해 주세요. 나중에 설정에서 바꿀 수 있어요</p>
        <div className="mt-8"><NameForm next={next} submitLabel="시작하기" /></div>
        <form action={signOut} className="mt-6 flex justify-center">
          <button className="press h-11 px-1 text-sub font-semibold text-ink-sub underline underline-offset-4">다른 이메일로 로그인</button>
        </form>
        <p className="mt-2 text-center text-tiny text-ink-sub">{v.email}</p>
      </div>
    </AppShell>
  );
}
