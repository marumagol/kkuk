"use client";
/* 브라우저에서 쓰는 Supabase (로그인 코드 보내기, 확인) */
import { createBrowserClient } from "@supabase/ssr";
import { supabaseEnv } from "./env";

export function createClient() {
  const env = supabaseEnv();
  if (!env) return null;
  return createBrowserClient(env.url, env.key);
}
