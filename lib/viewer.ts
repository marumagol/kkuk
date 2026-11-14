/*
  지금 보는 사람이 누구인지
  - guest   : 로그인 전. 둘러보기만 (화면은 빈 상태, 쓰기 버튼은 "로그인이 필요해요")
  - user    : 로그인함
  - preview : Supabase 연결 전에만 있는 "로그인한 것처럼 보기" (마루님 화면 확인용, 마이 탭에서 켬)
  7단계(여행 만들기) 전까지는 user, preview 모두 lib/mock.ts 의 가짜 여행을 본다. 이름(profiles)은 6단계부터 DB
*/
import { cache } from "react";
import { cookies } from "next/headers";
import { supabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export const PREVIEW_COOKIE = "kkuk_preview";
export type Viewer =
  | { kind: "guest"; configured: boolean }
  | { kind: "user"; id: string; email: string; name: string | null } // name 이 null 이면 아직 이름을 안 정한 첫 로그인
  | { kind: "preview" };

/* 한 요청 안에서는 한 번만 묻는다 (cache) */
export const getViewer = cache(async (): Promise<Viewer> => {
  if (!supabaseEnv()) {
    const on = (await cookies()).get(PREVIEW_COOKIE)?.value === "1";
    return on ? { kind: "preview" } : { kind: "guest", configured: false };
  }
  const sb = await createClient();
  const { data } = await sb!.auth.getUser();
  if (!data.user) return { kind: "guest", configured: true };
  // RLS 가 내 행만 보여 주지만 조건은 항상 적는다
  const { data: profile } = await sb!.from("profiles").select("display_name").eq("user_id", data.user.id).is("deleted_at", null).maybeSingle();
  return { kind: "user", id: data.user.id, email: data.user.email ?? "", name: profile?.display_name ?? null };
});

/* 아바타에 넣을 한 글자 */
export const initialOf = (v: Viewer) => (v.kind === "user" && v.name ? [...v.name][0] : "나");

/* 미들웨어가 넣어 주는 "지금 보는 주소" 머리말 이름 */
export const PATH_HEADER = "x-kkuk-path";

export const isIn = (v: Viewer) => v.kind !== "guest";

/* 로그인 뒤 돌아갈 주소. 다른 사이트로 튀지 않게 "/" 로 시작하는 것만 */
export const safeNext = (n?: string | null) => (n && n.startsWith("/") && !n.startsWith("//") ? n : "/");
