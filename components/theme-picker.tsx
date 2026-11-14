"use client";
/* 설정 > 화면 모드. 고른 값은 쿠키(kkuk-theme)에 두고, app/layout.tsx 가 <html data-theme> 로 읽는다 (새로 열어도 깜빡임 없음) */
import { useState } from "react";

export type Theme = "system" | "light" | "dark";
const OPTIONS: { value: Theme; label: string }[] = [
  { value: "system", label: "기기 설정" }, { value: "light", label: "라이트" }, { value: "dark", label: "다크" },
];

export function ThemePicker({ initial }: { initial: Theme }) {
  const [theme, setTheme] = useState<Theme>(initial);
  function pick(t: Theme) {
    setTheme(t);
    const root = document.documentElement;
    if (t === "system") { delete root.dataset.theme; document.cookie = "kkuk-theme=; path=/; max-age=0"; }
    else { root.dataset.theme = t; document.cookie = `kkuk-theme=${t}; path=/; max-age=31536000; samesite=lax`; }
  }
  return (
    <div role="radiogroup" aria-label="화면 모드" className="grid grid-cols-3 gap-1 rounded-btn bg-surface-soft p-1">
      {OPTIONS.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={theme === o.value} onClick={() => pick(o.value)}
          className={`press h-11 rounded-[10px] text-sub font-bold ${theme === o.value ? "bg-surface text-ink shadow-sm" : "text-ink-sub"}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
