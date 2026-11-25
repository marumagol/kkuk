/*
  도장 그림 (마루님 "삿포로 도장" 기준, 디자인-가이드 2-1)
  kit.tsx 에서 나눴다 (2026-11-25 전수 점검) : 도장 그림 모음 lib/stamp-art.ts 가 커서, 도장을 그리는 화면에서만 불러오게
*/
import { useId } from "react";
import { cx } from "@/components/kit";
import { blobPath, stampArt, stampColor } from "@/lib/stamp-art";

export const BLOB_IN = blobPath(43, 43, 37.75);
export const BLOB_OUT = blobPath(43, 43, 42.5);
/* 0.95.7 rare = 금박 + 갈색 그림 (마루님). 0.95.6 finish : 도장 카드 등급별 도장 색 (마루님 "에픽, 유니크답게, 모으고 싶게")
   epic = 짙은 자수정 그라데이션 + 흰 그림, unique = 오팔 진주(흰빛에 분홍·하늘) + 남색 그림. 카드 바탕(연보라/밤하늘)과 대비되게 */
const FINISH = {
  rare: { stops: ["#F6D27A", "#C8902E", "#7A4F14", "#E6B95A"], ring: "#8A5F1E", edge: "#FFF1B8", art: "#FFF8E1" },
  epic: { stops: ["#1E1466", "#4A22A8", "#8B2F9E"], ring: "#4A22A8", edge: "#D9B8FF", art: "#FFFFFF" },
  royal: { stops: ["#063D30", "#0B6E52", "#17A37A"], ring: "#0B6E52", edge: "#C8F5E2", art: "#FFFFFF" },
  opal: { stops: ["#F2F7FF", "#F6D9F1", "#D6E6FF", "#FFF1D8"], ring: "#A9C8F0", edge: "#FFFFFF", art: "#0C1B3A" },
  coral: { stops: ["#7A2E3A", "#C94F4A", "#F2905E"], ring: "#C94F4A", edge: "#FFD9C7", art: "#FFFFFF" },
  silver: { stops: ["#E2E7ED", "#8C96A3", "#4A5360", "#B9C1CC"], ring: "#5E6875", edge: "#FFFFFF", art: "#FFFFFF" },
  crystal: { stops: ["#3D64C4", "#6E8FE8", "#A08AE6", "#5FB8E0", "#8FA8F2"], ring: "#6E8FE8", edge: "#FFFFFF", art: "#FFFFFF" },
  sapphire: { stops: ["#081650", "#163FAE", "#3F74E0"], ring: "#1F4FC2", edge: "#D6E4FF", art: "#FFFFFF" },
  ruby: { stops: ["#4A0619", "#A3122F", "#D93A5A"], ring: "#B8183E", edge: "#FFD6DE", art: "#FFFFFF" },
  legend: { stops: ["#FF4FA0", "#FF9A3D", "#FFD23D", "#2FCB7A", "#2FA6FF", "#7A5CFF"], ring: "#FFFFFF", edge: "#FFFFFF", art: "#FFFFFF" },
} as const;
export function StampFace({ name, country, earned = true, size = 86, finish }: { name: string; country?: string | null; earned?: boolean; size?: number; finish?: keyof typeof FINISH }) {
  const art = stampArt(country, name);
  const uid = useId().replace(/:/g, "");
  const f = earned && finish ? FINISH[finish] : null;
  const color = f ? `url(#sf${uid})` : stampColor(country); // 나라별 도장 색 (마루님 피그마 "도장 (11.15)")
  return (
    <svg viewBox="0 0 86 86" width={size} height={size} aria-hidden="true" className="block"
      style={{ ["--stamp-hole" as string]: earned ? (f ? f.stops[1] : color) : "var(--color-bg)" }}>
      {f && (
        <defs>
          <linearGradient id={`sf${uid}`} x1="0" y1="0" x2="1" y2="1">
            {f.stops.map((c, i) => <stop key={i} offset={i / (f.stops.length - 1)} stopColor={c} />)}
          </linearGradient>
          <radialGradient id={`sh${uid}`} cx=".32" cy=".26" r=".5"><stop offset="0" stopColor="#fff" stopOpacity=".45" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></radialGradient>
        </defs>
      )}
      <path d={BLOB_OUT} fill="none" stroke={earned ? (f ? f.ring : color) : "var(--color-line-strong)"} strokeWidth={f ? 1.4 : 1} strokeDasharray="2 2" />
      {earned && <path d={BLOB_IN} fill={color} />}
      {f && <path d={BLOB_IN} fill={`url(#sh${uid})`} stroke={f.edge} strokeWidth={0.9} strokeOpacity={0.85} />}
      {art ? (
        <g color={earned ? (f ? f.art : "#FFFFFF") : "var(--color-line-strong)"} opacity={earned ? 1 : 0.5} dangerouslySetInnerHTML={{ __html: art }} />
      ) : earned ? (
        <text x="43" y="43" textAnchor="middle" dominantBaseline="central" fill={f ? f.art : "#FFFFFF"} fontWeight={800}
          fontSize={name.length > 4 ? 10 : 12.5} transform="rotate(-6 43 43)">{name}</text>
      ) : null}
    </svg>
  );
}

export function Stamp({ name, country, date, earned = true, tilt = -6, fluid }: { name: string; country?: string | null; date?: string; earned?: boolean; tilt?: number; fluid?: boolean }) {
  return (
    <div className={cx("flex flex-col items-center gap-1.5 text-center", fluid ? "w-full max-w-[88px]" : "w-[88px]")}>
      <div style={{ transform: earned ? `rotate(${tilt}deg)` : undefined }} className="size-[86px]">
        <StampFace name={name} country={country} earned={earned} />
      </div>
      <span className={cx("text-sub font-semibold", earned ? "text-ink" : "text-ink-sub")}>{name}</span>
      {date && <span className="text-tiny text-ink-sub">{date}</span>}
    </div>
  );
}
