/*
  Supabase 주소와 공개 키. .env.local 에만 넣는다 (저장소에 올리지 않음, .env.example 참고)
  둘 중 하나라도 없으면 null : 로그인은 꺼지고 "미리보기 모드" 로 돈다
*/
export function supabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? { url, key } : null;
}
