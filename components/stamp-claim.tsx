"use client";
/* 도장 받기 (3단계 2) : 여행 중인 여행에서만 보인다
   0.90.0 : 위치는 휴대폰 안에서만 쓴다 (기획/17). 여행 도시 좌표·반경을 받아 여기서 거리를 재고, 도시 안이면 도시 이름만 서버에 보낸다
   0.87.1 : 게이지가 다 차면 대기 문구 없이 바로 등장 연출(stamp-reveal)이 뜨고, 서버 답이 오면 도장이 찍힌다
   0.86.1 : 버튼을 0.8초 꾹 누르면 게이지가 차고 도장이 찍힌다. 짧게 떼면 안내만. 키보드(Enter, Space)는 바로 받는다 */
import { useRef, useState, useTransition } from "react";
import { HoldButton } from "@/components/hold-button";
import dynamic from "next/dynamic";
import { Icon } from "@/components/kit";
import { claimStampCity, loadStampTargets, type ClaimResult, type StampTarget } from "@/app/actions";
import { safeCall } from "@/lib/safe-call";

/* 도장 그림과 받는 연출(여권, 카드)은 무거워서 꾹 누르기 시작할 때 미리 불러온다 (2026-11-25 전수 점검, 일정 화면 첫 로드 줄이기) */
const loadReveal = () => import("@/components/stamp-reveal");
const StampReveal = dynamic(() => loadReveal().then((m) => m.StampReveal), { ssr: false });
const StampFace = dynamic(() => import("@/components/stamp-face").then((m) => m.StampFace), { ssr: false });

type State = { kind: "idle" } | { kind: "denied" } | { kind: "error"; text: string } | { kind: "done"; r: Extract<ClaimResult, { ok: true }> };

export function StampClaim({ tripId, city, inset = true }: { tripId: string; city?: string; inset?: boolean }) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const [locating, setLocating] = useState(false);
  const [pending, start] = useTransition();
  const busy = locating || pending;

  const [hint, setHint] = useState(false);
  const [reveal, setReveal] = useState(false);
  const pos = useRef<GeolocationPosition | "fail" | null>(null);
  const waiting = useRef(false);

  const targets = useRef<Promise<{ targets: StampTarget[] } | { error: string }> | null>(null);

  /* 휴대폰 안에서 가장 가까운 여행 도시를 고른다 (반경 대비 거리). 좌표는 이 함수 밖으로 나가지 않는다 */
  const pick = (list: StampTarget[], p: GeolocationPosition): { city: StampTarget } | { error: string } => {
    if (!list.length) return { error: "이 여행의 도시는 아직 카드가 없어요. 목록에 있는 도시만 카드를 받을 수 있어요" };
    if (p.coords.accuracy > list[0].maxAccuracy) return { error: "위치가 정확하지 않아요. 밖에서 잠시 뒤 다시 눌러 주세요" };
    const near = list.map((c) => ({ c, d: km(p.coords.latitude, p.coords.longitude, c.lat, c.lng) })).sort((a, b) => a.d / a.c.radiusKm - b.d / b.c.radiusKm)[0];
    if (near.d > near.c.radiusKm) return { error: "여행 도시에서 멀리 있어요. 도시 안에서 다시 눌러 주세요" };
    return { city: near.c };
  };

  const claim = (p: GeolocationPosition) => start(async () => {
    /* 0.89.6 : 여행지 느린 인터넷에서 답이 안 오면 연출 화면이 멈춰 있지 않게 20초에서 끊는다. 서버 오류도 안내로 */
    const late = new Promise<{ error: string }>((ok) => setTimeout(() => ok({ error: "응답이 늦어요. 인터넷이 잘 되는 곳에서 다시 꾹 눌러 주세요" }), 20000));
    const run = async (): Promise<ClaimResult | { error: string }> => {
      const t = await safeCall(() => targets.current ?? loadStampTargets(tripId));
      if ("error" in t) return t;
      const got = pick(t.targets, p);
      if ("error" in got) return got;
      return safeCall(() => claimStampCity(tripId, got.city.name, got.city.country));
    };
    const r = await Promise.race([run(), late]).catch(() => ({ error: "도장을 받지 못했어요. 잠시 뒤 다시 꾹 눌러 주세요" }));
    if (!("ok" in r) || !r.ok) { setReveal(false); return setState({ kind: "error", text: r.error }); }
    setState({ kind: "done", r });
  });

  /* 꾹 누르기가 끝났을 때 : 위치가 아직이면 기다렸다가 받는다 */
  const finish = () => {
    const p = pos.current;
    if (p === null) { waiting.current = true; setLocating(true); setReveal(true); return; }
    waiting.current = false; setLocating(false);
    if (p === "fail") return setReveal(false);
    setReveal(true);
    pos.current = null;
    claim(p);
  };

  /* 누르기 시작할 때 위치를 미리 읽는다 */
  const locate = () => {
    setHint(false);
    if (!("geolocation" in navigator)) { setState({ kind: "error", text: "이 기기에서는 위치를 읽을 수 없어요. 위치 기능이 있는 휴대폰에서 다시 열어 주세요" }); return false; }
    pos.current = null; waiting.current = false;
    targets.current = loadStampTargets(tripId).catch(() => ({ error: "도장 정보를 읽지 못했어요. 잠시 뒤 다시 눌러 주세요" }));
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
    ? state.r.status === "already" ? `${state.r.city} 카드는 이 여행에서 이미 받았어요`
      : state.r.status === "again" ? `${state.r.city}에 또 왔어요. ${state.r.visits}번째 방문이에요`
      : `${state.r.city} 카드를 받았어요. 함께하는 사람도 같이 받아요`
    : state.kind === "denied" ? "위치를 허용하면 카드를 받을 수 있어요. 브라우저 설정에서 위치를 켜 주세요"
    : state.kind === "error" ? state.text
    : hint ? "조금 더 꾹 눌러 주세요. 게이지가 다 차면 도장이 찍혀요" : null;

  return (
    <section className={(inset ? "mx-5 mt-4 " : "") + "flex flex-col gap-3 rounded-card bg-surface px-5 pb-5 pt-5"} aria-label="도장 받기">
      {reveal && (
        <StampReveal city={state.kind === "done" ? state.r.city : null} country={state.kind === "done" ? state.r.country : null} visits={state.kind === "done" ? state.r.visits : undefined} card={state.kind === "done" ? state.r.card : null}
          title={state.kind === "done" && state.r.status === "already" ? "이미 받은 카드" : "도장 꾹!"} sub={msg ?? ""} onClose={() => setReveal(false)} />
      )}
      {state.kind === "done" && (
        <div className="flex justify-center">
          <div className={state.r.status === "already" ? "-rotate-6" : "stamp-hit"}>
            <StampFace name={state.r.city} country={state.r.country} size={110} />
          </div>
        </div>
      )}
      {state.kind !== "done" && (
        <>
          {/* 0.89.0 : 막대 버튼 대신 빈 도장 자체를 꾹 누른다. 둘레 링이 차오르면 찍힌다 */}
          <div className="text-center">
            <p className="text-tiny font-bold tracking-wide text-point-text">도장 받기</p>
            <p className="mt-1 text-title font-extrabold text-ink">{city ? `${city} 카드가 기다리고 있어요` : "여행 카드가 기다리고 있어요"}</p>
          </div>
          <div className="flex justify-center py-1">
            <HoldButton ring={132} onStart={() => { void loadReveal(); return locate(); }} onComplete={finish} onShort={() => setHint(true)} disabled={busy}
              holdingLabel={<span className="text-[26px] font-extrabold">꾹</span>}
              label={<><Icon name="stamp" size={30} /><span className="mt-1 text-tiny font-bold">꾹 누르기</span></>} />
          </div>
        </>
      )}
      <p role="status" className={"text-center text-sub " + (msg && state.kind !== "done" ? "text-ink" : "text-ink-sub")}>
        {msg ?? "여행 도시에 도착했다면 도장을 꾹 눌러 주세요"}
      </p>
      {state.kind !== "done" && <p className="-mt-1 text-center text-tiny text-ink-sub">위치는 휴대폰 안에서만 확인하고 서버로 보내거나 저장하지 않아요</p>}
    </section>
  );
}

/* 두 점 사이 거리(km), 구면 근사 */
function km(lat1: number, lng1: number, lat2: number, lng2: number) {
  const r = Math.PI / 180, dLat = (lat2 - lat1) * r, dLng = (lng2 - lng1) * r;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.min(1, Math.sqrt(a)));
}
