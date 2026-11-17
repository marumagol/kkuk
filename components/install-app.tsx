"use client";
/*
  설정 > 앱으로 설치 (2026-11-17 마루님 "브라우저에서 앱으로 받을 수 있게") : 홈 화면에 앱처럼 설치 (PWA, app/manifest.ts)
  - 크롬, 삼성 인터넷, 엣지 : [앱 설치] 를 누르면 브라우저 설치 창
  - iPhone Safari : 버튼이 없어 공유 → 홈 화면에 추가 안내
  - 이미 설치한 앱으로 열었으면 그렇다고만
*/
import { useEffect, useState } from "react";

type Prompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
type State = "loading" | "installed" | "ready" | "ios" | "manual";

export function InstallApp() {
  const [state, setState] = useState<State>("loading");
  useEffect(() => {
    const standalone = matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone;
    if (standalone) return setState("installed");
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const has = () => !!(window as { __kkukInstall?: Event }).__kkukInstall;
    setState(has() ? "ready" : ios ? "ios" : "manual");
    const ready = () => setState("ready");
    const done = () => { (window as { __kkukInstall?: Event }).__kkukInstall = undefined; setState("installed"); };
    addEventListener("kkuk-install-ready", ready);
    addEventListener("appinstalled", done);
    return () => { removeEventListener("kkuk-install-ready", ready); removeEventListener("appinstalled", done); };
  }, []);
  const install = async () => {
    const w = window as { __kkukInstall?: Prompt };
    const p = w.__kkukInstall;
    if (!p) return setState("manual");
    await p.prompt();
    const r = await p.userChoice.catch(() => null);
    w.__kkukInstall = undefined;
    setState(r?.outcome === "accepted" ? "installed" : "manual");
  };
  if (state === "loading") return null;
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <h3 className="text-body font-bold text-ink">앱으로 설치</h3>
        <p className="mt-0.5 text-tiny text-ink-sub">
          {state === "installed" ? "지금 설치한 앱으로 쓰고 있어요"
            : state === "ready" ? "홈 화면에 KKuK 아이콘이 생기고, 주소창 없이 앱처럼 열려요"
            : state === "ios" ? "Safari 아래 공유 버튼을 누르고 [홈 화면에 추가]를 골라 주세요"
            : "브라우저 메뉴(⋮)에서 [앱 설치] 또는 [홈 화면에 추가]를 골라 주세요"}
        </p>
      </div>
      {state === "ready" && (
        <button type="button" onClick={install} className="press h-9 flex-none rounded-full bg-btn px-4 text-sub font-bold text-on-btn">앱 설치</button>
      )}
    </div>
  );
}
