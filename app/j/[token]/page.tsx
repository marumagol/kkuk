/* 링크로 공개한 일기 (3단계 7) : 로그인 없이 읽기. 검색에는 나오지 않게 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell, Logo } from "@/components/screen";
import { loadPublicEntry } from "@/lib/trips";
import { addDays, md } from "@/lib/mock";
import { PublicActions } from "@/components/entry-actions";

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const e = await loadPublicEntry((await params).token);
  if (!e) return { title: "일기", robots: { index: false, follow: false } };
  const title = e.title ?? `${e.tripTitle} 일기`;
  return {
    title, robots: { index: false, follow: false },
    openGraph: { title, description: e.body.slice(0, 80) || `${e.author}님의 여행 일기`, images: e.photos[0] ? [e.photos[0]] : undefined },
  };
}

export default async function PublicEntryPage({ params }: Props) {
  const e = await loadPublicEntry((await params).token);
  if (!e) notFound();
  const slot = e.kind === "recap" ? "여행 회고" : `${e.dayIndex! + 1}일차 · ${md(addDays(e.start, e.dayIndex!))}`;
  return (
    <AppShell bottomGap={false}>
      <div className="flex items-center justify-between px-5 pt-4">
        <Link href="/" aria-label="KKuK 처음으로" className="press flex h-11 items-center"><Logo /></Link>
      </div>
      <article className="flex flex-col gap-4 px-5 pb-10 pt-4">
        <div>
          <p className="text-sub font-semibold text-point-text">{e.tripTitle} · {slot}</p>
          {e.title && <h1 className="mt-1 text-title-xl font-extrabold text-ink">{e.title}</h1>}
          <p className="mt-1 text-tiny text-ink-sub">{e.author}님의 일기</p>
        </div>
        {e.photos.length > 0 && (
          <div className="-mx-5 flex snap-x gap-2 overflow-x-auto px-5">
            {e.photos.map((url, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={url} alt={`사진 ${i + 1}`} className="h-64 w-auto max-w-[85%] flex-none snap-center rounded-card object-cover" />
            ))}
          </div>
        )}
        <PublicActions likes={e.likes} />
        {e.body && <p className="whitespace-pre-wrap text-body leading-relaxed text-ink">{e.body}</p>}
        <div className="mt-4 flex flex-col items-center gap-2 rounded-card bg-surface px-4 py-5 text-center">
          <p className="text-sub text-ink">KKuK 에서 여행을 계획하고 일기를 남겨요</p>
          <Link href="/" className="press flex h-11 items-center rounded-full bg-btn px-5 text-sub font-bold text-on-btn">KKuK 둘러보기</Link>
        </div>
      </article>
    </AppShell>
  );
}
