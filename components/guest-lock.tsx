/* 손님 계정(로그인 없이 쓰는 중, 0.107.0)에게 막힌 기능 안내 : 초대, 공유. 로그인하면 기록은 그대로 이어진다 */
import Link from "next/link";

export function GuestLock({ title, next, className = "mx-5 mt-5" }: { title: string; next: string; className?: string }) {
  return (
    <section className={className + " flex flex-col items-center gap-3 rounded-card bg-surface px-6 py-8 text-center"}>
      <h2 className="text-title font-bold text-ink">{title}</h2>
      <p className="text-sub text-ink-sub">지금은 로그인 없이 쓰는 중이에요. 로그인해도 지금까지 만든 여행과 카드는 그대로 남아요</p>
      <Link href={`/login?next=${encodeURIComponent(next)}`} className="press inline-flex h-12 items-center rounded-btn bg-btn px-5 text-body font-bold text-on-btn">로그인하기</Link>
    </section>
  );
}

/* 잃기 아까운 순간(첫 카드)에 띄우는 로그인 권유 */
export function GuestKeep({ next, className = "" }: { next: string; className?: string }) {
  return (
    <div className={className + " flex items-center gap-3 rounded-card border border-line bg-surface px-4 py-3"}>
      <p className="min-w-0 flex-1 text-sub text-ink"><b>카드를 지키려면 로그인해 주세요</b><br /><span className="text-tiny text-ink-sub">로그인 전에는 기록이 사라질 수 있어요</span></p>
      <Link href={`/login?next=${encodeURIComponent(next)}`} className="press inline-flex h-11 shrink-0 items-center rounded-btn bg-btn px-4 text-sub font-bold text-on-btn">로그인</Link>
    </div>
  );
}
