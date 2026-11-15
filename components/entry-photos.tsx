"use client";
/* 일기 사진 넘기기 : 4:5 둥근 사진, 왼쪽 위 일차 표, 오른쪽 위 "2 / 4", 아래 점 */
import { useRef, useState } from "react";

export function EntryPhotos({ urls, slot }: { urls: string[]; slot: string }) {
  const [i, setI] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const onScroll = () => { const b = box.current; if (b) setI(Math.round(b.scrollLeft / Math.max(1, b.clientWidth))); };
  return (
    <div className="relative overflow-hidden rounded-[18px] bg-surface-soft">
      <div ref={box} onScroll={onScroll} className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {urls.map((u, k) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={k} src={u} alt={`사진 ${k + 1}`} loading={k ? "lazy" : undefined} className="aspect-[4/5] w-full flex-none snap-center object-cover" />
        ))}
      </div>
      <span className="pointer-events-none absolute left-2.5 top-2.5 inline-flex h-7 items-center rounded-full bg-surface px-2.5 text-tiny font-bold text-ink">{slot}</span>
      {urls.length > 1 && (
        <>
          <span className="pointer-events-none absolute right-2.5 top-2.5 inline-flex h-7 items-center rounded-full bg-scrim px-2.5 text-tiny font-bold text-on-deep">{i + 1} / {urls.length}</span>
          <span className="pointer-events-none absolute inset-x-0 bottom-2.5 flex justify-center gap-1.5" aria-hidden>
            {urls.map((_, k) => <span key={k} className={`size-1.5 rounded-full bg-on-deep ${k === i ? "" : "opacity-50"}`} />)}
          </span>
        </>
      )}
    </div>
  );
}
