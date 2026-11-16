/*
  핀모리 공통 조각 (디자인-가이드.md 기준)
  모든 화면은 이 조각과 globals.css 토큰으로 만든다. 색 값을 직접 쓰지 않는다.
  서버/클라이언트 어디서나 import 할 수 있게 상태(useState)는 넣지 않았다.
*/
import { FEATURES } from "@/lib/features";
import type { ReactNode, ButtonHTMLAttributes, InputHTMLAttributes } from "react";
import Link from "next/link";
import { blobPath, stampArt } from "@/lib/stamp-art";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/* ---------- 아이콘 (선 1.75, 둥근 끝) ---------- */
type IconName =
  | "plus" | "bell" | "home" | "cal" | "map" | "user" | "arrow" | "camera"
  | "clock" | "won" | "wifi-off" | "lock" | "grip" | "x" | "back" | "right" | "refresh" | "image" | "alert" | "stamp" | "pencil" | "gear" | "sun" | "moon" | "device" | "check" | "book" | "link" | "heart" | "chat" | "send" | "users" | "up" | "pin" | "share" | "list" | "globe" | "trash" | "plane" | "more" | "chevron-down";
const PATHS: Record<IconName, ReactNode> = {
  plus: <path d="M12 5v14M5 12h14" />,
  bell: <><path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 7H4c0-1 2-2 2-7z" /><path d="M10 19a2 2 0 0 0 4 0" /></>,
  home: <path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1v-8z" />,
  cal: <><rect x="4" y="5" width="16" height="15" rx="2.5" /><path d="M4 10h16M8 3v4M16 3v4" /></>,
  map: <><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z" /><path d="M9 4v14M15 6v14" /></>,
  book: <><path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5z" /><path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3" /><path d="M9 7.5h6" /></>,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  moon: <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />,
  device: <><rect x="7" y="2.5" width="10" height="19" rx="2.5" /><path d="M11 18.5h2" /></>,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>,
  user: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" /></>,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  camera: <><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></>,
  clock: <><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></>,
  won: <><path d="M4 7l3 10 3-8 2 0 3 8 3-10" /><path d="M3 11h18" /></>,
  "wifi-off": <><path d="M3 3l18 18" /><path d="M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 5-2.7M14 10.3A10 10 0 0 1 19 13M2 9.5a15 15 0 0 1 4.5-2.8M12 20h.01" /></>,
  lock: <><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
  grip: <><path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01" /></>,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  pencil: <path d="M4 20h4L18.5 9.5a2.12 2.12 0 0 0-3-3L5 17v3zM13.5 7.5l3 3" />,
  back: <path d="M15 5l-7 7 7 7" />,
  right: <path d="M9 5l7 7-7 7" />,
  refresh: <><path d="M20 12a8 8 0 1 1-2.3-5.6" /><path d="M20 4v4h-4" /></>,
  image: <><rect x="4" y="5" width="16" height="14" rx="2.5" /><circle cx="9" cy="10" r="1.5" /><path d="M20 16l-5-5-7 8" /></>,
  alert: <><circle cx="12" cy="12" r="8" /><path d="M12 8v5M12 16h.01" /></>,
  trash: <><path d="M4 7h16" /><path d="M9 7V4.5h6V7" /><path d="M6.5 7l1 12.5h9l1-12.5" /><path d="M10 11v5M14 11v5" /></>,
  share: <><path d="M12 15V4" /><path d="m7.5 8.5 4.5-4.5 4.5 4.5" /><path d="M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" /></>,
  list: <><path d="M9 6h11M9 12h11M9 18h11" /><path d="M4.5 6h.01M4.5 12h.01M4.5 18h.01" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18" /></>,
  link: <><path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1" /><path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" /></>,
  heart: <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />,
  chat: <path d="M20 11.5a7.5 7.5 0 0 1-11.2 6.5L4 19.5l1.4-4.3A7.5 7.5 0 1 1 20 11.5z" />,
  send: <><path d="M20 4 10.5 13.5" /><path d="M20 4l-6 16-3.5-6.5L4 10z" /></>,
  users: <><circle cx="9" cy="8.5" r="3" /><path d="M3.5 19c0-3 2.4-5 5.5-5s5.5 2 5.5 5" /><path d="M15.5 6a3 3 0 0 1 0 5.5M17 14.3c2.1.6 3.5 2.3 3.5 4.7" /></>,
  up: <path d="M12 19V5M6 11l6-6 6 6" />,
  "chevron-down": <path d="M6 9l6 6 6-6" />,
  more: <><circle cx="5" cy="12" r="1.4" fill="currentColor" /><circle cx="12" cy="12" r="1.4" fill="currentColor" /><circle cx="19" cy="12" r="1.4" fill="currentColor" /></>,
  plane: <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />,
  pin: <><path d="M12 21s-6-5.6-6-10.5a6 6 0 1 1 12 0C18 15.4 12 21 12 21z" /><circle cx="12" cy="10.5" r="2" /></>,
  stamp: <><circle cx="12" cy="12" r="8.5" strokeDasharray="3 2.6" /><circle cx="12" cy="12" r="4.5" /></>,
};
export function Icon({ name, size = 22, className, strokeWidth = 1.75 }: { name: IconName; size?: number; className?: string; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}

/* 핀 (시그니처). 주황 물방울 + 가운데 구멍 */
export function Pin({ size = 20, tone = "point", className }: { size?: number; tone?: "point" | "light" | "muted"; className?: string }) {
  const fill = tone === "point" ? "var(--point)" : tone === "light" ? "var(--on-deep)" : "var(--ink-sub)";
  const hole = tone === "light" ? "var(--deep)" : "var(--surface)";
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M12 22s7-7.1 7-12a7 7 0 1 0-14 0c0 4.9 7 12 7 12z" fill={fill} />
      <circle cx="12" cy="10" r="2.6" fill={hole} />
    </svg>
  );
}

/* ---------- 버튼 ---------- */
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
  size?: "lg" | "md";
  icon?: IconName;
  full?: boolean;
};
export function Button({ variant = "primary", size = "lg", icon, full, className, children, ...rest }: BtnProps) {
  return (
    <button
      {...rest}
      className={cx(
        "press inline-flex items-center justify-center gap-2 font-bold rounded-btn disabled:cursor-not-allowed",
        size === "lg" ? "h-14 px-5 text-[16px]" : "h-11 px-4 text-sub",
        variant === "primary" && "bg-btn text-on-btn disabled:bg-surface-soft disabled:text-ink-sub",
        variant === "secondary" && "bg-surface text-ink border border-line-strong disabled:text-ink-sub",
        variant === "ghost" && "bg-transparent text-ink underline-offset-4 hover:underline",
        full && "w-full",
        className,
      )}
    >
      {children}
      {icon && <Icon name={icon} size={20} />}
    </button>
  );
}

/* 동그란 아이콘 버튼 (알림 등). 터치 영역 44px */
export function IconButton({ icon, label, tone = "surface" }: { icon: IconName; label: string; tone?: "surface" | "point" }) {
  return (
    <button aria-label={label}
      className={cx("press inline-flex size-11 items-center justify-center rounded-full",
        tone === "surface" ? "bg-surface text-ink" : "bg-point text-white")}>
      <Icon name={icon} size={tone === "point" ? 24 : 20} strokeWidth={tone === "point" ? 2.5 : 1.75} />
    </button>
  );
}

/* 일정 화면 오른쪽 아래 떠 있는 "장소 추가". 주황 위 흰 글자는 대비가 낮아서 짙은 바탕 + 주황 핀 */
export function FloatingPinButton() {
  return (
    <button className="press inline-flex h-12 items-center gap-2 rounded-full bg-btn pl-4 pr-5 text-sub font-bold text-on-btn shadow-float">
      <Pin size={20} /> 장소 추가
    </button>
  );
}

/* ---------- 칩 ---------- */
export type Category = "이동" | "식사" | "관광" | "쇼핑" | "숙소" | "메모";
const CAT: Record<Category, string> = {
  이동: "bg-surface-soft text-ink",
  식사: "bg-warn-soft text-warn-text",
  관광: "bg-ok-soft text-ok-text",
  쇼핑: "bg-point-soft text-point-text",
  숙소: "bg-accent-soft text-accent-text",
  메모: "border border-line-strong/50 bg-surface text-ink-sub",
};
export function Chip({ children, tone = "soft", selected, size = "sm" }: {
  children: ReactNode; tone?: "soft" | "surface" | "point" | "accent" | "warn" | "ok" | "deep"; selected?: boolean; size?: "sm" | "md";
}) {
  const t = selected ? "bg-btn text-on-btn" : {
    soft: "bg-surface-soft text-ink", surface: "bg-surface text-ink", point: "bg-point-soft text-point-text",
    accent: "bg-accent-soft text-accent-text", warn: "bg-warn-soft text-warn-text", ok: "bg-ok-soft text-ok-text",
    deep: "bg-deep-soft text-on-deep",
  }[tone];
  return (
    <span className={cx("inline-flex items-center whitespace-nowrap rounded-full font-semibold",
      size === "sm" ? "h-7 px-2.5 text-tiny" : "h-11 px-4 text-sub", t)}>
      {children}
    </span>
  );
}
export function CategoryChip({ category }: { category: Category }) {
  return <span className={cx("inline-flex h-7 items-center rounded-full px-2.5 text-tiny font-semibold", CAT[category])}>{category}</span>;
}

/* ---------- 카드 ---------- */
export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cx("rounded-card bg-surface p-4", className)}>{children}</section>;
}

/* 내 장소 / 모은 도장 같은 숫자 타일 */
export function StatTile({ label, value, caption, tone, icon }: { label: string; value: string; caption: string; tone: "point" | "accent" | "stamp"; icon: ReactNode }) {
  return (
    <div className={cx("flex-1 rounded-card p-4", tone === "point" ? "bg-point-soft" : tone === "stamp" ? "bg-stamp-soft" : "bg-accent-soft")}>
      <div className="flex items-center justify-between">
        <span className={cx("text-sub font-bold", tone === "accent" ? "text-accent-text" : "text-point-text")}>{label}</span>
        {icon}
      </div>
      <div className="mt-1 text-number font-extrabold text-ink">{value}</div>
      <div className="text-tiny text-ink">{caption}</div>
    </div>
  );
}

/* 일정의 장소 카드 (피그마 PinCard) */
export function PinCard({ index, mark, time, category, title, desc, detail, editedBy, last, href, photo, photoCount, warn, corner }: {
  index: number; mark?: "plane" | "dot"; /* 비행기(공항, 항공) / 점(메모) : 번호 대신 (2026-11-16) */ time?: string; category: Category; title: string; desc?: string; detail?: string; editedBy?: string; last?: boolean; href?: string; photo?: string; photoCount?: number;
  warn?: string /* 영업시간 경고 */; corner?: ReactNode /* 오른쪽 위 작은 버튼 (길찾기). 링크 밖에 겹쳐 두어 따로 눌린다 (2026-11-16 마루님 "카드가 길어지지 않게") */;
}) {
  const Box = ({ children }: { children: ReactNode }) => {
    const inner = href ? <Link href={href} className="press block px-4 py-3.5">{children}</Link> : <div className="px-4 py-3.5">{children}</div>;
    return <article className="relative mb-3 min-w-0 flex-1 overflow-hidden rounded-pin bg-surface">{inner}{corner && <div className="absolute right-2.5 top-2.5">{corner}</div>}</article>;
  };
  return (
    <div className="flex gap-3">
      <div className="flex w-7 flex-none flex-col items-center gap-1 pt-3.5">
        {mark === "plane" ? <span className="flex size-7 items-center justify-center rounded-full bg-deep text-on-deep"><Icon name="plane" size={15} strokeWidth={2} /></span>
          : mark === "dot" ? <span className="mt-2.5 size-2.5 rounded-full bg-ink-sub" />
          : index > 0 ? <span className="flex size-7 items-center justify-center rounded-full bg-point text-tiny font-extrabold text-white ring-2 ring-surface">{index}</span> /* 지도 핀과 같은 주황 (2026-11-16 마루님) */
          : <span className="mt-2 size-3 rounded-full border-2 border-line-strong bg-surface" />}
        {!last && <span className="w-0 flex-1 border-l-2 border-dashed border-line-strong/60" />}
      </div>
      <Box>
        <div className={"flex min-h-7 items-center justify-between gap-2 " + (corner ? "pr-9" : "")}>
          <div className="flex items-center gap-2">
            {time && <span className="text-sub font-bold text-ink">{time}</span>}
            {category !== "메모" && <CategoryChip category={category} />}
          </div>
          {editedBy && <span className="text-tiny font-bold text-point-text">{editedBy}님이 고쳤어요</span>}
        </div>
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            {/* 메모 (2026-11-16) : 제목 없이 글 한 칸. 예전 메모(글이 제목으로 시작하지 않음)만 제목을 따로 보인다 */}
            {(category !== "메모" || !desc || !desc.startsWith(title)) && <h3 className="mt-1.5 line-clamp-2 text-[16px] font-bold leading-snug text-ink">{title}</h3>}
            {detail && <p className="mt-1 line-clamp-2 text-tiny font-semibold text-ink">{detail}</p>}
            {warn && <p className="mt-1 flex items-center gap-1 text-tiny font-bold text-point-text"><Icon name="alert" size={14} />{warn}</p>}
            {desc && <p className={category === "메모" ? "mt-1.5 line-clamp-4 whitespace-pre-line text-body text-ink" : "mt-0.5 line-clamp-1 text-tiny text-ink-sub"}>{desc}</p>}
          </div>
          {photo && (
            <span className="relative mt-1.5 flex-none">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo} alt="" width={56} height={56} loading="lazy" className="size-14 rounded-field object-cover" />
              {(photoCount ?? 0) > 1 && <span className="absolute bottom-1 right-1 rounded-full bg-black/60 px-1.5 text-[11px] font-bold leading-4 text-white">{photoCount}</span>}
            </span>
          )}
        </div>
      </Box>
    </div>
  );
}

/* ---------- 입력칸 ---------- */
export function Field({ label, hint, error, icon, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string; icon?: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-2">
      <span className="text-sub font-bold text-ink-sub">{label}</span>
      <span className={cx(
        "flex h-14 items-center gap-2.5 rounded-field border bg-surface px-4",
        "focus-within:border-ink focus-within:ring-2 focus-within:ring-ink/15",
        error ? "border-point-text" : "border-line-strong",
        rest.disabled && "bg-surface-soft",
      )}>
        {icon}
        <input {...rest}
          className="w-full min-w-0 flex-1 bg-transparent text-body text-ink outline-none placeholder:text-ink-sub disabled:text-ink-sub"
          aria-invalid={!!error} />
      </span>
      {error ? <span className="text-tiny font-semibold text-point-text">{error}</span>
        : hint ? <span className="text-tiny text-ink-sub">{hint}</span> : null}
    </label>
  );
}

/* ---------- 입력 묶음 카드 (여행 만들기, 수정) : 제목 한 줄 + 설명 + 내용 ---------- */
export function FormCard({ step, title, desc, aside, children }: { step?: number; title?: string; desc?: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3.5 rounded-card bg-surface p-4">
      {title && (
        <header className="flex items-start gap-2.5">
          {step && <span className="mt-px flex size-6 flex-none items-center justify-center rounded-full bg-deep text-tiny font-extrabold text-on-deep">{step}</span>}
          <div className="min-w-0 flex-1">
            <h2 className="text-body font-bold text-ink">{title}</h2>
            {desc && <p className="mt-0.5 text-tiny text-ink-sub">{desc}</p>}
          </div>
          {aside}
        </header>
      )}
      {children}
    </section>
  );
}

/* ---------- 아래 시트 ---------- */
export function Sheet({ title, badge, children, footer, inline }: { title: string; badge?: ReactNode; children: ReactNode; footer?: ReactNode; inline?: boolean }) {
  return (
    <div role="dialog" aria-label={title}
      className={cx("flex flex-col gap-4 rounded-t-[28px] bg-bg px-5 pb-6 pt-2.5", !inline && "fixed inset-x-0 bottom-0 shadow-float")}>
      <span className="mx-auto h-1.5 w-10 rounded-full bg-line-strong/50" />
      <div className="flex items-center justify-between">
        <h2 className="text-title-lg font-extrabold text-ink">{title}</h2>
        {badge}
      </div>
      {children}
      {footer}
    </div>
  );
}

/* ---------- 도장 (마루님 "삿포로 도장" 기준, 디자인-가이드 2-1) ---------- */
const BLOB_IN = blobPath(43, 43, 37.75);
const BLOB_OUT = blobPath(43, 43, 42.5);
export function StampFace({ name, country, earned = true, size = 86 }: { name: string; country?: string | null; earned?: boolean; size?: number }) {
  const art = stampArt(country, name);
  return (
    <svg viewBox="0 0 86 86" width={size} height={size} aria-hidden="true" className="block"
      style={{ ["--stamp-hole" as string]: earned ? "#FF5A36" : "var(--color-bg)" }}>
      <path d={BLOB_OUT} fill="none" stroke={earned ? "#FF5A36" : "var(--color-line-strong)"} strokeWidth={1} strokeDasharray="2 2" />
      {earned && <path d={BLOB_IN} fill="#FF5A36" />}
      {art ? (
        <g color={earned ? "#FFFFFF" : "var(--color-line-strong)"} opacity={earned ? 1 : 0.5} dangerouslySetInnerHTML={{ __html: art }} />
      ) : earned ? (
        <text x="43" y="43" textAnchor="middle" dominantBaseline="central" fill="#FFFFFF" fontWeight={800}
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

/* ---------- 탑승권 카드 (다가오는 여행) ---------- */
export function TicketCard({ dday, title, period, stops, pinCount, ready, members }: {
  dday: string; title: string; period: string; stops: string[]; pinCount: number; ready?: number; members: { initial: string; tone: "point" | "accent"; avatar?: string }[];
}) {
  return (
    <article className="relative overflow-hidden rounded-deep bg-deep text-on-deep">
      <div className="flex flex-col gap-3.5 px-5 pb-4 pt-5">
        <div className="flex items-center justify-between">
          <Chip tone="deep">다가오는 여행</Chip>
          <div className="flex -space-x-1.5">
            {members.map((m, i) => m.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={m.avatar} alt="" width={32} height={32} className="size-8 rounded-full border-2 border-deep object-cover" />
            ) : (
              <span key={i} className={cx("flex size-8 items-center justify-center rounded-full border-2 border-deep text-tiny font-bold",
                m.tone === "point" ? "bg-point-soft text-point-text" : "bg-accent-soft text-accent-text")}>{m.initial}</span>
            ))}
          </div>
        </div>
        <div>
          <div className="text-dday font-extrabold tracking-tight">{dday}</div>
          <div className="mt-1 text-title font-bold">{title}</div>
          <div className="text-tiny text-on-deep-sub">{period}</div>
        </div>
        <ol className="flex items-start" aria-label="도시 경로">
          {stops.map((s, i) => (
            <li key={s} className={cx("flex items-start", i < stops.length - 1 && "flex-1")}>
              <span className="flex flex-col items-center gap-1">
                <Pin size={18} tone={i === 0 ? "point" : "light"} />
                <span className="whitespace-nowrap text-tiny font-semibold">{s}</span>
              </span>
              {i < stops.length - 1 && <span className="mx-1.5 mt-2 flex-1 border-t-2 border-dashed border-on-deep/35" />}
            </li>
          ))}
        </ol>
      </div>
      {/* 절취선 + 양쪽 반원 홈 (처음 컨셉 유지) */}
      <div className="relative px-5" aria-hidden="true">
        <span className="absolute -left-2.5 -top-2.5 size-5 rounded-full bg-bg" />
        <span className="absolute -right-2.5 -top-2.5 size-5 rounded-full bg-bg" />
        <div className="border-t-2 border-dashed border-on-deep/25" />
      </div>
      <div className="flex flex-col gap-2 px-5 pb-5 pt-4">
        {/* 준비 % 는 2단계(준비 탭) 기능이라 값이 있을 때만 */}
        {ready != null && (
          <div className="h-1.5 overflow-hidden rounded-full bg-deep-soft" role="progressbar" aria-valuenow={ready} aria-valuemin={0} aria-valuemax={100} aria-label="준비">
            <div className="h-full rounded-full bg-point" style={{ width: `${ready}%` }} />
          </div>
        )}
        <div className="flex justify-between text-tiny">
          <span className="text-on-deep-sub">장소 {pinCount}개</span>
          {ready != null && <span className="font-bold">준비 {ready}%</span>}
        </div>
      </div>
    </article>
  );
}

/* ---------- 빈 상태 / 오프라인 띠 / 뼈대 ---------- */
export function EmptyState({ title, desc, action }: { title: string; desc: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-card bg-surface px-6 py-8 text-center">
      <div className="relative flex size-20 items-center justify-center rounded-full bg-point-soft">
        <Pin size={40} />
        <span className="absolute bottom-3 h-1.5 w-8 rounded-full bg-point/25" />
      </div>
      <h3 className="text-title font-bold text-ink">{title}</h3>
      <p className="text-sub text-ink-sub">{desc}</p>
      {action}
    </div>
  );
}
export function OfflineBar() {
  return (
    <div role="status" className="flex items-center gap-2 rounded-field bg-warn-soft px-4 py-3 text-sub font-semibold text-warn-text">
      <Icon name="wifi-off" size={18} /> 인터넷이 끊겼어요. 열어 본 화면은 볼 수 있고, 저장은 연결된 뒤에 해 주세요
    </div>
  );
}
export function SkeletonPinCard() {
  return (
    <div className="flex gap-3" aria-hidden="true">
      <span className="mt-3.5 size-7 flex-none animate-pulse rounded-full bg-surface-soft" />
      <div className="flex-1 rounded-pin bg-surface px-4 py-3.5">
        <div className="h-4 w-24 animate-pulse rounded-full bg-surface-soft" />
        <div className="mt-2.5 h-5 w-44 animate-pulse rounded-full bg-surface-soft" />
        <div className="mt-2 h-3.5 w-32 animate-pulse rounded-full bg-surface-soft" />
      </div>
    </div>
  );
}

/* ---------- 하단 탭 (떠 있는 알약) ---------- */
/* 2026-11-14 : "지도" 탭을 "도장" 으로 (마루님 결정. 지도는 4단계라 아직 없음) */
/* 하단 탭 5개 : 홈/여행/일기/도장/설정. 가운데 + 는 뺐음 (2026-11-14 마루님) */
/* 2026-11-15 마루님 : 도장은 여행 탭 안으로 합침 (아래 탭 4칸). 도장 화면에서는 여행 탭이 켜진다 */
export function TabBar({ active: asked = "홈" }: { active?: "홈" | "여행" | "일기" | "도장" | "설정" }) {
  const active = asked;
  // 도장은 따로 탭 (2026-11-16 마루님 "도장을 새로운 탭 메뉴로")
  const tabs: { name: "홈" | "여행" | "일기" | "도장" | "설정"; icon: IconName; href: string }[] = [
    { name: "홈", icon: "home", href: "/" }, { name: "여행", icon: "cal", href: "/trips" }, { name: "일기", icon: "book", href: "/diary" },
    { name: "도장", icon: "stamp", href: "/stamps" }, { name: "설정", icon: "gear", href: "/me" },
  ].filter((t) => FEATURES.diary || t.name !== "일기") as typeof tabs;
  const item = (t: (typeof tabs)[number]) => (
    <Link key={t.name} href={t.href} aria-label={t.name} aria-current={active === t.name ? "page" : undefined}
      className={cx("press flex h-[52px] items-center justify-center gap-1.5 rounded-full",
        active === t.name ? "bg-deep-soft px-4 text-on-deep" : "w-[54px] text-on-deep-sub")}>
      <Icon name={t.icon} size={22} strokeWidth={1.85} />
      {active === t.name && <span className="text-sub font-bold">{t.name}</span>}
    </Link>
  );
  return (
    <nav className="mx-auto flex w-fit items-center gap-0.5 rounded-bar bg-deep p-2 shadow-float" aria-label="하단 메뉴">
      {tabs.map(item)}
    </nav>
  );
}
