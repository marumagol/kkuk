"use client";
/*
  여행 통째로 오프라인 저장 (2026-11-16 마루님 "③-5 오프라인 보기")
  - 다가오는 여행, 여행 중인 여행을 열면 그 여행의 일정(날마다), 준비 화면을 서비스 워커가 미리 받아 둔다 (public/sw.js save-pages)
  - 30분에 한 번만. 인터넷이 끊겨도 열어 보지 않은 날까지 볼 수 있다
  - 화면에는 아무것도 보이지 않는다 (2026-11-16 마루님 "문구 노출 안 해도 돼")
*/
import { useEffect } from "react";

export function OfflineSaver({ tripId, days }: { tripId: string; days: number }) {
  useEffect(() => {
    const key = `kkuk-offline:${tripId}`;
    let last = 0;
    try { last = Number(localStorage.getItem(key)) || 0; } catch {}
    if (!navigator.onLine || !("serviceWorker" in navigator) || Date.now() - last < 30 * 60e3) return;
    const urls = [`/trips/${tripId}`, ...Array.from({ length: days }, (_, i) => `/trips/${tripId}?day=${i + 1}`), `/trips/${tripId}/prep`, `/trips/${tripId}/expenses`];
    let done = false;
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type !== "pages-saved" || done) return;
      done = true;
      try { localStorage.setItem(key, String(Date.now())); } catch {}
    };
    navigator.serviceWorker.addEventListener("message", onMsg);
    navigator.serviceWorker.ready.then((reg) => reg.active?.postMessage({ type: "save-pages", urls })).catch(() => {});
    return () => navigator.serviceWorker.removeEventListener("message", onMsg);
  }, [tripId, days]);
  return null;
}
