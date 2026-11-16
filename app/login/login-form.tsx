"use client";
/*
  이메일 → 숫자 코드(Supabase 설정에 따라 6~8자리) → 로그인
  Supabase : signInWithOtp (메일 보내기) → verifyOtp type "email" (확인)
  구글 : signInWithOAuth → 구글 화면 → /auth/callback 에서 세션으로 바꾼다
  메일 템플릿에 {{ .Token }} 이 있어야 링크 대신 6자리가 간다 (guides/ 안내 참고)
*/
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Field, Button } from "@/components/kit";
import { createClient } from "@/lib/supabase/client";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const WAIT = 60; // 다시 보내기까지 초

function sendError(e: { status?: number; code?: string } | null) {
  if (!e) return "";
  if (e.status === 429 || e.code === "over_email_send_rate_limit") return "잠시 뒤에 다시 보내 주세요. 짧은 시간에 너무 많이 보냈어요";
  return "코드를 보내지 못했어요. 이메일 주소를 확인하고 다시 시도해 주세요";
}

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

export function LoginForm({ next, configured, googleFailed }: { next: string; configured: boolean; googleFailed?: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useState(0);
  const [notice, setNotice] = useState("");
  const [gError, setGError] = useState(googleFailed ? "구글 로그인을 마치지 못했어요. 다시 시도하거나 이메일로 로그인해 주세요" : "");

  const google = async () => {
    const sb = createClient();
    if (!sb) return;
    setBusy(true); setGError("");
    const back = `${location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error: e } = await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: back } });
    // 성공하면 구글 화면으로 넘어가므로 여기는 실패할 때만 온다
    if (e) { setBusy(false); setGError("구글 로그인을 열지 못했어요. 잠시 뒤에 다시 시도해 주세요"); }
  };

  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft(left - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);

  const send = async () => {
    const sb = createClient();
    if (!sb) return;
    setBusy(true); setError(""); setNotice("");
    const { error: e } = await sb.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } });
    setBusy(false);
    if (e) return setError(sendError(e));
    setStep("code"); setCode(""); setLeft(WAIT);
  };

  const onEmail = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!EMAIL.test(email.trim())) return setError("이메일 주소를 다시 확인해 주세요");
    send();
  };

  const onCode = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!/^\d{6,8}$/.test(code)) return setError("메일로 받은 숫자 코드를 모두 넣어 주세요");
    const sb = createClient();
    if (!sb) return;
    setBusy(true); setError("");
    const { error: e } = await sb.auth.verifyOtp({ email: email.trim(), token: code, type: "email" });
    if (e) {
      setBusy(false);
      // Supabase 는 틀린 코드와 시간이 지난 코드를 같은 오류로 알려 줘서 한 문장으로 안내한다
      return setError(e.status === 429 ? "너무 여러 번 시도했어요. 잠시 뒤에 다시 해 주세요" : "코드가 맞지 않거나 시간이 지났어요. 다시 확인하거나 새 코드를 받아 주세요");
    }
    router.replace(next);
    router.refresh();
  };

  if (step === "email") {
    return (
      <form onSubmit={onEmail} noValidate className="flex flex-col gap-4">
        <Button full type="button" variant="secondary" onClick={google} disabled={!configured || busy}>
          <GoogleMark />구글로 계속하기
        </Button>
        {gError && <p role="alert" className="-mt-2 text-tiny font-semibold text-point-text">{gError}</p>}
        <div className="flex items-center gap-3 text-tiny text-ink-sub" aria-hidden="true">
          <span className="h-px flex-1 bg-line" />또는 이메일로<span className="h-px flex-1 bg-line" />
        </div>
        <Field label="이메일" type="email" name="email" inputMode="email" autoComplete="email" placeholder="name@example.com"
          value={email} onChange={(e) => { setEmail(e.target.value); setError(""); }} error={error || undefined} disabled={!configured || busy} />
        <Button full type="submit" disabled={!configured || busy || !email}>{busy ? "보내는 중" : "로그인 코드 받기"}</Button>
      </form>
    );
  }

  return (
    <form onSubmit={onCode} noValidate className="flex flex-col gap-4">
      <p className="text-sub text-ink"><b className="font-bold">{email}</b> 로 로그인 코드를 보냈어요. 메일이 안 보이면 스팸함도 확인해 주세요</p>
      <Field label="로그인 코드" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={8} placeholder="숫자 코드"
        value={code} onChange={(e) => { setCode(e.target.value.replace(/\D/g, "").slice(0, 8)); setError(""); }}
        error={error || undefined} hint={notice || undefined} disabled={busy} autoFocus />
      <Button full type="submit" disabled={busy || code.length < 6}>{busy ? "확인하는 중" : "로그인"}</Button>
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => { setStep("email"); setError(""); }} className="press h-11 px-1 text-sub font-semibold text-ink-sub underline underline-offset-4">이메일 바꾸기</button>
        <button type="button" disabled={left > 0 || busy} onClick={async () => { await send(); setNotice("새 코드를 보냈어요"); }}
          className="press h-11 px-1 text-sub font-bold text-ink disabled:text-ink-sub">
          {left > 0 ? `다시 보내기 (${left}초)` : "코드 다시 보내기"}
        </button>
      </div>
    </form>
  );
}
