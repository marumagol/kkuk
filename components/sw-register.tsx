"use client";
/* 오프라인 보기용 서비스 워커 등록 (3단계 10). 배포 화면에서만.
   앱 설치 신호(beforeinstallprompt)는 일찍 오니 여기서 받아 두고, 설정의 [앱 설치] 가 꺼내 쓴다 (2026-11-17) */
import { useEffect } from "react";

export function SwRegister() {
  useEffect(() => {
    const keep = (e: Event) => { e.preventDefault(); (window as { __kkukInstall?: Event }).__kkukInstall = e; window.dispatchEvent(new Event("kkuk-install-ready")); };
    addEventListener("beforeinstallprompt", keep);
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    return () => removeEventListener("beforeinstallprompt", keep);
  }, []);
  return null;
}
