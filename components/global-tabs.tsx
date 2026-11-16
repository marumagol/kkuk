"use client";
/*
  아래 탭바를 모든 화면에 (2026-11-15 마루님 "다른 메뉴 들어가도 계속 떠 있도록")
  - 여행 상세, 준비, 기록, 도장, 알림 같은 안쪽 화면에서도 보인다. 지금 어느 갈래인지 주소로 정한다
  - 숨기는 화면 : 로그인/처음 이름, 초대·공유 링크(로그인 없이 보는 곳), 무언가를 적는 화면(장소, 여행 만들기·수정, 이름 바꾸기),
    인쇄용 여행 한 권, 개발용 화면
*/
import { usePathname } from "next/navigation";
import { TabBar } from "@/components/kit";

const HIDE = [
  /^\/(login|welcome|invite|s|j|dev|privacy|terms)(\/|$)/,
  /^\/trips\/new/, /^\/trips\/[^/]+\/(edit|places|book|share|members|bookings)(\/|$)/,
  /^\/me\/(name|withdraw)/,
];

export function GlobalTabs() {
  const path = usePathname() ?? "/";
  if (HIDE.some((r) => r.test(path))) return null;
  const active = path.startsWith("/stamps") ? "도장" : path.startsWith("/trips") ? "여행" : path.startsWith("/me") ? "설정" : "홈";
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 mx-auto flex w-full max-w-[560px] justify-center px-5 pb-[max(20px,env(safe-area-inset-bottom))] in-data-editing:hidden">
      <div className="pointer-events-auto"><TabBar active={active} /></div>
    </div>
  );
}
