"use client";
/*
  메모 쓰기 / 고치기 (2026-11-16 마루님 "메모는 제목 내용 구분 없이 내용이랑 사진만")
  - 화면 전체가 글 칸. 위 오른쪽 [완료] 로 저장, 사진은 최대 5장 (장소 사진과 같은 저장소)
  - DB 는 그대로 : title = 첫 줄(80자까지), memo = 글 전체. 예전 메모(제목 + 내용 따로)는 "제목\n내용" 으로 합쳐서 연다
*/
import { LeaveGuard } from "@/components/leave-guard";
import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Icon } from "@/components/kit";
import { createClient } from "@/lib/supabase/client";
import { shrinkImage } from "@/lib/image";
import { AlertDialog } from "@/components/gate";
import { savePlace, removePlace } from "@/app/actions";
import { safeCall } from "@/lib/safe-call";
import { MAX_PLACE_MEMO, MAX_PLACE_TITLE, MAX_PLACE_PHOTOS } from "@/lib/rules";
import type { PlaceContext } from "@/lib/trips";

export function MemoForm({ ctx, day, back }: { ctx: PlaceContext; day: number | null; back: string }) {
  const p = ctx.place;
  const start = !p ? "" : p.memo?.startsWith(p.title) ? p.memo : [p.title, p.memo].filter(Boolean).join("\n");
  const [text, setText] = useState(start ?? "");
  const [photos, setPhotos] = useState<{ path: string; url: string }[]>(ctx.photos ?? []);
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, startBusy] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const body = text.trim();
  const ready = (body.length > 0 || photos.length > 0) && uploading === 0 && !busy;

  async function addPhotos(files: File[]) {
    setError("");
    const room = MAX_PLACE_PHOTOS - photos.length;
    if (files.length > room) setError(`사진은 ${MAX_PLACE_PHOTOS}장까지 올릴 수 있어요`);
    const pick = files.slice(0, Math.max(0, room)).filter((f) => f.type.startsWith("image/"));
    const sb = createClient();
    if (!sb || !pick.length) return;
    setUploading((n) => n + pick.length);
    await Promise.all(pick.map(async (f) => {
      try {
        const blob = await shrinkImage(f);
        const path = `${ctx.tripId}/${crypto.randomUUID()}.jpg`;
        const { error: e } = await sb.storage.from("place-photos").upload(path, blob, { contentType: "image/jpeg" });
        if (e) throw e;
        setPhotos((x) => (x.length < MAX_PLACE_PHOTOS ? [...x, { path, url: URL.createObjectURL(blob) }] : x));
      } catch {
        setError("사진을 올리지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요");
      } finally { setUploading((n) => n - 1); }
    }));
  }

  const save = () => {
    if (!ready) return;
    if ([...body].length > MAX_PLACE_MEMO) return setError(`메모는 ${MAX_PLACE_MEMO}자까지 쓸 수 있어요`);
    const first = body.split("\n").find((l) => l.trim())?.trim() ?? "";
    const title = [...(first || "사진 메모")].slice(0, MAX_PLACE_TITLE).join("");
    setError("");
    startBusy(async () => {
      const r = await safeCall(() => savePlace(ctx.tripId, p?.id ?? null, {
        title, address: "", category: "memo", time: "", cost: "", currency: ctx.currency, memo: body, day,
        photos: photos.map((x) => x.path), details: {},
      }));
      if (r?.error) setError(r.error);
    });
  };
  const remove = () => startBusy(async () => {
    const r = await safeCall(() => removePlace(ctx.tripId, p!.id, p!.day_index));
    if (r?.error) setError(r.error);
  });

  return (
    <LeaveGuard>
      <div className="sticky top-0 z-10 flex items-center gap-2 bg-bg px-5 pb-2 pt-4">
        <Link href={back} aria-label="일정으로" className="press flex size-11 flex-none items-center justify-center rounded-full bg-surface text-ink">
          <Icon name="back" size={20} />
        </Link>
        <h1 className="min-w-0 flex-1 text-center text-title font-extrabold text-ink">{p ? "메모 수정" : "메모 추가"}</h1>
        <button type="button" onClick={save} disabled={!ready}
          className="press h-11 w-14 flex-none rounded-full text-body font-bold text-point-text disabled:text-ink-sub disabled:opacity-60">
          {busy ? "저장 중" : "완료"}
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-5 px-5 pb-10 pt-2">
        <label className="flex flex-col">
          <span className="sr-only">메모 내용</span>
          <textarea value={text} onChange={(e) => { setText(e.target.value); setError(""); }} maxLength={MAX_PLACE_MEMO} disabled={busy} autoFocus={!p}
            rows={8} placeholder={"잊기 쉬운 정보나 사진을 남겨 보세요.\n여권, 신분증 같은 개인 정보는 올릴 때 조심해 주세요."}
            className="min-h-[40dvh] w-full resize-none rounded-card border border-line-strong bg-surface px-4 py-4 text-body leading-relaxed text-ink outline-none placeholder:text-ink-sub focus:border-ink focus:ring-2 focus:ring-ink/15" />
        </label>

        <div className="flex flex-wrap gap-2">
          {photos.map((ph, i) => (
            <span key={ph.path} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={ph.url} alt={`사진 ${i + 1}`} width={88} height={88} className="size-22 rounded-field object-cover" />
              <button type="button" aria-label={`사진 ${i + 1} 빼기`} disabled={busy} onClick={() => setPhotos(photos.filter((x) => x !== ph))}
                className="press absolute -right-1.5 -top-1.5 flex size-7 items-center justify-center rounded-full bg-btn text-on-btn">
                <Icon name="x" size={14} />
              </button>
            </span>
          ))}
          {Array.from({ length: uploading }, (_, i) => (
            <span key={`up${i}`} className="flex size-22 items-center justify-center rounded-field bg-surface text-tiny text-ink-sub">올리는 중</span>
          ))}
          {photos.length + uploading < MAX_PLACE_PHOTOS && (
            <button type="button" disabled={busy} onClick={() => fileRef.current?.click()} aria-label={`사진 추가 (${photos.length}/${MAX_PLACE_PHOTOS})`}
              className="press flex size-22 items-center justify-center rounded-field bg-surface text-ink-sub">
              <Icon name="plus" size={26} />
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
            onChange={(e) => { const fs = [...(e.target.files ?? [])]; e.target.value = ""; void addPhotos(fs); }} />
        </div>

        {error && <p role="alert" className="text-sub font-semibold text-point-text">{error}</p>}

        {p && (
          <button type="button" onClick={() => setConfirm(true)} disabled={busy}
            className="press mt-auto h-12 self-start rounded-full px-1 text-sub font-semibold text-ink-sub underline underline-offset-2">메모 삭제</button>
        )}
      </div>

      {confirm && <AlertDialog title="메모를 삭제할까요?" desc="일정에서 이 메모가 사라져요" confirmLabel="삭제"
        confirm={remove} onClose={() => setConfirm(false)} />}
    </LeaveGuard>
  );
}
