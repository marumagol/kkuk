"use client";
/*
  예약 미리보기 창 (0.89.3, 마루님 "준비>예약도 일정 카드와 같은 방식") : 화면 가운데 창
  - 이름, 날짜, 담당, 예약번호(복사), 메모, 첨부. 적어 둔 게 없는 칸은 아예 안 보인다 (안내 문구도 없음). 맨 아래 [수정] 은 고칠 수 있는 사람에게만 (예약 화면으로)
  - 휴대폰 뒤로가기는 창만 닫는다
  - 0.89.5 : 정보를 다 읽은 뒤에 창을 연다 (읽는 동안 빈 자리가 잠깐 보이지 않게). 읽기는 prep-panel 에서 누르는 순간 시작
*/
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { getBooking } from "@/app/actions";
import { createPortal } from "react-dom";
import { Icon } from "@/components/kit";
import { useBackClose } from "@/lib/use-back-close";
import { md } from "@/lib/mock";
import type { BookingView } from "@/lib/trips";

export function BookingPreview({ tripId, id, title, due, who, canEdit, data: v, onClose }: {
  tripId: string; id: string; title: string; due: string | null; who?: string; canEdit: boolean; data: BookingView | null; onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  useBackClose(onClose);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);
  const copy = async (s: string) => { try { await navigator.clipboard.writeText(s); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* 복사 못 하는 브라우저 */ } };
  const rows = [
    ...((v?.due ?? due) ? [{ label: "날짜", value: md((v?.due ?? due)!) }] : []),
    ...(who ? [{ label: "담당", value: who }] : []),
  ];

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-scrim px-5 sm:px-8" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}
        className="modal-pop flex max-h-[80dvh] w-full max-w-[420px] flex-col rounded-card bg-surface px-5 pb-5 pt-5 shadow-float">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sub font-bold text-ink-sub">예약</span>
          <button type="button" onClick={onClose} aria-label="닫기" autoFocus className="press -mr-2 flex size-10 flex-none items-center justify-center rounded-full text-ink-sub"><Icon name="x" size={20} /></button>
        </div>
        <div className="mt-1 min-h-0 overflow-y-auto">
          <h2 className="text-title font-extrabold leading-snug text-ink">{v?.title ?? title}</h2>
          {(rows.length > 0 || v?.code) && (
            <dl className="mt-4 flex flex-col divide-y divide-line rounded-field bg-bg px-4">
              {v?.code && (
                <div className="flex min-h-12 items-center gap-3 py-2.5">
                  <dt className="w-[4.5rem] flex-none text-tiny text-ink-sub">예약번호</dt>
                  <dd className="min-w-0 flex-1 break-words text-sub font-semibold text-ink">{v.code}</dd>
                  <button type="button" onClick={() => void copy(v.code)} aria-label="예약번호 복사"
                    className="press flex-none rounded-full bg-surface px-2.5 py-1 text-tiny font-bold text-ink">{copied ? "복사됨" : "복사"}</button>
                </div>
              )}
              {rows.map((r) => (
                <div key={r.label} className="flex min-h-12 items-center gap-3 py-2.5">
                  <dt className="w-[4.5rem] flex-none text-tiny text-ink-sub">{r.label}</dt>
                  <dd className="min-w-0 flex-1 break-words text-sub text-ink">{r.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {v?.note && <p className="mt-4 whitespace-pre-line break-words text-body text-ink">{v.note}</p>}
          {!!v?.files.length && (
            <div className="mt-4 flex flex-wrap gap-2">
              {v.files.map((f, i) => (
                <a key={f.path} href={f.url} target="_blank" rel="noopener noreferrer" aria-label={`첨부 ${i + 1} 크게 보기`} className="press size-20 overflow-hidden rounded-field bg-surface-soft">
                  {f.pdf ? <span className="flex size-full items-center justify-center text-tiny font-bold text-ink-sub">PDF</span>
                    /* eslint-disable-next-line @next/next/no-img-element */
                    : <img src={f.url} alt="" className="size-full object-cover" />}
                </a>
              ))}
            </div>
          )}
          {!v && <p className="mt-4 text-sub text-ink-sub">예약 정보를 불러오지 못했어요. 잠시 뒤 다시 열어 주세요</p>}
        </div>
        {canEdit && (
          <Link href={`/trips/${tripId}/bookings/${id}`} replace
            className="press mt-5 flex h-12 flex-none items-center justify-center gap-1.5 rounded-btn bg-btn text-body font-bold text-on-btn">
            <Icon name="pencil" size={18} />수정
          </Link>
        )}
      </div>
    </div>,
    document.body,
  );
}

/* 예약 줄 버튼 (홈 준비 카드, 0.91.5) : 누르면 수정 화면 대신 위 미리보기 창. 누르기 시작할 때 미리 읽고, 다 읽은 뒤 연다 */
export function BookingOpen({ tripId, id, title, due, className, children }: { tripId: string; id: string; title: string; due: string | null; className?: string; children: ReactNode }) {
  const [peek, setPeek] = useState<{ data: BookingView | null } | null>(null);
  const loading = useRef<Promise<BookingView | null> | null>(null);
  const load = () => (loading.current ??= getBooking(tripId, id).catch(() => null));
  return (
    <>
      <button type="button" onPointerDown={() => void load()} onClick={() => load().then((data) => { loading.current = null; setPeek({ data }); })}
        aria-label={`${title} 보기`} className={className}>{children}</button>
      {peek && <BookingPreview tripId={tripId} id={id} title={title} due={due} canEdit={peek.data?.canEdit ?? false} data={peek.data} onClose={() => setPeek(null)} />}
    </>
  );
}
