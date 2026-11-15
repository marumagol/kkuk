/* 이용약관, 개인정보 처리방침 공통 화면 (5단계 2번). 내용은 lib/legal.ts */
import Link from "next/link";
import { Icon } from "@/components/kit";
import { AppShell } from "@/components/screen";
import type { LegalDoc } from "@/lib/legal";

export function LegalPage({ doc }: { doc: LegalDoc }) {
  return (
    <AppShell bottomGap={false}>
      <div className="flex items-center gap-2 px-5 pt-4">
        <Link href="/me" aria-label="설정으로" className="press flex size-11 items-center justify-center rounded-full bg-surface text-ink">
          <Icon name="back" size={20} />
        </Link>
        <h1 className="text-title-lg font-extrabold text-ink">{doc.title}</h1>
      </div>
      <div className="flex flex-col gap-3 px-5 pb-10 pt-5">
        <p className="rounded-card bg-point-soft p-4 text-sub text-point-text">{doc.notice}</p>
        {doc.sections.map((s) => (
          <section key={s.h} className="rounded-card bg-surface p-5">
            <h2 className="text-body font-bold text-ink">{s.h}</h2>
            <ul className="mt-3 flex list-disc flex-col gap-1.5 pl-5 text-sub text-ink marker:text-ink-sub">
              {s.items.map((t) => <li key={t}>{t}</li>)}
            </ul>
          </section>
        ))}
        <p className="px-1 text-tiny text-ink-sub">시행일 {doc.effective}</p>
      </div>
    </AppShell>
  );
}
