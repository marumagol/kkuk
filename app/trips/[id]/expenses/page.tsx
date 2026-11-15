/* 준비 탭 > 경비와 정산 (6단계 3번). 보기만인 사람은 보기만 */
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Icon } from "@/components/kit";
import { AppShell } from "@/components/screen";
import { ExpensesPanel } from "@/components/expenses-panel";
import { getViewer } from "@/lib/viewer";
import { loadExpenses } from "@/lib/trips";
import { md } from "@/lib/mock";

export const metadata = { title: "경비와 정산" };

export default async function Expenses({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getViewer();
  if (viewer.kind === "guest") redirect(`/login?next=/trips/${id}/expenses`);
  if (viewer.kind === "preview") redirect(`/trips/${id}`);
  const view = await loadExpenses(viewer, id);
  if (!view) notFound();
  return (
    <AppShell>
      <div className="flex items-center gap-2 px-5 pt-4">
        <Link href={`/trips/${id}/prep`} aria-label="준비로" className="press flex size-11 items-center justify-center rounded-full bg-surface text-ink"><Icon name="back" size={20} /></Link>
        <div className="min-w-0">
          <h1 className="text-title-lg font-extrabold text-ink">경비와 정산</h1>
          <p className="truncate text-tiny text-ink-sub">{view.tripTitle}, {md(view.start)} ~ {md(view.end)}</p>
        </div>
      </div>
      <ExpensesPanel view={view} />
    </AppShell>
  );
}
