/* 카카오, 구글 로그인에서 돌아오는 곳. 받은 code 를 로그인 세션(쿠키)으로 바꾸고 원래 보던 화면으로 보낸다 */
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/viewer";

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const next = safeNext(url.searchParams.get("next"));
  const code = url.searchParams.get("code");
  const provider = url.searchParams.get("provider");
  const known = provider === "kakao" || provider === "google";
  // 손님 계정에 이어 붙이기(link=1)인데 그 카카오/구글이 이미 다른 계정에 있으면 : 로그인 화면에서 "그 계정으로 들어갈까요?" 묻는다 (0.107.0)
  const errCode = url.searchParams.get("error_code") ?? "";
  if (url.searchParams.get("link") === "1" && known && /identity_already_exists|already_linked|identity.*exists/i.test(errCode + (url.searchParams.get("error_description") ?? ""))) {
    const back = new URL("/login", url.origin);
    back.searchParams.set("error", `taken_${provider}`);
    if (next !== "/") back.searchParams.set("next", next);
    return NextResponse.redirect(back);
  }
  const sb = await createClient();
  if (code && sb) {
    const { error } = await sb.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }
  // 취소했거나 실패하면 로그인 화면으로 돌아가 안내한다
  const back = new URL("/login", url.origin);
  back.searchParams.set("error", known ? provider : "any");
  if (next !== "/") back.searchParams.set("next", next);
  return NextResponse.redirect(back);
}
