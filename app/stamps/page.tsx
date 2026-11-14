/* S11 도장 : 도장 모으기는 3단계 기능이라 1단계는 빈 상태만. 4단계에 이 탭 안에 "내 장소 지도" 가 들어온다 */
import { EmptyState } from "@/components/kit";
import { AppShell, MainTabs } from "@/components/screen";
import { GateCta } from "@/components/gate";

export const metadata = { title: "도장" };

export default function Stamps() {
  return (
    <AppShell>
      <header className="px-5 pt-6">
        <h1 className="text-title-xl font-extrabold text-ink">도장</h1>
        <p className="mt-1 text-sub text-ink-sub">다녀온 곳마다 도장이 하나씩 찍혀요</p>
      </header>
      <div className="flex flex-col gap-4 px-5 pt-5">
        <EmptyState title="아직 모은 도장이 없어요" desc="여행을 다녀오면 도시마다 도장이 찍혀요. 도장 모으기는 곧 열려요"
          action={<GateCta href="/trips/new">여행 만들기</GateCta>} />
        {/* 모은 도장이 없을 때는 빈 상태만 (도장 칸 예시는 보이지 않게, 2026-11-14 마루님) */}
      </div>
      <MainTabs active="도장" />
    </AppShell>
  );
}
