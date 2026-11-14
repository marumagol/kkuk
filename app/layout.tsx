import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { GateProvider } from "@/components/gate";
import { getViewer, isIn } from "@/lib/viewer";
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
  return (
    <html lang="ko" className={paperlogy.variable}>
      <body><GateProvider loggedIn={isIn(await getViewer())}>{children}</GateProvider></body>
    </html>
  );
}
