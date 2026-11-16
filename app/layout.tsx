import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { GateProvider } from "@/components/gate";
import { GlobalTabs } from "@/components/global-tabs";
import { TripEntryMemo } from "@/components/trip-back";
import { NetworkBanner } from "@/components/network-banner";
import { SwRegister } from "@/components/sw-register";
import { headers, cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getViewer, isIn, PATH_HEADER } from "@/lib/viewer";
import { BRAND } from "@/components/screen";

// 페이퍼로지 : 쓰는 굵기 4개만 (가이드 4장). 늦게 와도 글자가 먼저 보이게 swap
const paperlogy = localFont({
  src: [
    { path: "./fonts/Paperlogy-4Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/Paperlogy-6SemiBold.woff2", weight: "600", style: "normal" },
    { path: "./fonts/Paperlogy-7Bold.woff2", weight: "700", style: "normal" },
    { path: "./fonts/Paperlogy-8ExtraBold.woff2", weight: "800", style: "normal" },
  ],
  variable: "--font-paperlogy",
  display: "swap",
  fallback: ["Apple SD Gothic Neo", "Malgun Gothic", "system-ui", "sans-serif"],
});

export const metadata: Metadata = {
  title: { default: BRAND, template: `%s | ${BRAND}` },
  description: "가고 싶은 장소를 모아 계획하고, 기록하고, 모으는 앱",
  appleWebApp: { capable: true, title: "KKuK", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F5F3EE" },
    { media: "(prefers-color-scheme: dark)", color: "#17181C" },
  ],
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const v = await getViewer();
  // 첫 로그인 : 이름을 정하기 전에는 어느 화면으로 가도 이름 정하기로 보낸다
  if (v.kind === "user" && !v.name) {
    const path = (await headers()).get(PATH_HEADER) ?? "/";
    // 약관, 개인정보 처리방침은 이름을 정하기 전에도 읽을 수 있게
    if (!/^\/(welcome|privacy|terms)(\/|\?|$)/.test(path)) redirect(`/welcome?next=${encodeURIComponent(path.startsWith("/login") ? "/" : path)}`);
  }
  const theme = (await cookies()).get("kkuk-theme")?.value;
  return (
    <html lang="ko" className={paperlogy.variable} data-theme={theme === "light" || theme === "dark" ? theme : undefined}>
      <body><GateProvider loggedIn={isIn(v)}><NetworkBanner /><SwRegister />{children}<GlobalTabs /><TripEntryMemo /></GateProvider></body>
    </html>
  );
}
