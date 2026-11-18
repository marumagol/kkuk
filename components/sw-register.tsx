"use client";
/* 오프라인 보기용 서비스 워커 등록 (3단계 10). 배포 화면에서만.
   설정의 [앱으로 설치]는 2026-11-18 마루님 "필요 없어"로 뺐다. 설치 신호(beforeinstallprompt)도 붙잡지 않고 브라우저 기본 안내에 맡긴다 */
import { useEffect } from "react";
export function SwRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
