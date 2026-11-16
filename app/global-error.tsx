"use client";
/* 화면 틀(layout)까지 그리지 못했을 때 마지막 안내. 글꼴, 탭바 없이 가장 단순하게 */
import "./globals.css";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="ko">
      <body>
        <main className="mx-auto flex min-h-dvh w-full max-w-[560px] flex-col px-5 pt-16">
          <div role="alert" className="flex flex-col items-center gap-3 rounded-card bg-surface px-6 py-8 text-center">
            <h1 className="text-title font-bold text-ink">문제가 생겼어요</h1>
            <p className="text-sub text-ink-sub">인터넷 연결을 확인하고 잠시 뒤 다시 시도해 주세요</p>
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={reset} className="press inline-flex h-11 items-center rounded-btn bg-btn px-5 text-sub font-bold text-on-btn">다시 시도</button>
              {/* 틀부터 다시 그려야 해서 새로 불러오는 일반 링크 */}
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a href="/" className="press inline-flex h-11 items-center rounded-btn border border-line-strong bg-surface px-5 text-sub font-bold text-ink">홈으로</a>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
