"use client";
/* 알림 화면을 열면 모두 읽음으로 (화면에 보인 뒤 한 번) */
import { useEffect } from "react";
import { readAllNotices } from "@/app/actions";

export function ReadAll() {
  useEffect(() => { readAllNotices().catch(() => {}); }, []);
  return null;
}
