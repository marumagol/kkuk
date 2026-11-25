import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /*
    화면 이동 지연 줄이기 (2026-11-17 마루님 "메뉴 이동할 때 딜레이") : 한 번 본 화면은 30초 동안 다시 받지 않고 바로 보여 준다.
    저장하면 서버 동작의 revalidatePath 가 이 기억을 지우고, 다른 사람 변경은 실시간 새로고침이 가져온다
  */
  experimental: { staleTimes: { dynamic: 30, static: 180 } },
  /* 없앤 옛 주소 넘기기 (하단 [+] 바로 가기 /add 와 내 장소 지도 /stamps/map, 2026-11-25 정리) */
  async redirects() {
    return [
      { source: "/add", destination: "/trips", permanent: true },
      { source: "/stamps/map", destination: "/trips", permanent: true },
      /* 여행 한 권(인쇄, PDF)은 숨겼다가 없앴다 (2026-11-25 마루님) */
      { source: "/trips/:id/book", destination: "/trips/:id", permanent: true },
    ];
  },
};

export default nextConfig;
