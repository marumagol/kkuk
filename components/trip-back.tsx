"use client";
/*
  여행 화면의 뒤로 버튼 (2026-11-17 마루님 "홈에서 들어왔는데 뒤로 누르면 여행 목록") : 여행에 들어오기 직전 화면으로 돌아간다
  - TripEntryMemo(app/layout.tsx) 가 화면이 바뀔 때마다 "이 여행에 들어오기 전 주소"를 sessionStorage 에 적어 둔다
  - 여행 안(일정, 준비, 경비, 장소 추가 등)끼리 옮겨 다닌 것은 치지 않는다. 기억이 없으면 여행 목록
*/
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/kit";

const KEY = (id: string) => `kkuk:trip-from:${id}`;
const tripIdOf = (path: string) => path.match(/^\/trips\/([0-9a-f-]{36})(\/|$)/i)?.[1] ?? null;
// 돌아갈 곳으로 쓰지 않는 화면 (로그인, 초대처럼 한 번 지나가는 곳)
const SKIP = /^\/(login|welcome|invite|auth|trips\/new)(\/|$)/;

const read = (k: string) => { try { return sessionStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string) => { try { sessionStorage.setItem(k, v); } catch { /* 저장 못 해도 기본값으로 */ } };

/* 레이아웃에 한 번 : 여행 밖 → 여행 안으로 들어올 때 직전 주소를 기억 */
export function TripEntryMemo() {
  const path = usePathname() ?? "/";
  const prev = useRef<string | null>(null);
  useEffect(() => {
    const id = tripIdOf(path);
    const before = prev.current;
    prev.current = path;
    if (!id || before == null) return;
    if (tripIdOf(before) === id) return; // 같은 여행 안에서 옮김
    if (SKIP.test(before)) return;
    write(KEY(id), before);
  }, [path]);
  return null;
}

export function TripBack({ tripId, fallback = "/trips", className }: { tripId: string; fallback?: string; className?: string }) {
  const [href, setHref] = useState(fallback);
  useEffect(() => { const v = read(KEY(tripId)); if (v && v.startsWith("/") && !v.startsWith("//")) setHref(v); }, [tripId]);
  const label = href === "/" ? "홈으로" : href.startsWith("/trips") ? "여행 목록으로" : "이전 화면으로";
  return <Link href={href} aria-label={label} className={className}><Icon name="back" size={20} /></Link>;
}
