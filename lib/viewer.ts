/*
  지금 보는 사람이 누구인지
  - guest   : 로그인 전. 둘러보기만 (화면은 빈 상태, 쓰기 버튼은 "로그인이 필요해요")
  - user    : 로그인함
  - preview : Supabase 연결 전에만 있는 "로그인한 것처럼 보기" (마루님 화면 확인용, 마이 탭에서 켬)
  user 는 DB 여행(lib/trips.ts), preview 는 lib/mock.ts 의 가짜 여행을 본다
*/
import { cache } from "react";
import { cookies } from "next/headers";
import { supabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { avatarUrl } from "@/lib/storage";

export const PREVIEW_COOKIE = "kkuk_preview";
export type Viewer =
  | { kind: "guest"; configured: boolean }
  | { kind: "user"; id: string; email: string; name: string | null; avatar: string | null; anon: boolean } // name 이 null 이면 아직 이름을 안 정한 첫 로그인. anon : 로그인 없이 쓰는 손님 계정 (Supabase 익명 로그인, 0.107.0)
  | { kind: "preview" };

/* 한 요청 안에서는 한 번만 묻는다 (cache) */
export const getViewer = cache(async (): Promise<Viewer> => {
  if (!supabaseEnv()) {
    const on = (await cookies()).get(PREVIEW_COOKIE)?.value === "1";
    return on ? { kind: "preview" } : { kind: "guest", configured: false };
  }
  const sb = await createClient();
  // getClaims (2026-11-17 화면 이동 지연 줄이기) : 서명 확인을 앱 안에서 해서 화면마다 인증 서버에 묻지 않는다. 저장 같은 쓰기는 actions 에서 getUser 로 한 번 더 확인
  const { data } = await sb!.auth.getClaims();
  const uid = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  if (!uid) return { kind: "guest", configured: true };
  // RLS 가 내 행만 보여 주지만 조건은 항상 적는다
  const { data: profile } = await sb!.from("profiles").select("display_name, avatar_url").eq("user_id", uid).is("deleted_at", null).maybeSingle();
  return { kind: "user", id: uid, email: typeof data?.claims?.email === "string" ? data.claims.email : "", name: profile?.display_name ?? null, avatar: avatarUrl(profile?.avatar_url), anon: data?.claims?.is_anonymous === true };
});

/* 아바타에 넣을 한 글자 */
export const avatarOf = (v: Viewer) => (v.kind === "user" ? v.avatar : null);
export const initialOf = (v: Viewer) => (v.kind === "user" && v.name ? [...v.name][0] : "나");

/* 미들웨어가 넣어 주는 "지금 보는 주소" 머리말 이름 */
export const PATH_HEADER = "x-kkuk-path";

export const isIn = (v: Viewer) => v.kind !== "guest";
/* 손님 계정 (로그인 없이 쓰는 중) : 초대, 공유는 못 쓴다 */
export const isAnon = (v: Viewer) => v.kind === "user" && v.anon;

/* 로그인 뒤 돌아갈 주소. 다른 사이트로 튀지 않게 "/" 로 시작하는 것만 */
/* "/\\evil.com" 은 브라우저가 "//evil.com" 처럼 읽어서 막는다. 줄바꿈 같은 제어 문자도 막는다 */
export const safeNext = (n?: string | null) => (n && n.startsWith("/") && !n.startsWith("//") && !n.includes("\\") && !/[\u0000-\u001f]/.test(n) ? n : "/");
