"use client";
/* 도장 받기 (3단계 2) : 여행 중인 여행에서만 보인다. 위치는 저장하지 않고 DB 함수에 한 번 보내 확인만 한다
   0.86.1 : 버튼을 0.8초 꾹 누르면 게이지가 차고 도장이 찍힌다. 짧게 떼면 안내만. 키보드(Enter, Space)는 바로 받는다 */
import { useRef, useState, useTransition } from "react";
import { HoldButton } from "@/components/hold-button";
import { Icon, StampFace } from "@/components/kit";
import { claimStamp, type ClaimResult } from "@/app/actions";
import { safeCall } from "@/lib/safe-call";

type State = { kind: "idle" } | { kind: "denied" } | { kind: "error"; text: string } | { kind: "done"; r: Extract<ClaimResult, { ok: true }> };

export function StampClaim({ tripId, inset = true }: { tripId: string; inset?: boolean }) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const [locating, setLocating] = useState(false);
  const [pending, start] = useTransition();
  const busy = locating || pending;

  const [hint, setHint] = useState(false);
  const pos = useRef<GeolocationPosition | "fail" | null>(null);
  const waiting = useRef(false);

  const claim = (p: GeolocationPosition) => start(async () => {
    const r = await safeCall(() => claimStamp(tripId, p.coords.latitude, p.coords.longitude, p.coords.accuracy));
    if (!("ok" in r) || !r.ok) return setState({ kind: "error", text: r.error });
    setState({ kind: "done", r });
    if (r.status !== "already" && "vibrate" in navigator) navigator.vibrate?.([30, 40, 80]);
  });

  /* 꾹 누르기가 끝났을 때 : 위치가 아직이면 기다렸다가 받는다 */
  const finish = () => {
    const p = pos.current;
    if (p === null) { waiting.current = true; setLocating(true); return; }
    waiting.current = false; setLocating(false);
    if (p === "fail") return;
    pos.current = null;
    claim(p);
  };

  /* 누르기 시작할 때 위치를 미리 읽는다 */
  const locate = () => {
    setHint(false);
    if (!("geolocation" in navigator)) { setState({ kind: "error", text: "이 기기에서는 위치를 읽을 수 없어요. 위치 기능이 있는 휴대폰에서 다시 열어 주세요" }); return false; }
    pos.current = null; waiting.current = false;
    navigator.geolocation.getCurrentPosition(
      (p) => { pos.current = p; if (waiting.current) finish(); },
      (e) => {
        pos.current = "fail";
        setState(e.code === e.PERMISSION_DENIED ? { kind: "denied" } : { kind: "error", text: "위치를 읽지 못했어요. 밖에서 잠시 뒤 다시 눌러 주세요" });
        if (waiting.current) finish();
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
    return true;
  };

  const msg = state.kind === "done"
    ? state.r.status === "already" ? `${state.r.city} 도장은 이 여행에서 이미 받았어요`
      : state.r.status === "again" ? `${state.r.city} 도장을 또 받았어요. ${state.r.visits}번째 방문이에요`
      : `${state.r.city} 도장을 받았어요. 함께하는 사람도 같이 받아요`
    : state.kind === "denied" ? "위치를 허용하면 도장을 받을 수 있어요. 브라우저 설정에서 위치를 켜 주세요"
    : state.kind === "error" ? state.text
    : hint ? "조금 더 꾹 눌러 주세요. 게이지가 다 차면 도장이 찍혀요" : null;

  return (
    <section className={(inset ? "mx-5 mt-4 " : "") + "flex flex-col gap-3 rounded-card bg-surface px-4 py-4"} aria-label="도장 받기">
      {state.kind === "done" && (
        <div className="flex justify-center">
          <div className={state.r.status === "already" ? "-rotate-6" : "stamp-hit"}>
            <StampFace name={state.r.city} country={state.r.country} size={110} />
          </div>
        </div>
      )}
      <div className="flex items-center gap-3">
        <span className="flex size-10 flex-none items-center justify-center rounded-full bg-point-soft text-point-text"><Icon name="stamp" size={20} /></span>
        <p className="min-w-0 flex-1 text-sub text-ink">{msg ?? "지금 여행 도시에 있다면 도장을 받을 수 있어요"}</p>
      </div>
      {state.kind !== "done" && (
        <HoldButton onStart={locate} onComplete={finish} onShort={() => setHint(true)} disabled={busy}
          label={locating ? "위치 확인 중" : pending ? "도장 찍는 중" : state.kind === "idle" ? "꾹 눌러 도장 받기" : "다시 꾹 눌러 받기"} />
      )}
    </section>
  );
}
