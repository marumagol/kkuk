"use client";
/*
  프로필 사진 자르기 (2026-11-16 마루님 "원하는 방식으로 크롭")
  - 사진을 고르면 원형 틀이 있는 창이 뜬다. 한 손가락으로 끌어 위치, 두 손가락이나 아래 막대로 확대 (컴퓨터는 휠도)
  - 틀 안이 늘 사진으로 채워지게 움직임을 막는다. [완료] 하면 정사각형 512px JPEG 로 잘라 돌려준다
  - 라이브러리 없이 pointer 이벤트로 만든다
*/
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/kit";

const OUT = 512, MAX_ZOOM = 4;

export function AvatarCropper({ file, onCancel, onDone }: { file: File; onCancel: () => void; onDone: (b: Blob) => void }) {
  const [url] = useState(() => URL.createObjectURL(file));
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const [view, setView] = useState({ zoom: 1, x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const img = useRef<HTMLImageElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [V, setV] = useState(300); // 틀 한 변(px)
  const pts = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ d: number; zoom: number } | null>(null);

  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  useEffect(() => {
    const fit = () => setV(Math.min(320, Math.floor(innerWidth - 48)));
    fit(); addEventListener("resize", fit);
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden"; // 뒤 화면이 같이 스크롤되지 않게
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); }; // 컴퓨터 : Esc 로 닫기
    addEventListener("keydown", esc);
    return () => { removeEventListener("resize", fit); removeEventListener("keydown", esc); document.body.style.overflow = prev; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const base = nat ? V / Math.min(nat.w, nat.h) : 1; // 확대 1 = 틀을 꽉 채우는 크기
  const clamp = (v: { zoom: number; x: number; y: number }) => {
    if (!nat) return v;
    const zoom = Math.min(MAX_ZOOM, Math.max(1, v.zoom));
    const s = base * zoom, mx = Math.max(0, (nat.w * s - V) / 2), my = Math.max(0, (nat.h * s - V) / 2);
    return { zoom, x: Math.min(mx, Math.max(-mx, v.x)), y: Math.min(my, Math.max(-my, v.y)) };
  };
  const update = (f: (v: typeof view) => typeof view) => setView((v) => clamp(f(v)));

  const down = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.current.size === 2) { const [a, b] = [...pts.current.values()]; pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), zoom: view.zoom }; }
  };
  const move = (e: React.PointerEvent) => {
    const prev = pts.current.get(e.pointerId);
    if (!prev) return;
    const cur = { x: e.clientX, y: e.clientY };
    pts.current.set(e.pointerId, cur);
    if (pts.current.size >= 2 && pinch.current) {
      const [a, b] = [...pts.current.values()];
      const z = pinch.current.zoom * (Math.hypot(a.x - b.x, a.y - b.y) / (pinch.current.d || 1));
      update((v) => ({ ...v, zoom: z, x: (cur.x - prev.x) / 2 + v.x, y: (cur.y - prev.y) / 2 + v.y }));
    } else update((v) => ({ ...v, x: v.x + cur.x - prev.x, y: v.y + cur.y - prev.y }));
  };
  const up = (e: React.PointerEvent) => { pts.current.delete(e.pointerId); if (pts.current.size < 2) pinch.current = null; };

  // 휠 확대 (컴퓨터). passive 로 막히지 않게 직접 붙인다
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => { e.preventDefault(); setView((v) => clamp({ ...v, zoom: v.zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08) })); };
    // 아이폰 : 두 손가락 확대가 화면 전체 확대로 넘어가지 않게, 터치 기본 동작을 막는다
    const stop = (e: Event) => e.preventDefault();
    el.addEventListener("wheel", wheel, { passive: false });
    el.addEventListener("touchmove", stop, { passive: false });
    el.addEventListener("gesturestart", stop);
    return () => { el.removeEventListener("wheel", wheel); el.removeEventListener("touchmove", stop); el.removeEventListener("gesturestart", stop); };
  });

  const done = async () => {
    if (!nat || !img.current) return;
    setBusy(true);
    const s = base * view.zoom, side = V / s;
    const sx = nat.w / 2 - view.x / s - side / 2, sy = nat.h / 2 - view.y / s - side / 2;
    const c = document.createElement("canvas");
    c.width = c.height = OUT;
    const ctx = c.getContext("2d");
    if (!ctx) { setBusy(false); return; }
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img.current, sx, sy, side, side, 0, 0, OUT, OUT);
    c.toBlob((b) => { setBusy(false); if (b) onDone(b); else setFailed(true); }, "image/jpeg", 0.88);
  };

  const s = base * view.zoom;
  // 화면 맨 위(body)에 띄운다 : 부모 카드의 겹침 순서나 변형에 갇혀 안 보이는 일을 막는다
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="프로필 사진 자르기" className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-black/85 px-6">
      <p className="text-sub font-semibold text-white/90">끌어서 위치를, 두 손가락으로 크기를 맞춰 주세요</p>
      <div ref={stage} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        className="relative touch-none select-none overflow-hidden rounded-card bg-black" style={{ width: V, height: V }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img ref={img} src={url} alt="" draggable={false} onError={() => setFailed(true)}
          onLoad={(e) => { const t = e.currentTarget; setNat({ w: t.naturalWidth, h: t.naturalHeight }); setView({ zoom: 1, x: 0, y: 0 }); }}
          className="pointer-events-none absolute left-1/2 top-1/2 max-w-none origin-center"
          style={nat ? { width: nat.w * s, height: nat.h * s, transform: `translate(calc(-50% + ${view.x}px), calc(-50% + ${view.y}px))` } : { opacity: 0 }} />
        <div aria-hidden className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_0_9999px_rgb(0_0_0/0.55)] ring-2 ring-white/80" />
      </div>
      <label className="flex w-full max-w-[320px] items-center gap-3 text-tiny font-bold text-white/80">
        <span className="flex-none">작게</span>
        <input type="range" min={1} max={MAX_ZOOM} step={0.01} value={view.zoom} disabled={!nat}
          onChange={(e) => { const z = Number(e.target.value); update((v) => ({ ...v, zoom: z })); }}
          aria-label="확대" className="min-w-0 flex-1 accent-[var(--point)]" />
        <span className="flex-none">크게</span>
      </label>
      {failed && <p role="alert" className="text-center text-sub font-semibold text-white">이 파일은 열 수 없어요. JPG나 PNG 사진을 골라 주세요{/\.(heic|heif)$/i.test(file.name) ? " (HEIC 사진은 이 브라우저에서 열리지 않아요)" : ""}</p>}
      <div className="flex w-full max-w-[320px] gap-2">
        <Button variant="secondary" onClick={onCancel} disabled={busy} className="flex-1">취소</Button>
        <Button onClick={done} disabled={!nat || busy || failed} className="flex-1">{busy ? "자르는 중" : "완료"}</Button>
      </div>
    </div>,
    document.body,
  );
}
