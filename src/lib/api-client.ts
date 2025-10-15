// src/lib/api-client.ts
import type { TripItem } from "@/types/trip";

/** 항상 text로 받고 JSON 파싱을 시도하는 안전 파서 */
export async function safeJson(res: Response) {
  const txt = await res.text();
  if (!txt) return { ok: res.ok, status: res.status, data: {} as any, raw: "" };
  try {
    return { ok: res.ok, status: res.status, data: JSON.parse(txt), raw: txt };
  } catch {
    return { ok: res.ok, status: res.status, data: null, raw: txt };
  }
}

/** 대안 3개 요청 */
export async function fetchAlternatives(dayIndex: number, itemId: string) {
  const res = await fetch("/api/items/alternatives", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ dayIndex, itemId }),
  });
  const { ok, status, data, raw } = await safeJson(res);
  if (!ok) {
    const msg = (data as any)?.error ?? `HTTP ${status}`;
    throw new Error(`[alts] ${msg} :: ${String(raw).slice(0, 300)}`);
  }
  return (data as any).candidates as Array<{
    time?: string;
    place: TripItem["place"];
    tips?: string;
  }>;
}

/** 아이템 재생성(대체 1개) */
export async function fetchRegenerateItem(
  dayIndex: number,
  item: TripItem
): Promise<TripItem> {
  const res = await fetch("/api/regenerate-item", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ dayIndex, item }),
  });
  const { ok, status, data, raw } = await safeJson(res);
  if (!ok) {
    const msg = (data as any)?.error ?? `HTTP ${status}`;
    throw new Error(`[regen] ${msg} :: ${String(raw).slice(0, 300)}`);
  }
  return (data as any).item as TripItem;
}

// src/app/api/regenerate-item/route.ts