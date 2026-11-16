"use client";
/*
  예약 지갑 (0034, 2026-11-16 마루님) : 예약 이름, 날짜, 예약번호(복사), 메모, 첨부 파일
  - 파일은 고르는 즉시 비공개 저장소 trip-files/<여행 id>/ 에 올리고, [저장] 할 때 목록을 함께 저장. 그림은 줄여서, PDF 는 그대로 (10MB 까지)
  - 보기만인 사람은 읽기만. 예약번호 복사, 파일 열기는 된다
*/
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { Button, Field, FormCard, Icon } from "@/components/kit";
import { LeaveGuard } from "@/components/leave-guard";
import { createClient } from "@/lib/supabase/client";
import { shrinkImage } from "@/lib/image";
import { saveBooking } from "@/app/actions";
import { safeCall } from "@/lib/safe-call";
import { md } from "@/lib/mock";
import type { BookingView } from "@/lib/trips";

const MAX_FILES = 5;
const MAX_PDF = 10 * 1024 * 1024;

export function BookingForm({ view }: { view: BookingView }) {
  const [title, setTitle] = useState(view.title);
  const [due, setDue] = useState(view.due ?? "");
  const [code, setCode] = useState(view.code);
  const [note, setNote] = useState(view.note);
  const [files, setFiles] = useState(view.files);
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [busy, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const copy = async () => {
    try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    catch { setError("복사하지 못했어요. 예약번호를 길게 눌러 복사해 주세요"); }
  };

  async function addFiles(list: File[]) {
    setError("");
    const room = MAX_FILES - files.length;
    if (list.length > room) setError(`파일은 ${MAX_FILES}개까지 넣을 수 있어요`);
    const pick = list.slice(0, Math.max(0, room));
    const sb = createClient();
    if (!sb || !pick.length) return;
    setUploading((n) => n + pick.length);
    await Promise.all(pick.map(async (f) => {
      try {
        const pdf = f.type === "application/pdf";
        if (!pdf && !f.type.startsWith("image/")) throw new Error("type");
        if (pdf && f.size > MAX_PDF) throw new Error("size");
        const blob = pdf ? f : await shrinkImage(f);
        const path = `${view.tripId}/${crypto.randomUUID()}.${pdf ? "pdf" : "jpg"}`;
        const { error: e } = await sb.storage.from("trip-files").upload(path, blob, { contentType: pdf ? "application/pdf" : "image/jpeg" });
        if (e) throw e;
        setFiles((x) => (x.length < MAX_FILES ? [...x, { path, url: URL.createObjectURL(blob), pdf }] : x));
      } catch (e) {
        const m = (e as Error)?.message;
        setError(m === "type" ? "그림이나 PDF 파일만 넣을 수 있어요" : m === "size" ? "PDF 는 10MB 까지 넣을 수 있어요" : "파일을 올리지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요");
      } finally { setUploading((n) => n - 1); }
    }));
  }

  const save = () => start(async () => {
    setError("");
    const r = await safeCall(() => saveBooking(view.tripId, view.id, { title, due, code, note, files: files.map((f) => f.path) }));
    if (r?.error) setError(r.error);
  });

  if (!view.canEdit) return (
    <div className="flex flex-col gap-4 px-5 pt-6">
      <section className="flex flex-col gap-1 rounded-card bg-surface p-5">
        <h2 className="text-title font-bold text-ink">{view.title}</h2>
        {view.due && <p className="text-sub text-ink-sub">{md(view.due)}</p>}
        {view.code && <CodeRow code={view.code} copied={copied} onCopy={copy} />}
        {view.note && <p className="mt-2 whitespace-pre-line text-body text-ink">{view.note}</p>}
      </section>
      <FileList files={files} />
      {error && <p role="alert" className="text-sub font-semibold text-point-text">{error}</p>}
    </div>
  );

  return (
    <LeaveGuard>
      <div className="flex flex-col gap-3 px-5 pt-5 pb-10">
        <FormCard title="예약 정보">
        <Field label="예약 이름" name="title" value={title} maxLength={80} disabled={busy} onChange={(e) => setTitle(e.target.value)} />
        <Field label="날짜 (선택)" name="due" type="date" value={due} disabled={busy} onChange={(e) => setDue(e.target.value)} />
        <div className="flex flex-col gap-2">
          <Field label="예약번호 (선택)" name="code" value={code} maxLength={60} disabled={busy} placeholder="예 : ABC123" autoComplete="off"
            onChange={(e) => setCode(e.target.value)} />
          {code.trim() && <button type="button" onClick={copy} className="press inline-flex h-9 items-center gap-1 self-start rounded-full bg-bg px-3 text-tiny font-bold text-ink">
            <Icon name={copied ? "check" : "link"} size={14} />{copied ? "복사했어요" : "예약번호 복사"}</button>}
        </div>
        </FormCard>
        <FormCard title="메모와 첨부 파일" desc="함께하는 사람만 볼 수 있어요">
        <div className="flex flex-col gap-2">
          <label htmlFor="booking-note" className="text-tiny font-bold text-ink-sub">메모 (선택)</label>
          <textarea id="booking-note" name="note" value={note} maxLength={500} rows={3} disabled={busy} onChange={(e) => setNote(e.target.value)} placeholder="예 : 체크인 15시, 조식 포함"
            className="rounded-card border border-line-strong bg-surface px-4 py-4 text-[16px] text-ink outline-none placeholder:text-ink-sub focus:border-ink focus:ring-2 focus:ring-ink/15" />
        </div>
        <section className="flex flex-col gap-2" aria-label="첨부 파일">
          <div className="flex items-end justify-between">
            <h3 className="text-tiny font-bold text-ink-sub">첨부 파일 (선택)</h3>
            <span className="text-tiny text-ink-sub">{files.length}/{MAX_FILES}</span>
          </div>
          <FileList files={files} onRemove={busy ? undefined : (p) => setFiles((x) => x.filter((f) => f.path !== p))} />
          {files.length < MAX_FILES && (
            <button type="button" disabled={busy || uploading > 0} onClick={() => fileRef.current?.click()}
              className="press flex min-h-14 items-center justify-center gap-1.5 rounded-card border-2 border-dashed border-line-strong text-sub font-bold text-ink-sub">
              <Icon name="plus" size={16} />{uploading ? "올리는 중" : "사진이나 PDF 넣기"}
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*,application/pdf" multiple hidden
            onChange={(e) => { const l = [...(e.target.files ?? [])]; e.target.value = ""; void addFiles(l); }} />
        </section>
        </FormCard>
        {view.itemId && <Link href={`/trips/${view.tripId}/places/${view.itemId}`} className="inline-flex items-center gap-1 text-tiny text-ink-sub underline underline-offset-2"><Icon name="pin" size={12} />일정 장소 보기</Link>}
        {error && <p role="alert" className="text-sub font-semibold text-point-text">{error}</p>}
        <Button type="button" size="lg" className="mt-3" disabled={busy || uploading > 0 || !title.trim()} onClick={save}>{busy ? "저장하는 중" : "저장"}</Button>
      </div>
    </LeaveGuard>
  );
}

function CodeRow({ code, copied, onCopy }: { code: string; copied: boolean; onCopy: () => void }) {
  return (
    <div className="mt-2 flex items-center justify-between gap-2 rounded-field bg-bg px-3 py-2">
      <span className="min-w-0"><span className="block text-tiny text-ink-sub">예약번호</span><span className="block truncate text-body font-bold tabular-nums text-ink">{code}</span></span>
      <button type="button" onClick={onCopy} className="press h-9 flex-none rounded-full bg-surface px-3 text-tiny font-bold text-ink">{copied ? "복사했어요" : "복사"}</button>
    </div>
  );
}

function FileList({ files, onRemove }: { files: BookingView["files"]; onRemove?: (path: string) => void }) {
  if (!files.length) return null;
  return (
    <ul className="grid grid-cols-3 gap-2">
      {files.map((f, i) => (
        <li key={f.path} className="relative aspect-square overflow-hidden rounded-field bg-surface ring-1 ring-line">
          <a href={f.url} target="_blank" rel="noopener noreferrer" aria-label={`첨부 ${i + 1} 열기`} className="flex size-full items-center justify-center">
            {f.pdf ? <span className="flex flex-col items-center gap-1 text-tiny font-bold text-ink-sub"><Icon name="book" size={22} />PDF</span>
              // eslint-disable-next-line @next/next/no-img-element
              : <img src={f.url} alt="" className="size-full object-cover" />}
          </a>
          {onRemove && <button type="button" aria-label={`첨부 ${i + 1} 빼기`} onClick={() => onRemove(f.path)}
            className="press absolute right-1 top-1 flex size-7 items-center justify-center rounded-full bg-black/60 text-white"><Icon name="x" size={14} /></button>}
        </li>
      ))}
    </ul>
  );
}
