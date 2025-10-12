import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { q, proximity, language = "ko" } = await req.json() as {
      q: string;                      // "장소명 주소 도시" 정도로 합친 쿼리
      proximity?: [number, number] | undefined;  // [lng, lat] 우선순위 힌트(선택)
      language?: string;
    };

    if (!q?.trim()) {
      return new Response(JSON.stringify({ error: "EMPTY_QUERY" }), { status: 400 });
    }

    const params = new URLSearchParams({
      access_token: process.env.MAPBOX_TOKEN!,
      limit: "1",
      language,
    });
    if (proximity && proximity.length === 2) {
      params.set("proximity", `${proximity[0]},${proximity[1]}`);
    }

    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?${params.toString()}`;
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) {
      const t = await r.text();
      return new Response(JSON.stringify({ error: "GEOCODE_FAILED", detail: t }), { status: 502 });
    }
    const json = await r.json();
    const f = json?.features?.[0];
    if (!f) {
      return new Response(JSON.stringify({ ok: false }), { status: 200 });
    }
    const [lng, lat] = f.center ?? [];
    return new Response(JSON.stringify({
      ok: true,
      lat, lng,
      name: f.text,
      place_name: f.place_name,
    }), { status: 200 });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: "SERVER_ERROR", detail: e?.message }), { status: 500 });
  }
}
