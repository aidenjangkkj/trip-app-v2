// src/lib/api-client.ts
import type { TripItem } from "@/types/trip";

/** safeJson 반환 타입 정의 */
interface SafeJsonResult<T> {
  ok: boolean;
  status: number;
  data: T | null;
  raw: string;
}

/** 항상 text로 받고 JSON 파싱을 시도하는 안전 파서 (제네릭 지원) */
export async function safeJson<T = unknown>(res: Response): Promise<SafeJsonResult<T>> {
  const txt = await res.text();
  if (!txt) {
    return { ok: res.ok, status: res.status, data: {} as T, raw: "" };
  }
  try {
    return { ok: res.ok, status: res.status, data: JSON.parse(txt) as T, raw: txt };
  } catch {
    return { ok: res.ok, status: res.status, data: null, raw: txt };
  }
}

/** 대안 후보 아이템 타입 */
export interface AlternativeItem {
  time?: string;
  place: TripItem["place"];
  tips?: string;
}

/** 대안 3개 요청 */
export async function fetchAlternatives(
  dayIndex: number,
  itemId: string
): Promise<AlternativeItem[]> {
  const res = await fetch("/api/items/alternatives", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ dayIndex, itemId }),
  });

  // 제네릭 타입으로 반환 타입 지정
  const { ok, status, data, raw } = await safeJson<{ candidates: AlternativeItem[]; error?: string }>(res);

  if (!ok || !data) {
    const msg = data?.error ?? `HTTP ${status}`;
    throw new Error(`[alts] ${msg} :: ${String(raw).slice(0, 300)}`);
  }

  return data.candidates;
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

  const { ok, status, data, raw } = await safeJson<{ item: TripItem; error?: string }>(res);

  if (!ok || !data) {
    const msg = data?.error ?? `HTTP ${status}`;
    throw new Error(`[regen] ${msg} :: ${String(raw).slice(0, 300)}`);
  }

  return data.item;
}
