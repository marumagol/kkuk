/* 없는 주소 */
import Link from "next/link";
import { AppShell } from "@/components/screen";

export const metadata = { title: "찾을 수 없어요" };

export default function NotFound() {
  return (
    <AppShell bottomGap={false}>
      <div className="px-5 pt-16">
        <div className="flex flex-col items-center gap-3 rounded-card bg-surface px-6 py-8 text-center">
          <h1 className="text-title font-bold text-ink">찾을 수 없는 화면이에요</h1>
          <p className="text-sub text-ink-sub">주소가 바뀌었거나 없어진 화면일 수 있어요</p>
          <Link href="/" className="press mt-2 inline-flex h-11 items-center rounded-btn bg-btn px-5 text-sub font-bold text-on-btn">홈으로</Link>
        </div>
      </div>
    </AppShell>
  );
}
