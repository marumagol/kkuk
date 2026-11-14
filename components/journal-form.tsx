"use client";
/* 일기 쓰기 폼 : 제목(선택), 글, 사진 10장, 공개 범위(나만 보기 / 함께하는 사람). 사진은 place-photos/<여행 id>/j/ */
import { useRef, useState, useTransition } from "react";
import { Button, Field, Icon } from "@/components/kit";
import { saveEntry } from "@/app/actions";
import { safeCall } from "@/lib/safe-call";
import { shrinkImage } from "@/lib/image";
import { createClient } from "@/lib/supabase/client";
import type { EntryContext } from "@/lib/trips";

const MAX = 10;

export function JournalForm({ ctx }: { ctx: EntryContext }) {
  const e = ctx.entry;
  const [title, setTitle] = useState(e?.title ?? "");
  const [body, setBody] = useState(e?.body ?? "");
  const [visibility, setVisibility] = useState<"members" | "private" | "public">(e?.visibility ?? "members");
  const [photos, setPhotos] = useState<{ path: string; url: string }[]>(e?.photos ?? []);
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState("");
  const [busy, start] = useTransition();
  const file = useRef<HTMLInputElement>(null);

  async function add(files: File[]) {
    setError("");
    const room = MAX - photos.length;
    if (files.length > room) setError(`사진은 ${MAX}장까지 올릴 수 있어요`);
    const pick = files.slice(0, Math.max(0, room)).filter((f) => f.type.startsWith("image/"));
    const sb = createClient();
    if (!sb || !pick.length) return;
    setUploading((n) => n + pick.length);
    await Promise.all(pick.map(async (f) => {
      try {
        const blob = await shrinkImage(f);
        const path = `${ctx.tripId}/j/${crypto.randomUUID()}.jpg`;
        const { error: er } = await sb.storage.from("place-photos").upload(path, blob, { contentType: "image/jpeg" });
        if (er) throw er;
        setPhotos((p) => (p.length < MAX ? [...p, { path, url: URL.createObjectURL(blob) }] : p));
      } catch { setError("사진을 올리지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요"); }
      finally { setUploading((n) => n - 1); }
    }));
  }
  const save = () => start(async () => {
    setError("");
    const r = await safeCall(() => saveEntry(ctx.tripId, { kind: ctx.kind, day: ctx.dayIndex, title, body, visibility, photos: photos.map((p) => p.path) }));
    if (r?.error) setError(r.error);
  });
  const empty = !title.trim() && !body.trim() && !photos.length;

  return (
    <>
      <div className="flex flex-1 flex-col gap-5 px-5 pt-4">
        {ctx.places.length > 0 && (
          <p className="rounded-field bg-surface px-3 py-2 text-tiny text-ink-sub">이날 간 곳 : {ctx.places.join(", ")}</p>
        )}
        <Field label="제목 (선택)" name="title" value={title} maxLength={60} placeholder={ctx.kind === "recap" ? "예 : 다시 가고 싶은 여행" : "예 : 바다가 보이던 오후"} disabled={busy}
          onChange={(ev) => setTitle(ev.target.value)} />
        <label className="flex flex-col gap-2">
          <span className="text-sub font-bold text-ink-sub">글</span>
          <textarea value={body} onChange={(ev) => setBody(ev.target.value)} maxLength={5000} rows={8} disabled={busy}
            placeholder={ctx.kind === "recap" ? "여행을 돌아보며 남기고 싶은 이야기" : "오늘 있었던 일, 기억하고 싶은 순간"}
            className="rounded-field border border-line-strong bg-surface px-4 py-3 text-body leading-relaxed text-ink outline-none placeholder:text-ink-sub focus:border-ink focus:ring-2 focus:ring-ink/15" />
        </label>

        <div className="flex flex-col gap-2">
          <span className="text-sub font-bold text-ink-sub">사진 ({photos.length}/{MAX})</span>
          <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
            {photos.map((p, i) => (
              <span key={p.path} className="relative flex-none">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={`사진 ${i + 1}`} width={88} height={88} className="size-22 rounded-field object-cover" />
                <button type="button" aria-label={`사진 ${i + 1} 빼기`} disabled={busy} onClick={() => setPhotos(photos.filter((x) => x !== p))}
                  className="press absolute -right-1.5 -top-1.5 flex size-7 items-center justify-center rounded-full bg-btn text-on-btn"><Icon name="x" size={14} /></button>
              </span>
            ))}
            {Array.from({ length: uploading }, (_, i) => <span key={`u${i}`} className="flex size-22 flex-none items-center justify-center rounded-field bg-surface text-tiny text-ink-sub">올리는 중</span>)}
            {photos.length + uploading < MAX && (
              <button type="button" disabled={busy} onClick={() => file.current?.click()}
                className="press flex size-22 flex-none flex-col items-center justify-center gap-1 rounded-field border border-dashed border-line-strong bg-surface text-tiny font-semibold text-ink-sub">
                <Icon name="camera" size={22} />사진 추가
              </button>
            )}
          </div>
          <input ref={file} type="file" accept="image/*" multiple className="hidden" onChange={(ev) => { const fs = [...(ev.target.files ?? [])]; ev.target.value = ""; void add(fs); }} />
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sub font-bold text-ink-sub">누가 볼 수 있나요</legend>
          <div role="radiogroup" className="grid grid-cols-3 gap-1 rounded-full bg-surface-soft p-1">
            {([["members", "함께하는 사람"], ["private", "나만 보기"], ["public", "링크 공개"]] as const).map(([v, label]) => (
              <button key={v} type="button" role="radio" aria-checked={visibility === v} disabled={busy} onClick={() => setVisibility(v)}
                className={"press relative after:absolute after:inset-x-0 after:-inset-y-1 after:content-[''] h-9 rounded-full text-tiny font-bold " + (visibility === v ? "bg-surface text-ink shadow-sm" : "text-ink")}>{label}</button>
            ))}
          </div>
          <p className="text-tiny text-ink-sub">{visibility === "private" ? "나만 볼 수 있어요" : visibility === "public" ? "링크를 아는 사람은 로그인 없이 이 글과 사진을 볼 수 있어요. 검색에는 나오지 않고, 공개를 끄면 링크가 끊겨요" : "이 여행을 함께하는 사람이 볼 수 있어요"}</p>
        </fieldset>

        {error && <p role="alert" className="text-sub font-semibold text-point-text">{error}</p>}
      </div>
      <div className="sticky bottom-0 mt-6 bg-bg px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-3">
        <Button full onClick={save} disabled={busy || uploading > 0 || empty}>{busy ? "저장하는 중" : uploading ? "사진 올리는 중" : "저장"}</Button>
      </div>
    </>
  );
}
