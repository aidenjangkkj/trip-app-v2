// src/app/api/geo/resolve/route.ts
import { NextRequest } from "next/server";
import { z } from "zod";

/** 요청 스키마: proximity는 [lng, lat] */
const BodySchema = z.object({
  q: z.string().min(1, "q must not be empty"),
  proximity: z.tuple([z.number(), z.number()]).optional(),
  language: z.string().optional().default("ko"),
});
type ResolveBody = z.infer<typeof BodySchema>;

/** Mapbox 응답 타입(필요한 필드만) */
type MapboxFeature = {
  center?: [number, number];
  text?: string;
  place_name?: string;
};
type MapboxResponse = { features?: MapboxFeature[] };

/** 타입 가드 */
function isMapboxResponse(v: unknown): v is MapboxResponse {
  if (!v || typeof v !== "object") return false;
  const features = (v as { features?: unknown }).features;
  if (!Array.isArray(features)) return false;
  // center가 [number, number]인 첫 요소만 확인
  const f = features[0];
  if (!f || typeof f !== "object") return false;
  const c = (f as { center?: unknown }).center;
  return Array.isArray(c) && c.length === 2 && c.every((n) => typeof n === "number");
}

export async function POST(req: NextRequest) {
  try {
    const raw: unknown = await req.json();
    const { q, proximity, language }: ResolveBody = BodySchema.parse(raw);

    const token = process.env.MAPBOX_TOKEN;
    if (!token) {
      return new Response(
        JSON.stringify({ error: "MISSING_MAPBOX_TOKEN" }),
        { status: 500, headers: { "content-type": "application/json" } }
      );
    }

    const params = new URLSearchParams({
      access_token: token,
      limit: "1",
      language,
    });
    if (proximity) {
      // proximity: [lng, lat]
      params.set("proximity", `${proximity[0]},${proximity[1]}`);
    }

    const url =
      `https://api.mapbox.com/geocoding/v5/mapbox.places/` +
      `${encodeURIComponent(q)}.json?${params.toString()}`;

    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) {
      const t = await r.text().catch(() => "");
      return new Response(
        JSON.stringify({ error: "GEOCODE_FAILED", status: r.status, detail: t }),
        { status: 502, headers: { "content-type": "application/json" } }
      );
    }

    let json: unknown;
    try {
      json = await r.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "INVALID_JSON_RESPONSE" }),
        { status: 502, headers: { "content-type": "application/json" } }
      );
    }

    if (!isMapboxResponse(json) || !json.features?.[0]) {
      return new Response(
        JSON.stringify({ ok: false }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }

    const f = json.features[0];
    const [lng, lat] = f.center!;
    return new Response(
      JSON.stringify({
        ok: true,
        lat,
        lng,
        name: f.text,
        place_name: f.place_name,
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return new Response(
      JSON.stringify({ error: "SERVER_ERROR", detail: message }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }
}
