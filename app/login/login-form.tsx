"use client";
/*
  카카오, 구글 두 가지로만 로그인한다 (2026-11-18 마루님 결정. 이메일 코드 로그인은 뺐다)
  signInWithOAuth → 카카오/구글 화면 → /auth/callback 에서 세션으로 바꾼다
  같은 이메일로 들어오면 Supabase 가 한 계정으로 이어 준다
  손님 계정(0.107.0) : linkIdentity 로 지금 계정에 카카오/구글을 이어 붙인다 (기록 그대로).
    이미 다른 계정에 쓰인 카카오/구글이면(taken) 손님 기록을 버리고 그 계정으로 로그인할지 묻는다
  [로그인 없이 시작] : 손님 계정을 만든다 (components/gate.tsx startGuest)
*/
import { useEffect, useState } from "react";
import { Button } from "@/components/kit";
import { createClient } from "@/lib/supabase/client";
import { AlertDialog, startGuest } from "@/components/gate";

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

export function LoginForm({ next, configured, failed, anon = false, taken }: { next: string; configured: boolean; failed?: Provider | "any" | "guest"; anon?: boolean; taken?: Provider }) {
  const [busy, setBusy] = useState<Provider | "guest" | null>(null);
  const [error, setError] = useState(failed === "guest" ? "로그인 없이 시작하지 못했어요. 카카오나 구글로 시작해 주세요"
    : failed ? `${failed === "any" ? "" : `${NAME[failed]} `}로그인을 마치지 못했어요. 다시 시도해 주세요` : "");
  const [ask, setAsk] = useState<Provider | null>(taken ?? null);
  // 오류가 주소 # 뒤로 오는 경우 (서버는 못 본다) : 이미 다른 계정에 쓰인 카카오/구글
  useEffect(() => {
    if (anon && (failed === "kakao" || failed === "google") && /identity_already_exists|already.linked/i.test(decodeURIComponent(location.hash))) { setAsk(failed); setError(""); }
  }, [anon, failed]);

  // fresh : 손님 계정이어도 이어 붙이지 않고 새로 로그인 (이미 가입한 계정으로 들어갈 때. 손님 기록은 버려짐)
  const go = async (provider: Provider, fresh = false) => {
    const sb = createClient();
    if (!sb) return;
    setBusy(provider); setError("");
    const link = anon && !fresh;
    const back = `${location.origin}/auth/callback?provider=${provider}${link ? "&link=1" : ""}&next=${encodeURIComponent(next)}`;
    if (fresh) await sb.auth.signOut({ scope: "local" }).catch(() => {});
    const { error: e } = await (link
      ? sb.auth.linkIdentity({ provider, options: { redirectTo: back } })
      : sb.auth.signInWithOAuth({ provider, options: { redirectTo: back } })
    ).catch(() => ({ error: { status: 0 } }));
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
      {!anon && configured && (
        <button type="button" disabled={!!busy} onClick={() => { setBusy("guest"); void startGuest(next); }}
          className="press mt-1 h-11 self-center px-2 text-sub font-semibold text-ink-sub underline underline-offset-4 disabled:opacity-60">
          {busy === "guest" ? "준비하는 중" : "로그인 없이 시작하기"}
        </button>
      )}
      {ask && (
        <AlertDialog title={`이미 가입한 ${NAME[ask]} 계정이에요`} desc="그 계정으로 들어가면 지금 손님으로 만든 여행과 카드는 사라져요. 그래도 들어갈까요?"
          confirmLabel="들어가기" confirm={() => void go(ask, true)} onClose={() => setAsk(null)} />
      )}
    </div>
  );
}
