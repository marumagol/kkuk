/* 마이 > 이름 바꾸기 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { Icon } from "@/components/kit";
import { AppShell } from "@/components/screen";
import { getViewer } from "@/lib/viewer";
import { NameForm } from "@/components/name-form";

export const metadata = { title: "이름 수정" };

export default async function MyName() {
  const v = await getViewer();
  if (v.kind !== "user") redirect("/login?next=/me/name");
  return (
    <AppShell bottomGap={false}>
      <div className="flex items-center gap-2 px-5 pt-4">
        <Link href="/me" aria-label="설정으로" className="press flex size-11 items-center justify-center rounded-full bg-surface text-ink">
          <Icon name="back" size={20} />
        </Link>
        <h1 className="text-title-lg font-extrabold text-ink">이름 수정</h1>
      </div>
      <div className="px-5 pt-6"><NameForm next="/me" initial={v.name ?? ""} submitLabel="저장" /></div>
    </AppShell>
  );
}
