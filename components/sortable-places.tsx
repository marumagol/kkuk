"use client";
/*
  S07 일자별 장소 : 손잡이(점 6개)를 끌어서 순서 바꾸기
  - 휴대폰, PC : 손잡이를 누른 채 위아래로 끌고 놓는 순간 저장
  - 키보드 : 손잡이에 초점을 두고 위/아래 화살표
  - 저장에 실패하면 원래 자리로 되돌리고 안내
  카드를 누르면 장소 수정으로 간다 (손잡이는 카드 밖에 있어 눌러도 이동하지 않음)
*/
import { useEffect, useRef, useState } from "react";
import { Icon, PinCard } from "@/components/kit";
import { reorderPlaces } from "@/app/actions";
import { safeCall } from "@/lib/safe-call";
import type { Item } from "@/lib/mock";

export function SortablePlaces({ tripId, items, editable }: { tripId: string; items: Item[]; editable: boolean }) {
  const [order, setOrder] = useState(items);
  const [dragId, setDragId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const rows = useRef(new Map<string, HTMLLIElement>());
  const before = useRef<Item[]>(items);
  const orderRef = useRef(order);
  orderRef.current = order;

  // 저장 뒤 서버에서 새 목록이 오면 맞춘다 (끄는 중에는 그대로)
  useEffect(() => { if (!dragId) setOrder(items); }, [items]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async (next: Item[]) => {
    const prev = before.current;
    if (next.map((i) => i.id).join() === prev.map((i) => i.id).join()) return;
    setMsg("");
    const r = await safeCall(() => reorderPlaces(tripId, next.map((i) => i.id!)));
    if (r?.error) { setOrder(prev); setMsg(r.error); }
    else setMsg("순서를 바꿨어요");
  };

  const moveTo = (id: string, y: number) => {
    const list = orderRef.current;
    const others = list.filter((i) => i.id !== id);
    let idx = 0;
    for (const o of others) {
      const el = rows.current.get(o.id!);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (y > r.top + r.height / 2) idx++;
    }
    const me = list.find((i) => i.id === id)!;
    const next = [...others.slice(0, idx), me, ...others.slice(idx)];
    if (next.some((x, i) => x !== list[i])) setOrder(next);
  };

  const onKey = (e: React.KeyboardEvent, id: string) => {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    e.preventDefault();
    const list = orderRef.current;
    const i = list.findIndex((x) => x.id === id);
    const j = e.key === "ArrowUp" ? i - 1 : i + 1;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    before.current = list;
    setOrder(next);
    save(next);
    requestAnimationFrame(() => rows.current.get(id)?.querySelector<HTMLButtonElement>("button[data-grip]")?.focus());
  };

  const canSort = editable && order.length > 1 && order.every((i) => i.id);

  return (
    <>
      <ol className="flex flex-col" aria-label="장소 순서">
        {order.map((it, i) => (
          <li key={it.id ?? i} ref={(el) => { if (el && it.id) rows.current.set(it.id, el); }}
            className={"flex items-start gap-1 transition-transform " + (dragId === it.id ? "relative z-10 scale-[1.02] opacity-90 drop-shadow-lg" : "")}>
            <div className="min-w-0 flex-1">
              <PinCard index={i + 1} time={it.time ?? ""} category={it.category} title={it.title}
                desc={it.desc ?? ""} editedBy={it.editedBy} editedFace={it.editedFace} editedAgo={it.editedAgo} photo={it.photos?.find((x) => !x.path.endsWith(".pdf"))?.url} photoCount={it.photos?.length} last={i === order.length - 1}
                href={editable && it.id ? `/trips/${tripId}/places/${it.id}` : undefined} />
            </div>
            {canSort && (
              <button type="button" data-grip aria-label={`${it.title} 순서 옮기기. 위아래 화살표로 옮겨요`}
                className="press mt-2 flex size-11 flex-none cursor-grab touch-none items-center justify-center rounded-full text-ink-sub active:cursor-grabbing"
                onKeyDown={(e) => onKey(e, it.id!)}
                onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); before.current = orderRef.current; setDragId(it.id!); setMsg(""); }}
                onPointerMove={(e) => { if (dragId === it.id) moveTo(it.id!, e.clientY); }}
                onPointerUp={() => { if (dragId) { setDragId(null); save(orderRef.current); } }}
                onPointerCancel={() => { if (dragId) { setDragId(null); setOrder(before.current); } }}>
                <Icon name="grip" size={22} />
              </button>
            )}
          </li>
        ))}
      </ol>
      <p role="status" aria-live="polite" className={msg ? "rounded-field bg-surface px-3 py-2 text-tiny font-semibold text-ink" : "sr-only"}>{msg}</p>
    </>
  );
}
