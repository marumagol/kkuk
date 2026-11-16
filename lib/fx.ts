/*
  원화 환산 (2026-11-16 마루님 "예산에서 원화로 변환")
  - 환율은 ExchangeRate-API 공개 주소(open.er-api.com, 키 없음, 하루 한 번 갱신)에서 받아 12시간 저장해 둔다
  - 참고용 금액이라 계산, 저장에는 쓰지 않는다. 못 받으면 null (화면에서 원화 줄을 숨긴다)
*/
export async function krwPer(currency: string): Promise<number | null> {
  if (!/^[A-Z]{3}$/.test(currency) || currency === "KRW") return null;
  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${currency}`, { next: { revalidate: 43200 } });
    if (!res.ok) return null;
    const j = (await res.json()) as { result?: string; rates?: Record<string, number> };
    const r = j.result === "success" ? j.rates?.KRW : undefined;
    return typeof r === "number" && r > 0 ? r : null;
  } catch { return null; }
}
