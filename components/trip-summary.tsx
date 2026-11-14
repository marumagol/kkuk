/* 여행 요약 숫자 (3단계 8) : 다녀온 여행 머리와 회고 쓰기 위 */
import type { TripSummary } from "@/lib/trips";

export function TripSummaryRow({ s, className = "" }: { s: TripSummary; className?: string }) {
  const cells = [["함께한 날", `${s.days}일`], ["장소", `${s.places}곳`], ["남긴 사진", `${s.photos}장`], ["새 도장", `${s.stamps}개`]];
  return (
    <dl className={"grid grid-cols-4 gap-1 rounded-card bg-surface px-2 py-3 text-center " + className} aria-label="여행 요약">
      {cells.map(([k, v]) => (
        <div key={k} className="flex flex-col gap-0.5">
          <dt className="text-tiny text-ink-sub">{k}</dt>
          <dd className="text-body font-extrabold text-ink">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
