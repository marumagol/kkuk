"use client";
/*
  설정 > 휴대폰 알림 (5단계 7번). 켜면 앱 안 알림과 같은 일이 휴대폰 알림으로도 와요
  - iPhone 은 홈 화면에 추가한 앱에서만 됨 (iOS 16.4+)
  - 공개 키는 Supabase Edge Function "push" 에서 받는다 (비밀 키는 서버에만)
*/
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
      /* 0.91.8 : 삼성 인터넷 등에서 서비스 워커 확인이 끝나지 않아 토글이 안 보이던 문제. 3초 안에 답이 없으면 꺼진 상태로 보여 준다 */
      const sub = await Promise.race([
        navigator.serviceWorker.getRegistration().then((reg) => reg?.pushManager.getSubscription() ?? null),
        new Promise<null>((ok) => setTimeout(() => ok(null), 3000)),
      ]);
      setState(sub && Notification.permission === "granted" ? "on" : "off");
    })().catch(() => setState("off"));
  }, []);

  /* 0.91.5 : 어느 단계에서 막혔는지 알려 준다 (마루님 "알림 토글이 작동 안 해"). 서비스 워커 준비는 8초까지만 기다린다 */
  const turnOn = async () => {
    setBusy(true); setError("");
    let step = "server";
    try {
      const env = supabaseEnv();
      const sb = createClient();
      if (!env || !sb) throw new Error("no_server");
      step = "permission";
      /* 0.91.6 : 삼성 인터넷 등에서 허용 창 없이 답이 안 오는 경우가 있어 10초 뒤 안내 */
      const perm = await Promise.race([Notification.requestPermission(), new Promise<"stuck">((ok) => setTimeout(() => ok("stuck"), 10000))]);
      if (perm === "stuck") { setError("알림 허용 창이 뜨지 않았어요. 삼성 인터넷은 메뉴 > 설정 > 사이트 및 다운로드 > 알림에서 이 사이트를 허용하거나, 크롬에서 열어 켜 주세요"); return; }
      if (perm !== "granted") {
        setState(perm === "denied" ? "denied" : "off");
        if (perm !== "denied") setError("알림 허용 창이 닫혔어요. 다시 눌러 [허용]을 골라 주세요. 창이 안 뜨면 주소창 왼쪽 자물쇠 > 알림을 허용으로 바꿔 주세요");
        return;
      }
      step = "worker";
      const reg = await Promise.race([
        navigator.serviceWorker.register("/sw.js").then(() => navigator.serviceWorker.ready),
        new Promise<never>((_, no) => setTimeout(() => no(new Error("sw_timeout")), 8000)),
      ]);
      step = "key";
      const res = await fetch(`${env.url}/functions/v1/push`);
      const { publicKey } = await res.json();
      if (!publicKey) throw new Error("no_key");
      step = "subscribe";
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(publicKey) }));
      const j = sub.toJSON();
      step = "save";
      const { error: e } = await sb.rpc("save_push_subscription", { p_endpoint: j.endpoint, p_p256dh: j.keys?.p256dh, p_auth: j.keys?.auth });
      if (e) throw e;
      setState("on");
    } catch (e) {
      console.error("[push] 켜기 실패", step, e);
      const why: Record<string, string> = {
        worker: "앱 준비가 덜 됐어요. 화면을 새로고침한 뒤 다시 켜 주세요",
        key: "알림 서버에 연결하지 못했어요. 인터넷 연결을 확인하고 다시 켜 주세요",
        subscribe: "이 브라우저는 알림 등록을 막고 있어요. 크롬이나 사파리(홈 화면에 추가한 앱)에서 켜 주세요",
        save: "알림 등록을 저장하지 못했어요. 다시 로그인한 뒤 켜 주세요",
      };
      setError(why[step] ?? "알림을 켜지 못했어요. 잠시 뒤 다시 시도해 주세요");
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
          <p className="text-body font-bold text-ink">알림</p>
          <p className="text-tiny text-ink-sub">함께하는 사람이 들어오거나 장소를 고치면 알려 줘요</p>
        </div>
        {canToggle && (
          <button type="button" role="switch" aria-checked={on} aria-label="알림" disabled={busy} onClick={on ? turnOff : turnOn}
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
  { label: "도장", kinds: ["stamp"] },
];
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
