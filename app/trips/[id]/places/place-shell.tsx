/* 장소 추가/수정 화면의 머리 (뒤로 + 제목) */
import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/kit";
import { AppShell } from "@/components/screen";

export function PlaceShell({ title, back, children }: { tripId: string; title: string; back: string; children: ReactNode }) {
  return (
    <AppShell bottomGap={false}>
      <div className="flex items-center gap-2 px-5 pt-4">
        <Link href={back} aria-label="일정으로" className="press flex size-11 items-center justify-center rounded-full bg-surface text-ink">
          <Icon name="back" size={20} />
        </Link>
        <h1 className="text-title-lg font-extrabold text-ink">{title}</h1>
      </div>
      {children}
    </AppShell>
  );
}
