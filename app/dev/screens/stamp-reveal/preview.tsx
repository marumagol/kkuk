"use client";
import { StampReveal } from "@/components/stamp-reveal";
import type { Tier } from "@/lib/card-tier";

export function RevealPreview({ tier, full }: { tier: number; full: boolean }) {
  return <StampReveal city="후쿠오카" country="JP" title="도장 꾹!" sub="후쿠오카에 다녀왔어요" visits={1} card={full ? null : { tier: tier as Tier, visit: 1 }} onClose={() => location.reload()} />;
}
