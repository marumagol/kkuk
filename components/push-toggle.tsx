"use client";
/*
  설정 > 휴대폰 알림 (5단계 7번). 켜면 앱 안 알림과 같은 일이 휴대폰 알림으로도 와요
  - iPhone 은 홈 화면에 추가한 앱에서만 됨 (iOS 16.4+)
  - 공개 키는 Supabase Edge Function "push" 에서 받는다 (비밀 키는 서버에만)
*/
import { FEATURES } from "@/lib/features";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { supabaseEnv } from "@/lib/supabase/env";

type State = "loading" | "unsupported" | "ios-home" | "denied" | "off" | "on";

const b64 = (s: string) => {
  const p = (s + "=".repeat((4 - (s.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(p), (c) => c.charCodeAt(0));
};

export function PushToggle() {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
      const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone;
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return setState(ios && !standalone ? "ios-home" : "unsupported");
      if (Notification.permission === "denied") return setState("denied");
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      setState(sub && Notification.permission === "granted" ? "on" : "off");
    })().catch(() => setState("unsupported"));
  }, []);

  const turnOn = async () => {
    setBusy(true); setError("");
    try {
      const env = supabaseEnv();
      const sb = createClient();
      if (!env || !sb) throw new Error("no_server");
      if ((await Notification.requestPermission()) !== "granted") { setState(Notification.permission === "denied" ? "denied" : "off"); return; }
      const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register("/sw.js"));
      await navigator.serviceWorker.ready;
      const res = await fetch(`${env.url}/functions/v1/push`);
      const { publicKey } = await res.json();
      if (!publicKey) throw new Error("no_key");
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(publicKey) }));
      const j = sub.toJSON();
      const { error: e } = await sb.rpc("save_push_subscription", { p_endpoint: j.endpoint, p_p256dh: j.keys?.p256dh, p_auth: j.keys?.auth });
      if (e) throw e;
      setState("on");
    } catch {
      setError("알림을 켜지 못했어요. 잠시 뒤 다시 시도해 주세요");
    } finally { setBusy(false); }
  };

  const turnOff = async () => {
    setBusy(true); setError("");
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await createClient()?.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
    } catch {
      setError("알림을 끄지 못했어요. 잠시 뒤 다시 시도해 주세요");
    } finally { setBusy(false); }
  };

  const note: Partial<Record<State, string>> = {
    "ios-home": "iPhone 은 Safari 공유 버튼 > 홈 화면에 추가 로 연 앱에서 켤 수 있어요",
    unsupported: "이 브라우저는 휴대폰 알림을 지원하지 않아요",
    denied: "알림이 막혀 있어요. 기기 설정에서 이 앱의 알림을 허용해 주세요",
  };
  const on = state === "on";
  const canToggle = state === "on" || state === "off";
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-body font-bold text-ink">휴대폰 알림</p>
          <p className="text-tiny text-ink-sub">{FEATURES.diary ? "함께하는 사람이 들어오거나 장소를 수정하거나 일기를 남기면 알려 줘요" : "함께하는 사람이 들어오거나 장소를 고치면 알려 줘요"}</p>
        </div>
        {canToggle && (
          <button type="button" role="switch" aria-checked={on} aria-label="휴대폰 알림" disabled={busy} onClick={on ? turnOff : turnOn}
            className="press flex h-11 w-16 flex-none items-center justify-center disabled:opacity-50">
            <span className={`relative h-8 w-14 rounded-full transition-colors ${on ? "bg-point" : "bg-line-strong"}`}>
              <span className={`absolute top-1 size-6 rounded-full bg-white transition-all ${on ? "left-7" : "left-1"}`} />
            </span>
          </button>
        )}
      </div>
      {on && <KindPrefs />}
      {note[state] && <p className="text-tiny text-ink-sub">{note[state]}</p>}
      {error && <p role="alert" className="text-tiny font-semibold text-point-text">{error}</p>}
    </div>
  );
}

/* 종류별 끄기 (6단계 4번, migration 0027). 앱 안 알림은 그대로 쌓이고 휴대폰 알림만 거른다 */
const KINDS: { label: string; kinds: string[] }[] = [
  { label: "함께하는 사람 참여", kinds: ["joined"] },
  { label: "장소 고침", kinds: ["items"] },
  { label: "새 일기", kinds: ["journal"] },
  { label: "댓글과 답글", kinds: ["comment", "reply"] },
  { label: "도장", kinds: ["stamp"] },
].filter((k) => FEATURES.diary || !k.kinds.some((x) => ["journal", "comment", "reply"].includes(x)));
function KindPrefs() {
  const [off, setOff] = useState<string[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const sb = createClient();
    sb?.from("push_prefs").select("off_kinds").maybeSingle().then(({ data }) => setOff((data?.off_kinds as string[] | undefined) ?? []));
  }, []);
  if (!off) return null;
  const flip = async (kinds: string[]) => {
    const isOff = kinds.every((k) => off.includes(k));
    const next = isOff ? off.filter((k) => !kinds.includes(k)) : [...new Set([...off, ...kinds])];
    const prev = off;
    setOff(next); setFailed(false);
    const { error } = await createClient()!.from("push_prefs").upsert({ off_kinds: next, updated_at: new Date().toISOString() });
    if (error) { setOff(prev); setFailed(true); }
  };
  return (
    <ul className="mt-1 divide-y divide-line border-t border-line">
      {KINDS.map((g) => {
        const enabled = !g.kinds.every((k) => off.includes(k));
        return (
          <li key={g.label} className="flex min-h-12 items-center justify-between gap-3">
            <span className="text-sub text-ink">{g.label}</span>
            <button type="button" role="switch" aria-checked={enabled} aria-label={`${g.label} 알림`} onClick={() => flip(g.kinds)}
              className="press flex h-11 w-16 flex-none items-center justify-center">
              <span className={`relative h-7 w-12 rounded-full transition-colors ${enabled ? "bg-point" : "bg-line-strong"}`}>
                <span className={`absolute top-1 size-5 rounded-full bg-white transition-all ${enabled ? "left-6" : "left-1"}`} />
              </span>
            </button>
          </li>
        );
      })}
      {failed && <li role="alert" className="py-2 text-tiny font-semibold text-point-text">바꾸지 못했어요. 잠시 뒤 다시 시도해 주세요</li>}
    </ul>
  );
}
