"use client";
/*
  일정 실시간 반영 (6단계 2번) : 이 여행의 장소가 바뀌면 화면을 서버에서 다시 읽는다
  - 여러 번 바뀌면 0.8초 모아서 한 번만
  - 화면을 안 보고 있으면(다른 탭) 돌아올 때 한 번
  - 끌어서 순서 바꾸는 중에는 SortablePlaces 가 자기 순서를 지킨다
*/
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function LiveRefresh({ tripId }: { tripId: string }) {
  const router = useRouter();
  const pending = useRef(false);
  useEffect(() => {
    const sb = createClient();
    if (!sb) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      if (document.hidden) { pending.current = true; return; }
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 800);
    };
    const onShow = () => { if (!document.hidden && pending.current) { pending.current = false; router.refresh(); } };
    const ch = sb.channel(`trip-items-${tripId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "itinerary_items", filter: `trip_id=eq.${tripId}` }, refresh)
      .subscribe();
    document.addEventListener("visibilitychange", onShow);
    return () => { clearTimeout(timer); document.removeEventListener("visibilitychange", onShow); sb.removeChannel(ch); };
  }, [tripId, router]);
  return null;
}
