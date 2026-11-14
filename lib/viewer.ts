/*
  지금 보는 사람이 누구인지
  - guest   : 로그인 전. 둘러보기만 (화면은 빈 상태, 쓰기 버튼은 "로그인이 필요해요")
  - user    : 로그인함
  - preview : Supabase 연결 전에만 있는 "로그인한 것처럼 보기" (마루님 화면 확인용, 마이 탭에서 켬)
  6단계(DB) 전까지는 user, preview 모두 lib/mock.ts 의 가짜 여행을 본다
*/
import { cookies } from "next/headers";
import { supabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export const PREVIEW_COOKIE = "kkuk_preview";
export type Viewer =
  | { kind: "guest"; configured: boolean }
  | { kind: "user"; email: string }
  | { kind: "preview" };

export async function getViewer(): Promise<Viewer> {
  if (!supabaseEnv()) {
    const on = (await cookies()).get(PREVIEW_COOKIE)?.value === "1";
    return on ? { kind: "preview" } : { kind: "guest", configured: false };
  }
  const sb = await createClient();
  const { data } = await sb!.auth.getUser();
  return data.user ? { kind: "user", email: data.user.email ?? "" } : { kind: "guest", configured: true };
}

export const isIn = (v: Viewer) => v.kind !== "guest";

/* 로그인 뒤 돌아갈 주소. 다른 사이트로 튀지 않게 "/" 로 시작하는 것만 */
export const safeNext = (n?: string | null) => (n && n.startsWith("/") && !n.startsWith("//") ? n : "/");
