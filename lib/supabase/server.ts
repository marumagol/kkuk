/* 서버(화면 그리기, 서버 동작)에서 쓰는 Supabase. 로그인 정보는 쿠키에 있다 */
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseEnv } from "./env";

export async function createClient() {
  const env = supabaseEnv();
  if (!env) return null;
  const store = await cookies();
  return createServerClient(env.url, env.key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        // 화면을 그리는 중에는 쿠키를 못 쓴다. 미들웨어가 대신 갱신하므로 무시해도 된다
        try { list.forEach(({ name, value, options }) => store.set(name, value, options)); } catch {}
      },
    },
  });
}
