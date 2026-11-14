/* 마이 > 업데이트 내역. 내용은 lib/changelog.ts */
import Link from "next/link";
import { Icon } from "@/components/kit";
import { AppShell } from "@/components/screen";
import { CHANGELOG, formatAt } from "@/lib/changelog";

export const metadata = { title: "업데이트 내역" };

export default function Updates() {
  return (
    <AppShell bottomGap={false}>
      <div className="flex items-center gap-2 px-5 pt-4">
        <Link href="/me" aria-label="설정으로" className="press flex size-11 items-center justify-center rounded-full bg-surface text-ink">
          <Icon name="back" size={20} />
        </Link>
        <h1 className="text-title-lg font-extrabold text-ink">업데이트 내역</h1>
      </div>
      <ol className="flex flex-col gap-3 px-5 pb-10 pt-5">
        {CHANGELOG.map((u, i) => (
          <li key={u.at} className="rounded-card bg-surface p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sub font-bold text-ink">
                <time dateTime={u.at.replace(" ", "T") + "+09:00"}>{formatAt(u.at)}</time>
              </h2>
              {i === 0
                ? <span className="flex-none rounded-full bg-point-soft px-2 py-0.5 text-tiny font-bold text-point-text">최신</span>
                : <span className="flex-none text-tiny text-ink-sub">버전 {u.version}</span>}
            </div>
            <ul className="mt-3 flex list-disc flex-col gap-1.5 pl-5 text-body text-ink marker:text-ink-sub">
              {u.items.map((t) => <li key={t}>{t}</li>)}
            </ul>
          </li>
        ))}
      </ol>
    </AppShell>
  );
}
