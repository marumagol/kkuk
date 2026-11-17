"use client";
/* 함께하는 사람 화면 내용. 버튼은 권한에 맞게만 보이고, 실제 검사는 DB 함수가 한다
   초대 링크는 항상 보기만으로 들어오고, 호스트가 들어온 뒤 권한을 바꾼다 (2026-11-14 마루님) */
import { useEffect, useState, useTransition } from "react";
import { Button, Icon } from "@/components/kit";
import { Avatar } from "@/components/screen";
import { AlertDialog } from "@/components/gate";
import { makeInvite, revokeInvite, changeMemberRole, kickMember, giveOwner, leaveTrip } from "@/app/actions";
import { safeCall } from "@/lib/safe-call";
import type { MembersView, Member } from "@/lib/trips";

const ROLE_NAME = { owner: "호스트", editor: "편집 가능", viewer: "보기만" } as const;
type Ask = { title: string; desc: string; label: string; run: () => Promise<{ error?: string } | undefined | void> };

export function MembersPanel({ view }: { view: MembersView }) {
  const owner = view.role === "owner";
  const [token, setToken] = useState(view.invite?.token ?? "");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [ask, setAsk] = useState<Ask | null>(null);
  const [busy, start] = useTransition();
  // 주소 앞부분은 브라우저에서만 안다. 서버 화면과 어긋나지 않게 그린 뒤에 채운다
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const url = token ? `${origin}/invite/${token}` : "";

  const run = (fn: () => Promise<{ error?: string; token?: string } | undefined | void>, done?: string) => start(async () => {
    setError(""); setMsg("");
    const r = await safeCall(fn);
    if (r && "error" in r && r.error) return setError(r.error);
    if (r && "token" in r && r.token) setToken(r.token);
    if (done) setMsg(done);
  });
  const [canShare, setCanShare] = useState(false);
  useEffect(() => setCanShare(typeof navigator.share === "function"), []);
  const share = async (u: string) => {
    try { await navigator.share({ title: "KKuK 여행 초대", text: "같이 여행 계획해요", url: u }); }
    catch (e) { if ((e as Error)?.name !== "AbortError") await copy(u); }
  };
  const copy = async (u: string) => {
    try { await navigator.clipboard.writeText(u); setMsg("초대 링크를 복사했어요. 함께할 사람에게 보내 주세요"); }
    catch { setMsg("복사하지 못했어요. 링크를 길게 눌러 복사해 주세요"); }
  };

  return (
    <div className="flex flex-col gap-5 px-5 pt-5">
      {owner && (
        /* 초대 링크 카드 (2026-11-16 마루님 "한눈에 이해되게") : 주소 한 줄 + 복사, 큰 버튼 하나로 보내기, 링크 끄기는 아래 작은 글자 버튼 */
        <section className="flex flex-col gap-3 rounded-card bg-surface p-5" aria-labelledby="invite-title">
          <div className="flex items-center justify-between gap-2">
            <h2 id="invite-title" className="text-body font-bold text-ink">초대 링크</h2>
            {token && <span className="flex-none rounded-full bg-accent-soft px-2.5 py-1 text-tiny font-bold text-accent-text">7일 동안 열려 있어요</span>}
          </div>
          <p className="text-sub text-ink-sub">링크로 들어온 사람은 보기만으로 시작해요. 아래 목록에서 편집 가능으로 바꿀 수 있어요</p>
          {token ? (
            <>
              <div className="flex min-h-12 items-center gap-2 rounded-field bg-bg py-1.5 pl-3 pr-1.5">
                <Icon name="link" size={16} className="flex-none text-ink-sub" />
                <span className="min-w-0 flex-1 truncate text-sub text-ink" title={url}>{url.replace(/^https?:\/\//, "")}</span>
                <button type="button" onClick={() => copy(url)} disabled={busy}
                  className="press h-9 flex-none whitespace-nowrap rounded-full bg-surface px-3.5 text-tiny font-bold text-ink ring-1 ring-line">복사</button>
              </div>
              <Button full size="lg" onClick={() => (canShare ? share(url) : copy(url))} disabled={busy}>{canShare ? "카카오톡 등으로 보내기" : "링크 복사"}</Button>
              <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
                <p className="flex min-w-0 items-start gap-1.5 text-tiny text-ink-sub"><Icon name="lock" size={14} className="mt-px flex-none" />링크를 받은 누구나 들어올 수 있어요. 함께할 사람에게만 보내 주세요</p>
                <button type="button" disabled={busy} onClick={() => setAsk({ title: "초대 링크를 끌까요?", desc: "이 링크로는 더 이상 들어올 수 없어요. 이미 함께하는 사람은 그대로예요. 필요하면 새 링크를 다시 만들 수 있어요", label: "링크 끄기",
                  run: async () => { const r = await revokeInvite(view.tripId); if (!r?.error) setToken(""); return r; } })}
                  className="press h-9 flex-none whitespace-nowrap rounded-full px-2 text-tiny font-bold text-point-text">링크 끄기</button>
              </div>
            </>
          ) : (
            <Button full size="lg" disabled={busy} onClick={() => run(async () => {
              const r = await makeInvite(view.tripId, "viewer");
              if (r.token) await copy(`${window.location.origin}/invite/${r.token}`);
              return r;
            })}>초대 링크 만들기</Button>
          )}
        </section>
      )}

      <section className="flex flex-col gap-2" aria-labelledby="member-title">
        <h2 id="member-title" className="px-1 text-body font-bold text-ink">함께하는 사람 {view.members.length}명</h2>
        <ul className="divide-y divide-line rounded-card bg-surface">
          {view.members.map((m) => (
            <MemberRow key={m.id} m={m} owner={owner} busy={busy}
              onRole={(role) => run(async () => changeMemberRole(view.tripId, m.id, role), `${m.name}님을 ${ROLE_NAME[role]}으로 바꿨어요`)}
              onKick={() => setAsk({ title: `${m.name}님을 내보낼까요?`, desc: "이 여행이 그 사람의 목록에서 사라져요. 다시 초대할 수 있어요", label: "내보내기", run: () => kickMember(view.tripId, m.id) })}
              onGive={() => setAsk({ title: `${m.name}님에게 호스트를 넘길까요?`, desc: "나는 편집 가능이 되고, 초대와 삭제는 새 호스트만 할 수 있어요", label: "넘기기", run: () => giveOwner(view.tripId, m.id) })} />
          ))}
        </ul>
      </section>

      {msg && <p role="status" className="rounded-field bg-ok-soft px-3 py-2 text-tiny font-semibold text-ok-text">{msg}</p>}
      {error && <p role="alert" className="text-sub font-semibold text-point-text">{error}</p>}

      {!owner && (
        <Button variant="secondary" full disabled={busy} onClick={() => setAsk({ title: "이 여행에서 나갈까요?", desc: "여행이 내 목록에서 사라져요. 다시 들어오려면 초대 링크가 필요해요", label: "나가기", run: () => leaveTrip(view.tripId) })}>여행 나가기</Button>
      )}
      {owner && view.members.length > 1 && <p className="text-tiny text-ink-sub">호스트는 다른 사람에게 호스트를 넘긴 뒤에 나갈 수 있어요</p>}

      {ask && <AlertDialog title={ask.title} desc={ask.desc} confirmLabel={ask.label} onClose={() => setAsk(null)}
        confirm={() => { const a = ask; setAsk(null); run(a.run); }} />}
    </div>
  );
}

function MemberRow({ m, owner, busy, onRole, onKick, onGive }: {
  m: Member; owner: boolean; busy: boolean; onRole: (r: "editor" | "viewer") => void; onKick: () => void; onGive: () => void;
}) {
  const manage = owner && m.role !== "owner";
  return (
    <li className="flex flex-col gap-2 px-4 py-3">
      <div className="flex items-center gap-3">
        <Avatar initial={[...m.name][0] ?? "?"} size={40} tone={m.role === "owner" ? "point" : "accent"} src={m.avatar} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-body font-bold text-ink">{m.name}{m.isMe && <span className="ml-1 text-tiny font-semibold text-ink-sub">(나)</span>}</p>
          <p className="text-tiny text-ink-sub">{ROLE_NAME[m.role]}</p>
        </div>
        {manage && (
          <label className="flex-none">
            <span className="sr-only">{m.name}님의 권한</span>
            <select value={m.role} disabled={busy} onChange={(e) => onRole(e.target.value as "editor" | "viewer")}
              className="h-11 rounded-field border border-line-strong bg-surface px-3 text-sub text-ink">
              <option value="editor">편집 가능</option>
              <option value="viewer">보기만</option>
            </select>
          </label>
        )}
      </div>
      {manage && (
        <div className="flex gap-4 pl-[52px]">
          <button type="button" disabled={busy} onClick={onGive} className="press h-9 text-tiny font-semibold text-ink-sub underline underline-offset-2">호스트 넘기기</button>
          <button type="button" disabled={busy} onClick={onKick} className="press h-9 text-tiny font-semibold text-point-text underline underline-offset-2">내보내기</button>
        </div>
      )}
    </li>
  );
}
