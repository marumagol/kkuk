/* 홈 화면 추가 (3단계 9, PWA) : 앱 이름, 아이콘, 주소창 없이 열기 */
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "KKuK",
    short_name: "KKuK",
    description: "가고 싶은 장소를 모아 계획하고, 기록하고, 모으는 앱",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F5F3EE",
    theme_color: "#F5F3EE",
    lang: "ko",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
