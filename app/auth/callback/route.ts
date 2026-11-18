/* 카카오, 구글 로그인에서 돌아오는 곳. 받은 code 를 로그인 세션(쿠키)으로 바꾸고 원래 보던 화면으로 보낸다 */
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/viewer";

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const next = safeNext(url.searchParams.get("next"));
  const code = url.searchParams.get("code");
  const sb = await createClient();
  if (code && sb) {
    const { error } = await sb.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }
  // 취소했거나 실패하면 로그인 화면으로 돌아가 안내한다
  const back = new URL("/login", url.origin);
  const provider = url.searchParams.get("provider");
  back.searchParams.set("error", provider === "kakao" || provider === "google" ? provider : "any");
  if (next !== "/") back.searchParams.set("next", next);
  return NextResponse.redirect(back);
}
