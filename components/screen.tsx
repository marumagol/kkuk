/*
  화면 틀 조각 (홈, 일정, 도감에서 같이 쓴다)
  - 앱 폭은 최대 560px (2026-11-15 마루님 : PC 에서 430 은 좁음). PC 에서도 가운데 한 줄로 보인다
  - 색 값은 직접 쓰지 않고 globals.css 토큰만 쓴다
*/
import type { ReactNode } from "react";
import Link from "next/link";
import { Icon, Pin, Button } from "@/components/kit";
import { flagOf } from "@/lib/countries";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/* 서비스 이름은 여기 한 곳에서만 바꾼다. 2026-11-25 KKuK → 트립추얼 (영문 Triptual, Trip + Ritual). 영문 대문자 표기는 BRAND_EN */
export const BRAND = "트립추얼";
export const BRAND_EN = "TRIPTUAL";
export const SLOGAN = "나의 여행이 쌓이는 곳";
/* 운영 주소 (공유 카드 그림 주소의 기준). 2026-11-25 triptual-app.vercel.app */
export const SITE_URL = "https://triptual-app.vercel.app";

export type ScreenState = "ok" | "empty" | "loading" | "error";
export const readState = (v: string | string[] | undefined): ScreenState =>
  v === "empty" || v === "loading" || v === "error" ? v : "ok";

export function AppShell({ children, bottomGap = true }: { children: ReactNode; bottomGap?: boolean }) {
  return (
    <main className={cx("mx-auto flex min-h-dvh w-full max-w-[560px] flex-col", bottomGap && "pb-[calc(88px+env(safe-area-inset-bottom))]")}>
      {children}
    </main>
  );
}

/* 화면 아래에 떠 있는 것 (탭바, 장소 추가 버튼). PC 에서도 앱 폭 안에 머문다 */
export function BottomDock({ children, align = "center" }: { children: ReactNode; align?: "center" | "end" }) {
  return (
    <div className={cx("pointer-events-none fixed inset-x-0 z-20 mx-auto flex w-full max-w-[560px] px-5",
      align === "end" ? "bottom-[calc(72px+env(safe-area-inset-bottom))]" : "bottom-0 pb-[max(20px,env(safe-area-inset-bottom))]",
      align === "center" ? "justify-center" : "justify-end")}>
      <div className="pointer-events-auto">{children}</div>
    </div>
  );
}

/* 로고 : 쌓이는 카드 심볼 + 트립추얼 글자 (2026-11-25 A안, 피그마 "트립추얼 로고 (11.25)").
   글자는 테마 글자색을 따라가도록 그림이 아니라 글자로 그린다. 앱 밖에서 쓸 그림은 public/logo.png */
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="6 8 88 88" aria-hidden className="block shrink-0">
      <rect x="17" y="20" width="50" height="64" rx="10" fill="#FFD3C7" transform="rotate(-16 42 52)" />
      <rect x="22" y="20" width="50" height="64" rx="10" fill="#FF9A80" transform="rotate(-6 47 52)" />
      <g transform="rotate(6 54 52)">
        <rect x="29" y="20" width="50" height="64" rx="10" fill="#FF5A36" />
        <path d="M54 64C51 60 45 54 45 46A9 9 0 1 1 63 46C63 54 57 60 54 64Z" fill="#FFFFFF" />
        <circle cx="54" cy="46" r="3.6" fill="#FF5A36" />
      </g>
    </svg>
  );
}

export function Logo({ height = 32 }: { height?: number }) {
  return (
    <span role="img" aria-label={BRAND} className="flex items-center gap-1.5">
      <LogoMark size={height} />
      <span aria-hidden className="font-extrabold leading-none tracking-[-0.02em] text-ink" style={{ fontSize: Math.round(height * 0.66) }}>{BRAND}</span>
    </span>
  );
}

export function Avatar({ initial, tone = "point", size = 40, ring, src }: { initial: string; tone?: "point" | "accent"; size?: number; ring?: boolean; src?: string | null }) {
  // eslint-disable-next-line @next/next/no-img-element
  if (src) return <img src={src} alt="" width={size} height={size} style={{ width: size, height: size }} className={cx("flex-none rounded-full object-cover", ring && "border-2 border-bg")} />;
  return (
    <span style={{ width: size, height: size }}
      className={cx("flex flex-none items-center justify-center rounded-full font-bold",
        size >= 40 ? "text-sub" : "text-tiny", tone === "point" ? "bg-point-soft text-point-text" : "bg-accent-soft text-accent-text", ring && "border-2 border-bg")}>
      {initial}
    </span>
  );
}

/* 얼굴 : 주황/보라 위 흰 글자는 대비가 낮아(3.1 : 1) 옅은 면 + 진한 글자로 */
/* 동그란 뒤로 가기 / 알림 버튼 (터치 44px) */
export function RoundButton({ icon, label }: { icon: "back" | "bell"; label: string }) {
  return (
    <button aria-label={label} className="press flex size-11 items-center justify-center rounded-full bg-surface text-ink">
      <Icon name={icon} size={20} />
    </button>
  );
}

export function SectionTitle({ title, aside, asideTone = "sub" }: { title: string; aside?: string; asideTone?: "sub" | "point" }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="text-title font-bold text-ink">{title}</h2>
      {aside && <span className={cx("text-sub font-semibold", asideTone === "point" ? "text-point-text" : "text-ink-sub")}>{aside}</span>}
    </div>
  );
}

/* 오류 : 무엇이 안 됐는지 + 다시 시도 버튼 하나 */
export function ErrorState({ title, desc }: { title: string; desc: string }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-card bg-surface px-6 py-8 text-center">
      <span className="flex size-16 items-center justify-center rounded-full bg-warn-soft text-warn-text">
        <Icon name="alert" size={30} />
      </span>
      <h3 className="text-title font-bold text-ink">{title}</h3>
      <p className="text-sub text-ink-sub">{desc}</p>
      <Button variant="secondary" size="md" icon="refresh">다시 불러오기</Button>
    </div>
  );
}

/* 뼈대 (로딩). 실제 모양을 닮게 */
export function Skel({ className }: { className: string }) {
  return <span aria-hidden="true" className={cx("block animate-pulse bg-surface-soft", className)} />;
}

/* 사진이 아직 없을 때 (1단계는 사진 없음, 2단계부터) */
export function PhotoThumb({ size = 48 }: { size?: number }) {
  return (
    <span style={{ width: size, height: size }} className="flex flex-none items-center justify-center rounded-field bg-point-soft text-point-text" aria-hidden="true">
      <Icon name="image" size={20} />
    </span>
  );
}

/* 하단 탭 (홈, 여행, 도장, 마이 화면에서). + 는 로그인 문지기를 거친다 */
/* 아래 탭바는 이제 app/layout.tsx 의 GlobalTabs 가 모든 화면에 그린다 (2026-11-15). 예전 자리 표시용으로만 남김 */
export function MainTabs(_: { active: "홈" | "여행" | "카드" | "설정" }) { // eslint-disable-line @typescript-eslint/no-unused-vars
  return null;
}

/* 미리보기(Supabase 연결 전)에서 가짜 여행이 보인다는 표시 */
export function MockNote() {
  return (
    <p className="mx-5 mt-3 rounded-field bg-accent-soft px-3 py-2 text-tiny font-semibold text-accent-text">
      미리보기라 가짜 여행으로 보여 드려요. 저장은 되지 않아요
    </p>
  );
}

/* 여행 목록 한 줄 (여행 탭, 홈의 "다른 여행") */
/* 여행 줄 왼쪽 그림 : 올린 아이콘 > 국기 > 핀 */
/* 디데이 배지 색 : 가까울수록 진하게 (2026-11-14 마루님). hot = 여행 중, D-7 이내 / near = D-30 이내 / far = 그보다 멀리 */
export type BadgeTone = "hot" | "near" | "far";
const BADGE: Record<BadgeTone, string> = {
  hot: "bg-[#C23A18] text-white",
  near: "bg-point-soft text-point-text",
  far: "bg-ink/10 text-ink", // 2026-11-17 마루님 "너무 흐려" : 카드 바탕과 구분되게 글자색을 10% 깔아 진하게 (다크에서도 같이 맞음)
};

export function TripRow({ href, title, sub, meta, badge, badgeTone = "near", country, icon }: { href: string; title: string; sub: string; meta: string; badge?: string; badgeTone?: BadgeTone; country?: string; icon?: string }) {
  const flag = icon || flagOf(country);
  return (
    <Link href={href} className="press flex min-h-[76px] items-center gap-3 rounded-pin bg-surface px-4 py-3">
      {flag ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={flag} alt="" width={32} height={32} className="mx-1.5 size-8 flex-none rounded-full object-cover ring-1 ring-line" />
      ) : (
        <span className="flex size-11 flex-none items-center justify-center rounded-full bg-point-soft"><Pin size={22} /></span>
      )}
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-2">
          {badge && <span className={`flex-none rounded-full px-2 py-0.5 text-tiny font-bold ${BADGE[badgeTone]}`}>{badge}</span>}
          <span className="truncate text-body font-bold text-ink">{title}</span>
        </span>
        <span className="block truncate text-tiny text-ink-sub">{sub}</span>
        <span className="block truncate text-tiny text-ink-sub">{meta}</span>
      </span>
      <Icon name="right" size={18} className="flex-none text-ink-sub" />
    </Link>
  );
}
