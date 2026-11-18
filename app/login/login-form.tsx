"use client";
/*
  카카오, 구글 두 가지로만 로그인한다 (2026-11-18 마루님 결정. 이메일 코드 로그인은 뺐다)
  signInWithOAuth → 카카오/구글 화면 → /auth/callback 에서 세션으로 바꾼다
  같은 이메일로 들어오면 Supabase 가 한 계정으로 이어 준다
*/
import { useState } from "react";
import { Button } from "@/components/kit";
import { createClient } from "@/lib/supabase/client";

type Provider = "kakao" | "google";
const NAME: Record<Provider, string> = { kakao: "카카오", google: "구글" };

function GoogleMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

/* 카카오 말풍선 심볼 (카카오 로그인 디자인 가이드 : 노란 바탕 #FEE500, 검정 심볼과 글자) */
function KakaoMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#000" d="M12 3C6.5 3 2 6.6 2 11c0 2.8 1.8 5.3 4.6 6.7l-1 3.6c-.1.3.3.6.6.4l4.3-2.8c.5.1 1 .1 1.5.1 5.5 0 10-3.6 10-8S17.5 3 12 3z" />
    </svg>
  );
}

export function LoginForm({ next, configured, failed }: { next: string; configured: boolean; failed?: Provider | "any" }) {
  const [busy, setBusy] = useState<Provider | null>(null);
  const [error, setError] = useState(failed ? `${failed === "any" ? "" : `${NAME[failed]} `}로그인을 마치지 못했어요. 다시 시도해 주세요` : "");

  const go = async (provider: Provider) => {
    const sb = createClient();
    if (!sb) return;
    setBusy(provider); setError("");
    const back = `${location.origin}/auth/callback?provider=${provider}&next=${encodeURIComponent(next)}`;
    const { error: e } = await sb.auth.signInWithOAuth({ provider, options: { redirectTo: back } }).catch(() => ({ error: { status: 0 } }));
    // 성공하면 카카오/구글 화면으로 넘어가므로 여기는 실패할 때만 온다
    if (e) {
      setBusy(null);
      setError(typeof navigator !== "undefined" && navigator.onLine === false
        ? "인터넷 연결을 확인하고 다시 시도해 주세요"
        : `${NAME[provider]} 로그인을 열지 못했어요. 잠시 뒤에 다시 시도해 주세요`);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <button type="button" onClick={() => go("kakao")} disabled={!configured || !!busy}
        className="press inline-flex h-14 w-full items-center justify-center gap-2 rounded-btn bg-[#FEE500] px-5 text-[16px] font-bold text-black/85 disabled:cursor-not-allowed disabled:opacity-60">
        <KakaoMark />{busy === "kakao" ? "카카오로 가는 중" : "카카오로 계속하기"}
      </button>
      <Button full type="button" variant="secondary" onClick={() => go("google")} disabled={!configured || !!busy}>
        <GoogleMark />{busy === "google" ? "구글로 가는 중" : "구글로 계속하기"}
      </Button>
      {error && <p role="alert" className="text-tiny font-semibold text-point-text">{error}</p>}
    </div>
  );
}
