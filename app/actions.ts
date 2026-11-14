"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { PREVIEW_COOKIE, safeNext } from "@/lib/viewer";

/* 로그아웃 → 둘러보기 (홈) */
export async function signOut() {
  if (supabaseEnv()) {
    const sb = await createClient();
    await sb!.auth.signOut();
  }
  (await cookies()).delete(PREVIEW_COOKIE);
  redirect("/");
}

/* 미리보기 모드 켜기 : Supabase 연결 전에만 동작 */
export async function startPreview(formData: FormData) {
  if (supabaseEnv()) redirect("/login");
  (await cookies()).set(PREVIEW_COOKIE, "1", { path: "/", httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 7 });
  redirect(safeNext(String(formData.get("next") ?? "/")));
}
