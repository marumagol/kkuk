"use client";
/* 여행 한 권 > [인쇄, PDF로 저장] : 브라우저 인쇄 창 (PDF 로 저장 포함) */
export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()}
      className="press h-12 w-full rounded-btn bg-btn text-body font-bold text-on-btn print:hidden">
      인쇄, PDF로 저장
    </button>
  );
}
