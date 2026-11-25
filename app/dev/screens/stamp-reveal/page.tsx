/* 도장 받는 창 시안 화면 (0.103.0 여권에서 카드 꺼내기) : ?tier=4 , ?full=1 이면 다 모은 도시 */
import { notFound } from "next/navigation";
import { RevealPreview } from "./preview";

export default async function Page({ searchParams }: { searchParams: Promise<{ tier?: string; full?: string }> }) {
  if (process.env.NODE_ENV === "production" && process.env.SHOW_DEV_KIT !== "1") notFound();
  const q = await searchParams;
  return <RevealPreview tier={Number(q.tier ?? 4)} full={q.full === "1"} />;
}
