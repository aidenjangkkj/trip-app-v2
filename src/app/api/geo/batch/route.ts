import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { items, regionHint, language = "ko" } = await req.json() as {
      items: Array<{ id: string; name: string; address?: string }>;
      regionHint?: string; // "도쿄 일본" 같이 도시/국가 힌트
      language?: string;
    };
    if (!Array.isArray(items) || items.length === 0) {
      return new Response(JSON.stringify({ error: "EMPTY_ITEMS" }), { status: 400 });
    }
    const out: Record<string, { lat?: number; lng?: number; place_name?: string }> = {};

    // 순차(간단) — 필요 시 Promise.all + rate limit 조정
    for (const it of items) {
      const q = [it.name, it.address, regionHint].filter(Boolean).join(" ");
      const r = await fetch(process.env.NEXT_PUBLIC_BASE_URL
        ? `${process.env.NEXT_PUBLIC_BASE_URL}/api/geo/resolve`
        : `${new URL(req.url).origin}/api/geo/resolve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ q, language }),
      });
      const json = await r.json();
      if (json?.ok) {
        out[it.id] = { lat: json.lat, lng: json.lng, place_name: json.place_name };
      } else {
        out[it.id] = {};
      }
      // (선택) API 보호용 소량 딜레이
      // await new Promise(res => setTimeout(res, 120));
    }
    return new Response(JSON.stringify({ ok: true, result: out }), { status: 200 });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: "SERVER_ERROR", detail: e?.message }), { status: 500 });
  }
}
