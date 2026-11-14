"use client";
/* 함께하는 사람 화면 내용. 버튼은 권한에 맞게만 보이고, 실제 검사는 DB 함수가 한다 */
import { useState, useTransition } from "react";
import { Button } from "@/components/kit";
import { Avatar } from "@/components/screen";
import { AlertDialog } from "@/components/gate";
import { makeInvite, revokeInvite, changeMemberRole, kickMember, giveOwner, leaveTrip } from "@/app/actions";
import { safeCall } from "@/lib/safe-call";
import type { MembersView, Member } from "@/lib/trips";

const ROLE_NAME = { owner: "여행 주인", editor: "편집 가능", viewer: "보기만" } as const;
type Ask = { title: string; desc: string; label: string; run: () => Promise<{ error?: string } | undefined | void> };

export function MembersPanel({ view }: { view: MembersView }) {
  const owner = view.role === "owner";
  const [linkRole, setLinkRole] = useState<"editor" | "viewer">(view.invite?.role ?? "editor");
  const [token, setToken] = useState(view.invite?.token ?? "");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [ask, setAsk] = useState<Ask | null>(null);
  const [busy, start] = useTransition();
  const url = token ? `${typeof window === "undefined" ? "" : window.location.origin}/invite/${token}` : "";

  const run = (fn: () => Promise<{ error?: string; token?: string } | undefined | void>, done?: string) => start(async () => {
    setError(""); setMsg("");
    const r = await safeCall(fn);
    if (r && "error" in r && r.error) return setError(r.error);
    if (r && "token" in r && r.token) setToken(r.token);
    if (done) setMsg(done);
  });
  const copy = async (u: string) => {
    try { await navigator.clipboard.writeText(u); setMsg("초대 링크를 복사했어요. 함께할 사람에게 보내 주세요"); }
    catch { setMsg("복사하지 못했어요. 링크를 길게 눌러 복사해 주세요"); }
  };

  return (
    <div className="flex flex-col gap-5 px-5 pt-5">
      {owner && (
        <section className="flex flex-col gap-3 rounded-card bg-surface p-4" aria-labelledby="invite-title">
          <h2 id="invite-title" className="text-body font-bold text-ink">초대 링크</h2>
          <div role="radiogroup" aria-label="링크로 들어온 사람의 권한" className="grid grid-cols-2 gap-1 rounded-full bg-surface-soft p-1">
            {(["editor", "viewer"] as const).map((r) => (
              <button key={r} type="button" role="radio" aria-checked={linkRole === r} disabled={busy}
                onClick={() => { setLinkRole(r); if (token && r !== linkRole) run(async () => makeInvite(view.tripId, r), `이제 링크로 들어오면 ${ROLE_NAME[r]}이에요. 예전 링크는 끊겼어요`); }}
                className={"press h-9 rounded-full text-tiny font-bold " + (linkRole === r ? "bg-surface text-ink shadow-sm" : "text-ink-sub")}>
                {ROLE_NAME[r]}로 초대
              </button>
            ))}
          </div>
          {token ? (
            <>
              <p className="break-all rounded-field bg-bg px-3 py-2 text-tiny text-ink-sub">{url}</p>
              <div className="flex gap-2">
                <Button full onClick={() => copy(url)} disabled={busy}>링크 복사</Button>
                <Button variant="secondary" disabled={busy} onClick={() => setAsk({ title: "초대 링크를 끊을까요?", desc: "이 링크로는 더 이상 들어올 수 없어요. 이미 함께하는 사람은 그대로예요", label: "끊기",
                  run: async () => { const r = await revokeInvite(view.tripId); if (!r?.error) setToken(""); return r; } })}>끊기</Button>
              </div>
              <p className="text-tiny text-ink-sub">링크는 7일 동안 쓸 수 있어요. 링크를 받은 사람은 누구나 들어올 수 있으니 함께할 사람에게만 보내 주세요</p>
            </>
          ) : (
            <Button full disabled={busy} onClick={() => run(async () => {
              const r = await makeInvite(view.tripId, linkRole);
              if (r.token) await copy(`${window.location.origin}/invite/${r.token}`);
              return r;
            })}>초대 링크 만들기</Button>
          )}
        </section>
      )}

      <section className="flex flex-col gap-2" aria-labelledby="member-title">
        <h2 id="member-title" className="text-body font-bold text-ink">함께하는 사람 {view.members.length}명</h2>
        <ul className="divide-y divide-line rounded-card bg-surface">
          {view.members.map((m) => (
            <MemberRow key={m.id} m={m} owner={owner} busy={busy}
              onRole={(role) => run(async () => changeMemberRole(view.tripId, m.id, role), `${m.name}님을 ${ROLE_NAME[role]}으로 바꿨어요`)}
              onKick={() => setAsk({ title: `${m.name}님을 내보낼까요?`, desc: "이 여행이 그 사람의 목록에서 사라져요. 다시 초대할 수 있어요", label: "내보내기", run: () => kickMember(view.tripId, m.id) })}
              onGive={() => setAsk({ title: `${m.name}님에게 여행 주인을 넘길까요?`, desc: "나는 편집 가능이 되고, 초대와 삭제는 새 주인만 할 수 있어요", label: "넘기기", run: () => giveOwner(view.tripId, m.id) })} />
          ))}
        </ul>
      </section>

      {msg && <p role="status" className="rounded-field bg-ok-soft px-3 py-2 text-tiny font-semibold text-ok-text">{msg}</p>}
      {error && <p role="alert" className="text-sub font-semibold text-point-text">{error}</p>}

      {!owner && (
        <Button variant="secondary" full disabled={busy} onClick={() => setAsk({ title: "이 여행에서 나갈까요?", desc: "여행이 내 목록에서 사라져요. 다시 들어오려면 초대 링크가 필요해요", label: "나가기", run: () => leaveTrip(view.tripId) })}>여행 나가기</Button>
      )}
      {owner && view.members.length > 1 && <p className="text-tiny text-ink-sub">여행 주인은 다른 사람에게 주인을 넘긴 뒤에 나갈 수 있어요</p>}

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
        <Avatar initial={[...m.name][0] ?? "?"} size={40} tone={m.role === "owner" ? "point" : "accent"} />
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
          <button type="button" disabled={busy} onClick={onGive} className="press h-9 text-tiny font-semibold text-ink-sub underline underline-offset-2">주인 넘기기</button>
          <button type="button" disabled={busy} onClick={onKick} className="press h-9 text-tiny font-semibold text-point-text underline underline-offset-2">내보내기</button>
        </div>
      )}
    </li>
  );
}
