"use client";
/* 표시 이름 입력 (처음 로그인 S04, 마이 > 이름 바꾸기). 저장은 app/actions.ts 의 saveName */
import { useActionState, useState } from "react";
import { Field, Button } from "@/components/kit";
import { saveName, type NameState } from "@/app/actions";
import { safeCall } from "@/lib/safe-call";

export function NameForm({ next, initial = "", submitLabel }: { next: string; initial?: string; submitLabel: string }) {
  const [state, action, busy] = useActionState<NameState, FormData>((prev, fd) => safeCall(() => saveName(prev, fd)), {});
  const [name, setName] = useState(initial);
  const len = [...name.trim()].length;
  return (
    <form action={action} noValidate className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <Field label="이름" name="name" autoComplete="nickname" placeholder="예 : 여행하는 고양이" maxLength={30}
        value={name} onChange={(e) => setName(e.target.value)}
        error={len > 20 ? "이름은 20자까지 쓸 수 있어요" : state.error}
        hint={`${len}/20자. 함께하는 사람에게 이 이름으로 보여요`} disabled={busy} autoFocus />
      <Button full type="submit" disabled={busy || len < 1 || len > 20}>{busy ? "저장하는 중" : submitLabel}</Button>
    </form>
  );
}
