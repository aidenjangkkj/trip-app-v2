// src/app/api/geo/batch/route.ts
import { NextRequest } from "next/server";
import { z } from "zod";

/** 요청 바디 검증 */
const BodySchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        address: z.string().optional(),
      })
    )
    .min(1, "items must not be empty"),
  regionHint: z.string().optional(), // 예: "도쿄 일본"
  language: z.string().optional().default("ko"),
});
type BatchBody = z.infer<typeof BodySchema>;

/** /api/geo/resolve 응답 타입 가드 */
type ResolveOK = { ok: true; lat: number; lng: number; place_name?: string };
function isResolveOK(v: unknown): v is ResolveOK {
  return (
    typeof v === "object" &&
    v !== null &&
    (v as { ok?: unknown }).ok === true &&
    typeof (v as { lat?: unknown }).lat === "number" &&
    typeof (v as { lng?: unknown }).lng === "number"
  );
}

export async function POST(req: NextRequest) {
  try {
    const raw: unknown = await req.json();
    const { items, regionHint, language }: BatchBody = BodySchema.parse(raw);

    const out: Record<string, { lat?: number; lng?: number; place_name?: string }> = {};

    // 순차 호출(필요 시 Promise.all + rate-limit 조정 가능)
    for (const it of items) {
      const q = [it.name, it.address, regionHint].filter(Boolean).join(" ");

      const base =
        process.env.NEXT_PUBLIC_BASE_URL ??
        new URL(req.url).origin;

      const r = await fetch(`${base}/api/geo/resolve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ q, language }),
      });

      // 응답이 JSON이 아닐 수도 있으므로 방어적으로 처리
      let json: unknown;
      try {
        json = await r.json();
      } catch {
        json = null;
      }

      if (isResolveOK(json)) {
        out[it.id] = {
          lat: json.lat,
          lng: json.lng,
          place_name: json.place_name,
        };
      } else {
        out[it.id] = {}; // 실패 시 빈 객체
      }

      // (선택) API 보호용 소량 딜레이
      // await new Promise((res) => setTimeout(res, 120));
    }

    return new Response(JSON.stringify({ ok: true, result: out }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return new Response(
      JSON.stringify({ error: "SERVER_ERROR", detail: message }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }
}
