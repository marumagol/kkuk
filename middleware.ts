/* 요청마다 로그인 세션을 새로 고친다 (만료 직전 토큰 갱신). Supabase 설정이 없으면 그냥 통과 */
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabaseEnv } from "@/lib/supabase/env";

export async function middleware(request: NextRequest) {
  const env = supabaseEnv();
  if (!env) return NextResponse.next();
  // 화면 쪽에서 "지금 보는 주소"를 알 수 있게 머리말에 넣는다 (이름 정하기 뒤 돌아올 곳)
  const next = () => {
    const headers = new Headers(request.headers);
    headers.set("x-kkuk-path", request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.next({ request: { headers } });
  };
  let response = next();
  const sb = createServerClient(env.url, env.key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = next();
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  await sb.auth.getUser();
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|fonts/|sw.js|manifest.webmanifest|.*\\.(?:png|jpg|jpeg|svg|webp|woff2)$).*)"],
};
