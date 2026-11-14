"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
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

/* 표시 이름 저장 (처음 로그인, 마이 > 이름 바꾸기). 1~20자 */
export type NameState = { error?: string };
export async function saveName(_prev: NameState, formData: FormData): Promise<NameState> {
  const name = String(formData.get("name") ?? "").trim();
  const next = safeNext(String(formData.get("next") ?? "/"));
  const len = [...name].length;
  if (len < 1) return { error: "이름을 적어 주세요" };
  if (len > 20) return { error: "이름은 20자까지 쓸 수 있어요" };
  const sb = await createClient();
  if (!sb) return { error: "아직 로그인 서버가 연결되지 않았어요" };
  const { data } = await sb.auth.getUser();
  if (!data.user) redirect(`/login?next=${encodeURIComponent(next)}`);
  const { error } = await sb.from("profiles").upsert({ user_id: data.user.id, display_name: name }, { onConflict: "user_id" });
  if (error) return { error: "저장하지 못했어요. 잠시 뒤 다시 시도해 주세요" };
  revalidatePath("/", "layout");
  redirect(next);
}
