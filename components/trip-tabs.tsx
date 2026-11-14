/* 여행 안 탭 : 일정 / 준비 (2단계). 일기는 하단 탭으로 따로 (2026-11-14 결정) */
import Link from "next/link";

export function TripTabs({ tripId, active }: { tripId: string; active: "일정" | "준비" }) {
  const tabs = [{ name: "일정", href: `/trips/${tripId}` }, { name: "준비", href: `/trips/${tripId}/prep` }] as const;
  return (
    <nav aria-label="여행 안 메뉴" className="mx-5 mt-4 flex border-b border-line">
      {tabs.map((t) => (
        <Link key={t.name} href={t.href} replace aria-current={active === t.name ? "page" : undefined}
          className={"press -mb-px flex h-11 flex-1 items-center justify-center border-b-2 text-body " +
            (active === t.name ? "border-ink font-bold text-ink" : "border-transparent font-semibold text-ink-sub")}>
          {t.name}
        </Link>
      ))}
    </nav>
  );
}
