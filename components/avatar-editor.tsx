"use client";
/* 설정 > 프로필 사진. 사진이 있으면 누를 때 [사진 수정][사진 삭제] 메뉴(2026-11-17 마루님), 없으면 바로 사진 고르기 → 자르기 창(원형 틀, 2026-11-16) → 512px 정사각형으로 공개 저장소 avatars/<내 id>/ 에 올리고 saveAvatar 로 저장 */
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/screen";
import { Icon } from "@/components/kit";
import { createClient } from "@/lib/supabase/client";
import { AvatarCropper } from "@/components/avatar-cropper";
import { saveAvatar } from "@/app/actions";
import { safeCall } from "@/lib/safe-call";

export function AvatarEditor({ initial, src, userId }: { initial: string; src: string | null; userId: string }) {
  const file = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [picked, setPicked] = useState<File | null>(null); // 자르기 창에 띄운 사진
  const [menu, setMenu] = useState(false);
  const item = "press flex min-h-11 w-full items-center gap-2.5 px-4 text-left text-body text-ink";
  const router = useRouter();

  async function upload(blob: Blob) {
    setPicked(null);
    const sb = createClient();
    if (!sb) return;
    setBusy(true); setError("");
    try {
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
    <div className="relative flex flex-none flex-col items-center gap-1">
      <button type="button" disabled={busy} onClick={() => (src ? setMenu((m) => !m) : file.current?.click())}
        aria-label={src ? "프로필 사진 수정 또는 삭제" : "프로필 사진 넣기"} aria-haspopup={src ? "menu" : undefined} aria-expanded={src ? menu : undefined} className="press relative rounded-full">
        <Avatar initial={initial} size={56} src={src} />
        <span className="absolute -bottom-0.5 -right-0.5 flex size-6 items-center justify-center rounded-full border-2 border-surface bg-btn text-on-btn">
          <Icon name="camera" size={12} strokeWidth={2.25} />
        </span>
      </button>
      {menu && src && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setMenu(false)} aria-hidden />
          <div role="menu" onKeyDown={(e) => e.key === "Escape" && setMenu(false)}
            className="absolute left-0 top-16 z-40 min-w-[160px] overflow-hidden rounded-field bg-surface py-1 shadow-float ring-1 ring-line">
            <button type="button" role="menuitem" autoFocus className={item} onClick={() => { setMenu(false); file.current?.click(); }}><Icon name="camera" size={18} className="text-ink-sub" />사진 수정</button>
            <button type="button" role="menuitem" className={item + " text-point-text"} onClick={() => { setMenu(false); void remove(); }}><Icon name="trash" size={18} />사진 삭제</button>
          </div>
        </>
      )}
      {busy && <span className="text-tiny text-ink-sub" role="status">저장하는 중</span>}
      {error && <span role="alert" className="max-w-40 text-center text-tiny font-semibold text-point-text">{error}</span>}
      <input ref={file} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; setError(""); setPicked(f); /* 파일 앱에서 고르면 종류가 비어 올 때가 있어 거르지 않는다. 못 여는 파일은 자르기 창이 알려 준다 */ }} />
      {picked && <AvatarCropper file={picked} onCancel={() => setPicked(null)} onDone={(b) => void upload(b)} />}
    </div>
  );
}
