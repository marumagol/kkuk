"use client";
/* 인터넷이 끊기면 화면 위에 안내를 띄운다 (S14 공통 상태). 다시 연결되면 사라진다 */
import { useEffect, useState } from "react";
import { OfflineBar } from "@/components/kit";

export function NetworkBanner() {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    setOffline(!navigator.onLine);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  if (!offline) return null;
  return (
    <div className="fixed inset-x-0 top-0 z-40 mx-auto w-full max-w-[430px] px-5 pt-[max(12px,env(safe-area-inset-top))]">
      <OfflineBar />
    </div>
  );
}
