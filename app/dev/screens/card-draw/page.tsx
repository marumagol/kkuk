/* 카드 뽑기 연출 시안 화면 : ?tier=7&f=back|flip|shown */
import { notFound } from "next/navigation";
import { CardDraw } from "@/components/card-draw";
import type { Tier } from "@/lib/card-tier";

export default async function Page({ searchParams }: { searchParams: Promise<{ tier?: string; f?: string }> }) {
  if (process.env.NODE_ENV === "production" && process.env.SHOW_DEV_KIT !== "1") notFound();
  const q = await searchParams;
  const f = q.f === "back" || q.f === "flip" || q.f === "shown" ? q.f : undefined;
  return (
    <main className="fixed inset-0 flex items-center justify-center bg-black/85">
      <CardDraw name="후쿠오카" country="JP" tier={Number(q.tier ?? 7) as Tier} date="26.11.20" freeze={f} onClose={undefined} />
    </main>
  );
}
