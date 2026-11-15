"use client";
/* 일기 쓰기 폼 (피그마 "일기 (11.15)" 03, 04) : 사진(대표 크게 + 작은 사진, 누르면 대표로), 제목과 글 한 카드, 이날 간 곳, 공개 범위 3줄
   사진은 place-photos/<여행 id>/j/ (첫 사진이 대표). 공개 범위 : 함께하는 사람 / 나만 보기 / 링크로 공개 */
import { useRef, useState, useTransition } from "react";
import { Button, Icon } from "@/components/kit";
import { saveEntry } from "@/app/actions";
import { safeCall } from "@/lib/safe-call";
import { shrinkImage } from "@/lib/image";
import { createClient } from "@/lib/supabase/client";
import type { EntryContext } from "@/lib/trips";

const MAX = 10;
type Vis = "members" | "private" | "public";
const VIS: { v: Vis; icon: "users" | "lock" | "link"; label: string; desc: string }[] = [
  { v: "members", icon: "users", label: "함께하는 사람", desc: "이 여행을 함께하는 사람이 보고 좋아요와 댓글을 남겨요" },
  { v: "private", icon: "lock", label: "나만 보기", desc: "나만 볼 수 있어요. 좋아요와 댓글은 없어요" },
  { v: "public", icon: "link", label: "링크로 공개", desc: "링크를 아는 사람은 로그인 없이 글과 사진을 봐요. 댓글은 안 보이고 검색에도 나오지 않아요" },
];

export function JournalForm({ ctx }: { ctx: EntryContext }) {
  const e = ctx.entry;
  const [title, setTitle] = useState(e?.title ?? "");
  const [body, setBody] = useState(e?.body ?? "");
  const [visibility, setVisibility] = useState<Vis>(e?.visibility ?? "members");
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
  const cover = (p: { path: string; url: string }) => setPhotos((all) => [p, ...all.filter((x) => x !== p)]);
  const empty = !title.trim() && !body.trim() && !photos.length;
  const pickPhotos = () => file.current?.click();
  const count = [...body].length;

  return (
    <>
      <div className="flex flex-1 flex-col gap-5 px-5 pt-3">
        {/* 사진 */}
        <section className="flex flex-col gap-2.5" aria-label="사진">
          {photos.length ? (
            <>
              <div className="relative overflow-hidden rounded-[20px] bg-surface-soft">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photos[0].url} alt="대표 사진" className="aspect-[4/3] w-full object-cover" />
                <span className="absolute left-3 top-3 inline-flex h-7 items-center rounded-full bg-surface px-2.5 text-tiny font-bold text-ink">대표 사진</span>
                <button type="button" aria-label="대표 사진 빼기" disabled={busy} onClick={() => setPhotos(photos.slice(1))}
                  className="press absolute right-2 top-2 flex size-11 items-center justify-center"><span className="flex size-8 items-center justify-center rounded-full bg-scrim text-on-deep"><Icon name="x" size={16} /></span></button>
              </div>
              <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
                {photos.map((p, i) => (
                  <span key={p.path} className="relative flex-none">
                    <button type="button" onClick={() => cover(p)} disabled={busy || i === 0} aria-label={i === 0 ? "대표 사진" : `사진 ${i + 1}을 대표 사진으로`}
                      className={`press block overflow-hidden rounded-field ${i === 0 ? "ring-2 ring-ink ring-offset-0" : ""}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.url} alt="" width={64} height={64} className="size-16 object-cover" />
                    </button>
                    {i > 0 && (
                      <button type="button" aria-label={`사진 ${i + 1} 빼기`} disabled={busy} onClick={() => setPhotos(photos.filter((x) => x !== p))}
                        className="press absolute -right-1.5 -top-1.5 flex size-6 items-center justify-center rounded-full bg-btn text-on-btn"><Icon name="x" size={12} /></button>
                    )}
                  </span>
                ))}
                {Array.from({ length: uploading }, (_, i) => <span key={`u${i}`} className="flex size-16 flex-none items-center justify-center rounded-field bg-surface text-tiny text-ink-sub">올리는 중</span>)}
                {photos.length + uploading < MAX && (
                  <button type="button" disabled={busy} onClick={pickPhotos} aria-label="사진 추가"
                    className="press flex size-16 flex-none items-center justify-center rounded-field border border-dashed border-line-strong bg-surface text-ink"><Icon name="plus" size={22} /></button>
                )}
              </div>
              <p className="text-tiny text-ink-sub">사진 {photos.length} / {MAX} · 작은 사진을 누르면 대표 사진이 바뀌어요</p>
            </>
          ) : (
            <button type="button" disabled={busy || uploading > 0} onClick={pickPhotos}
              className="press flex h-42 flex-col items-center justify-center gap-1.5 rounded-[20px] border border-dashed border-line-strong bg-surface text-ink">
              <Icon name="camera" size={28} />
              <span className="text-body font-bold">{uploading ? "사진 올리는 중" : "사진 추가"}</span>
              <span className="text-tiny text-ink-sub">10장까지 올릴 수 있어요. 첫 사진이 대표 사진이에요</span>
            </button>
          )}
          <input ref={file} type="file" accept="image/*" multiple className="hidden" onChange={(ev) => { const fs = [...(ev.target.files ?? [])]; ev.target.value = ""; void add(fs); }} />
        </section>

        {/* 제목과 글 */}
        <section className="rounded-[20px] bg-surface px-4">
          <label className="sr-only" htmlFor="j-title">제목 (선택)</label>
          <input id="j-title" value={title} onChange={(ev) => setTitle(ev.target.value)} maxLength={60} disabled={busy}
            placeholder={ctx.kind === "recap" ? "제목 (선택) 예 : 다시 가고 싶은 여행" : "제목 (선택)"}
            className="h-14 w-full bg-transparent text-title font-bold text-ink outline-none placeholder:font-semibold placeholder:text-ink-sub" />
          <div className="h-px bg-line" />
          <label className="sr-only" htmlFor="j-body">글</label>
          <textarea id="j-body" value={body} onChange={(ev) => setBody(ev.target.value)} maxLength={5000} rows={6} disabled={busy}
            placeholder={ctx.kind === "recap" ? "여행을 돌아보며 남기고 싶은 이야기" : "오늘 있었던 일, 기억하고 싶은 순간"}
            className="block w-full resize-none bg-transparent py-3.5 text-body leading-relaxed text-ink outline-none placeholder:text-ink-sub" />
          <p className="pb-3 text-right text-tiny text-ink-sub tabular-nums">{count.toLocaleString()} / 5,000</p>
        </section>

        {ctx.places.length > 0 && (
          <section className="flex flex-col gap-2">
            <h2 className="text-sub font-bold text-ink-sub">이날 간 곳</h2>
            <ul className="flex flex-wrap gap-1.5">
              {ctx.places.map((p, i) => <li key={i} className="flex h-8 items-center gap-1 rounded-full bg-surface px-2.5 text-sub font-semibold text-ink"><Icon name="pin" size={14} className="text-point" />{p}</li>)}
            </ul>
          </section>
        )}

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sub font-bold text-ink-sub">누가 볼 수 있나요</legend>
          <div role="radiogroup" className="flex flex-col gap-0.5 rounded-[20px] bg-surface p-1.5">
            {VIS.map((o) => {
              const on = visibility === o.v;
              return (
                <button key={o.v} type="button" role="radio" aria-checked={on} disabled={busy} onClick={() => setVisibility(o.v)}
                  className={`press flex items-center gap-3 rounded-[14px] px-3 py-3 text-left ${on ? "bg-surface-soft" : ""}`}>
                  <Icon name={o.icon} size={20} className="flex-none text-ink" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-body font-bold text-ink">{o.label}</span>
                    <span className="block text-tiny text-ink-sub">{o.desc}</span>
                  </span>
                  {on ? <span className="flex size-6 flex-none items-center justify-center rounded-full bg-btn text-on-btn"><Icon name="check" size={14} /></span>
                    : <span className="size-6 flex-none rounded-full border-[1.5px] border-line-strong" />}
                </button>
              );
            })}
          </div>
        </fieldset>

        {error && <p role="alert" className="text-sub font-semibold text-point-text">{error}</p>}
      </div>
      <div className="sticky bottom-0 mt-6 bg-bg px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-3">
        <Button full onClick={save} disabled={busy || uploading > 0 || empty}>{busy ? "저장하는 중" : uploading ? "사진 올리는 중" : "저장"}</Button>
      </div>
    </>
  );
}
