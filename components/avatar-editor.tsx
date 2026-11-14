"use client";
/* 설정 > 프로필 사진. 누르면 사진 고르기 → 512px 로 줄여 공개 저장소 avatars/<내 id>/ 에 올리고 saveAvatar 로 저장 */
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/screen";
import { Icon } from "@/components/kit";
import { createClient } from "@/lib/supabase/client";
import { shrinkImage } from "@/lib/image";
import { saveAvatar } from "@/app/actions";
import { safeCall } from "@/lib/safe-call";

export function AvatarEditor({ initial, src, userId }: { initial: string; src: string | null; userId: string }) {
  const file = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function upload(f: File) {
    if (!f.type.startsWith("image/")) return setError("그림 파일만 올릴 수 있어요");
    const sb = createClient();
    if (!sb) return;
    setBusy(true); setError("");
    try {
      const blob = await shrinkImage(f, 512, 0.85);
      const path = `${userId}/${crypto.randomUUID()}.jpg`;
      const { error: e } = await sb.storage.from("avatars").upload(path, blob, { contentType: "image/jpeg" });
      if (e) throw e;
      const r = await safeCall(() => saveAvatar(path));
      if (r?.error) setError(r.error); else router.refresh();
    } catch {
      setError("사진을 올리지 못했어요. 잠시 뒤 다시 시도해 주세요");
    } finally { setBusy(false); }
  }
  async function remove() {
    setBusy(true); setError("");
    const r = await safeCall(() => saveAvatar(null));
    if (r?.error) setError(r.error); else router.refresh();
    setBusy(false);
  }

  return (
    <div className="flex flex-none flex-col items-center gap-1">
      <button type="button" disabled={busy} onClick={() => file.current?.click()} aria-label="프로필 사진 바꾸기" className="press relative rounded-full">
        <Avatar initial={initial} size={56} src={src} />
        <span className="absolute -bottom-0.5 -right-0.5 flex size-6 items-center justify-center rounded-full border-2 border-surface bg-btn text-on-btn">
          <Icon name="camera" size={12} strokeWidth={2.25} />
        </span>
      </button>
      {src && <button type="button" disabled={busy} onClick={remove} className="press h-8 px-1 text-tiny font-semibold text-ink-sub underline underline-offset-2">사진 빼기</button>}
      {busy && <span className="text-tiny text-ink-sub" role="status">저장하는 중</span>}
      {error && <span role="alert" className="max-w-24 text-center text-tiny font-semibold text-point-text">{error}</span>}
      <input ref={file} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void upload(f); }} />
    </div>
  );
}
