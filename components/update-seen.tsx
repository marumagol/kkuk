"use client";
/*
  업데이트 내역 새 표시 (2026-11-16 마루님) : 마지막으로 본 버전을 이 기기에 적어 두고,
  설정의 [업데이트 내역] 줄에 새 버전이 있으면 점을 띄운다. 업데이트 내역 화면을 열면 본 것으로 적는다
  - 처음 쓰는 기기(적어 둔 버전 없음)는 점을 띄우지 않고 지금 버전을 적어 둔다
*/
import { useEffect, useState } from "react";

const KEY = "kkuk-seen-version";
const read = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
const write = (v: string) => { try { localStorage.setItem(KEY, v); } catch { /* 저장 못 해도 화면은 그대로 */ } };

export function NewUpdateDot({ version }: { version: string }) {
  const [fresh, setFresh] = useState(false);
  useEffect(() => {
    const seen = read();
    if (!seen) write(version);
    else setFresh(seen !== version);
  }, [version]);
  return fresh ? <span className="size-2 flex-none rounded-full bg-point" aria-label="새 업데이트" /> : null;
}

export function MarkUpdatesSeen({ version }: { version: string }) {
  useEffect(() => { write(version); }, [version]);
  return null;
}
