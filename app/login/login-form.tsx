"use client";
/*
  이메일 → 6자리 코드 → 로그인
  Supabase : signInWithOtp (메일 보내기) → verifyOtp type "email" (확인)
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

export function LoginForm({ next, configured }: { next: string; configured: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useState(0);
  const [notice, setNotice] = useState("");

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
    if (!/^\d{6}$/.test(code)) return setError("6자리 숫자를 넣어 주세요");
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
        <Field label="이메일" type="email" name="email" inputMode="email" autoComplete="email" placeholder="name@example.com"
          value={email} onChange={(e) => { setEmail(e.target.value); setError(""); }} error={error || undefined} disabled={!configured || busy} />
        <Button full type="submit" disabled={!configured || busy || !email}>{busy ? "보내는 중" : "로그인 코드 받기"}</Button>
      </form>
    );
  }

  return (
    <form onSubmit={onCode} noValidate className="flex flex-col gap-4">
      <p className="text-sub text-ink"><b className="font-bold">{email}</b> 로 6자리 코드를 보냈어요. 메일이 안 보이면 스팸함도 확인해 주세요</p>
      <Field label="로그인 코드" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="6자리 숫자"
        value={code} onChange={(e) => { setCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setError(""); }}
        error={error || undefined} hint={notice || undefined} disabled={busy} autoFocus />
      <Button full type="submit" disabled={busy || code.length !== 6}>{busy ? "확인하는 중" : "로그인"}</Button>
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
