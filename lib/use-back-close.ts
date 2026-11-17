"use client";
/*
  창(미리보기, 첨부 보기 등)이 떠 있을 때 휴대폰 뒤로가기(안드로이드 뒤로 버튼, iOS 밀어서 뒤로)는 페이지 이동 대신 창만 닫는다
  (2026-11-18 마루님 "일정 모달에서 뒤로가기하면 모달 닫힘")
  - 창이 열릴 때 기록을 하나 쌓고, 뒤로가기(popstate)가 오면 맨 위 창 하나만 닫는다 (창 위에 창이 겹쳐도 하나씩)
  - X, 바깥 누르기로 닫으면 쌓아 둔 기록을 되돌린다. 창 안 링크로 다른 화면에 갔으면 되돌리지 않는다
*/
import { useEffect, useRef } from "react";

/* 열린 창 목록 (위가 맨 끝). popstate 는 전역 하나에서 받아 맨 위 창만 닫는다 */
const stack: { id: number; close: () => void }[] = [];
let seq = 0;
let skip = 0; // 버튼으로 닫으며 우리가 부른 history.back() 은 다른 창을 닫지 않게 건너뛴다
let bound = false;
function onPop() {
  if (skip > 0) { skip--; return; }
  const top = stack.pop();
  top?.close();
}

export function useBackClose(onClose: () => void) {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!bound) { window.addEventListener("popstate", onPop); bound = true; }
    const id = ++seq;
    const entry = { id, close: () => { closedByBack = true; close.current(); } };
    let closedByBack = false;
    stack.push(entry);
    window.history.pushState({ ...(window.history.state ?? {}), __sheet: id }, "");
    return () => {
      const i = stack.indexOf(entry);
      if (i >= 0) stack.splice(i, 1);
      // 버튼으로 닫았고, 아직 이 창의 기록 위에 있으면 그 기록만 되돌린다 (창 안 링크로 다른 화면에 갔으면 그대로)
      if (!closedByBack && window.history.state?.__sheet === id) { skip++; window.history.back(); }
    };
  }, []);
}
