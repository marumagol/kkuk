/* 여행 요약 숫자 (3단계 8) : 기록 탭, 회고 쓰기, 여행 한 권. 어두운 카드 (참고 화면 "기록", 2026-11-15 : 8일 / 꽂은 핀 / 남긴 사진 / 새 도장) */
import type { TripSummary } from "@/lib/trips";
import { Icon } from "@/components/kit";

export function TripSummaryRow({ s, className = "" }: { s: TripSummary; className?: string }) {
  const cells: [string, string, string, boolean][] = [
    ["함께한 시간", String(s.days), "일", false], ["꽂은 핀", String(s.places), "", true],
    ["남긴 사진", String(s.photos), "", false], ["새 도장", String(s.stamps), "", false],
  ];
  return (
    <dl className={"grid grid-cols-4 gap-2 rounded-card bg-deep px-5 py-4 text-on-deep " + className} aria-label="여행 요약">
      {cells.map(([k, v, u, hi]) => (
        <div key={k} className="flex min-w-0 flex-col-reverse gap-0.5">
          <dt className="truncate text-tiny text-on-deep-sub">{k}</dt>
          <dd className={"text-[22px] font-extrabold leading-tight tabular-nums " + (hi ? "text-[#FF6A45]" : "")}>{v}{u}</dd>
        </div>
      ))}
    </dl>
  );
}

/* 사진 묶음 : 큰 사진 1장 + 작은 사진 2장, 남은 수는 "+4" (디자인 가이드 2장 시그니처) */
export function PhotoStack({ urls, label, aspect = "aspect-[3/2]" }: { urls: string[]; label?: string; aspect?: string }) {
  if (!urls.length) return null;
  const rest = urls.length - 3;
  const img = (u: string, cls: string) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={u} alt="" loading="lazy" className={"size-full object-cover " + cls} />
  );
  if (urls.length < 3) return (
    <div className={"grid gap-1.5 " + (urls.length === 2 ? "grid-cols-2" : "")}>
      {urls.map((u) => <div key={u} className="relative aspect-[4/3] overflow-hidden rounded-field">{img(u, "")}{label && urls[0] === u && <Tag text={label} />}</div>)}
    </div>
  );
  return (
    <div className={"grid grid-cols-[2fr_1fr] grid-rows-2 gap-1.5 " + aspect}>
      <div className="relative row-span-2 overflow-hidden rounded-field">{img(urls[0], "")}{label && <Tag text={label} />}</div>
      <div className="overflow-hidden rounded-field">{img(urls[1], "")}</div>
      <div className="relative overflow-hidden rounded-field">
        {img(urls[2], "")}
        {rest > 0 && <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-title font-extrabold text-white">+{rest}</span>}
      </div>
    </div>
  );
}
function Tag({ text }: { text: string }) {
  return <span className="absolute bottom-2.5 left-2.5 inline-flex h-8 max-w-[85%] items-center gap-1 rounded-full bg-surface pl-2 pr-3 text-tiny font-bold text-ink"><Icon name="pin" size={14} className="flex-none text-point" /><span className="truncate">{text}</span></span>;
}
