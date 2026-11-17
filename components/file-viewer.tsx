"use client";
/*
  첨부 미리보기 (2026-11-17 마루님 "첨부된 사진, pdf는 미리보기가 필요") : 화면 전체에 크게.
  사진은 꽉 차게, PDF 는 앱 안에서 바로 연다(브라우저가 못 그리면 [새 탭에서 열기]). 좌우 버튼이나 밀어서 넘기기, Esc 로 닫기
*/
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/kit";

export type ViewFile = { url: string; pdf: boolean };
export const isPdf = (path: string) => path.toLowerCase().endsWith(".pdf");

export function FileViewer({ files, start, onClose }: { files: ViewFile[]; start: number; onClose: () => void }) {
  const [i, setI] = useState(start);
  const touch = useRef<number | null>(null);
  const n = files.length;
  const go = (d: number) => setI((v) => (v + d + n) % n);
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); else if (e.key === "ArrowLeft") go(-1); else if (e.key === "ArrowRight") go(1); };
    addEventListener("keydown", key);
    const o = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { removeEventListener("keydown", key); document.body.style.overflow = o; };
  }, [onClose]); // eslint-disable-line react-hooks/exhaustive-deps
  const f = files[i];
  if (!f || typeof document === "undefined") return null;
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="첨부 미리보기" className="fixed inset-0 z-[60] flex flex-col bg-black/95 text-white"
      onTouchStart={(e) => { touch.current = e.touches[0]?.clientX ?? null; }}
      onTouchEnd={(e) => { const s = touch.current, x = e.changedTouches[0]?.clientX; touch.current = null; if (s != null && x != null && n > 1 && !f.pdf && Math.abs(x - s) > 60) go(x < s ? 1 : -1); }}>
      <div className="flex items-center justify-between gap-2 px-3 pb-2 pt-[max(10px,env(safe-area-inset-top))]">
        <span className="px-2 text-sub font-semibold tabular-nums text-white/80">{n > 1 ? `${i + 1} / ${n}` : ""}</span>
        <span className="flex items-center gap-1">
          {f.pdf && <a href={f.url} target="_blank" rel="noopener noreferrer" className="press inline-flex h-10 items-center rounded-full bg-white/15 px-3.5 text-sub font-semibold">새 탭에서 열기</a>}
          <button type="button" onClick={onClose} aria-label="닫기" className="press flex size-11 items-center justify-center rounded-full"><Icon name="x" size={22} /></button>
        </span>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 pb-[max(12px,env(safe-area-inset-bottom))]" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        {f.pdf
          ? <iframe key={f.url} src={f.url} title={`PDF ${i + 1}`} className="size-full rounded-field bg-white" />
          // eslint-disable-next-line @next/next/no-img-element
          : <img key={f.url} src={f.url} alt={`첨부 ${i + 1}`} className="max-h-full max-w-full select-none object-contain" />}
        {n > 1 && <>
          <button type="button" onClick={() => go(-1)} aria-label="이전" className="press absolute left-2 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/50"><Icon name="back" size={20} /></button>
          <button type="button" onClick={() => go(1)} aria-label="다음" className="press absolute right-2 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/50"><Icon name="right" size={20} /></button>
        </>}
      </div>
    </div>,
    document.body,
  );
}
