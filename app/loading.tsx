/* 화면을 불러오는 동안 (인터넷이 느릴 때 빈 화면 대신). 머리줄 + 카드 몇 줄 뼈대 */
import { AppShell, Skel } from "@/components/screen";

export default function Loading() {
  return (
    <AppShell>
      <div role="status" aria-label="불러오는 중" className="flex flex-col gap-4 px-5 pt-4">
        <div className="flex items-center justify-between">
          <Skel className="size-11 rounded-full" />
          <Skel className="size-11 rounded-full" />
        </div>
        <Skel className="h-8 w-48 rounded-full" />
        <Skel className="h-40 w-full rounded-card" />
        {Array.from({ length: 3 }, (_, i) => <Skel key={i} className="h-[76px] w-full rounded-pin" />)}
      </div>
    </AppShell>
  );
}
