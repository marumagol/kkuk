"use client";
/* 메모 속 링크를 누를 수 있게 (2026-11-17 마루님 "메모에 링크 넣으면 하이퍼링크") : http(s):// 또는 www. 로 시작하는 주소 */
import { Icon } from "@/components/kit";

const URL_RE = /(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+)/gi;
const hrefOf = (u: string) => (/^https?:\/\//i.test(u) ? u : `https://${u}`).replace(/[.,)\]]+$/, "");
export const linksIn = (text: string) => [...new Set((text.match(URL_RE) ?? []).map(hrefOf))];

/* 카드처럼 이미 링크 안에 있는 글 : <a> 를 겹칠 수 없어 눌렀을 때 새 창으로 연다 */
export function Linkify({ text }: { text: string }) {
  const parts = text.split(URL_RE);
  return (
    <>
      {parts.map((p, i) => (i % 2 === 1 ? (
        <span key={i} role="link" tabIndex={0} className="cursor-pointer break-all text-accent-text underline underline-offset-2"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.open(hrefOf(p), "_blank", "noopener,noreferrer"); }}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); window.open(hrefOf(p), "_blank", "noopener,noreferrer"); } }}>{p}</span>
      ) : p))}
    </>
  );
}

/* 글 입력칸 아래 : 메모에 들어 있는 링크를 바로 열기 */
export function LinkList({ text }: { text: string }) {
  const links = linksIn(text);
  if (!links.length) return null;
  return (
    <ul className="flex flex-col gap-1.5" aria-label="메모 속 링크">
      {links.slice(0, 10).map((u) => (
        <li key={u}>
          <a href={u} target="_blank" rel="noopener noreferrer" className="press flex min-h-10 items-center gap-2 rounded-field bg-surface px-3 py-2 text-sub text-accent-text">
            <Icon name="link" size={16} className="flex-none" /><span className="min-w-0 flex-1 truncate underline underline-offset-2">{u.replace(/^https?:\/\//, "")}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
