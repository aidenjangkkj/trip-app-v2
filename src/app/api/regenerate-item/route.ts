// src/app/api/items/regenerate-item/route.ts
import { NextRequest } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { TripItemSchema, type TripItem } from "@/types/trip";

/** 요청 바디 검증: dayIndex + 교체 대상 item */
const BodySchema = z.object({
  dayIndex: z.number().int().min(0),
  item: TripItemSchema,
});
type AltReq = z.infer<typeof BodySchema>;

/** Gemini SDK 결과에서 텍스트 안전 추출 */
function extractTextStrict(result: unknown): string | undefined {
  const r = result as { text?: () => string; candidates?: { content?: { parts?: { text?: string }[] } }[] } | undefined;
  if (r && typeof r.text === "function") {
    const t = r.text();
    if (typeof t === "string" && t.trim()) return t;
  }
  const parts =
    r?.candidates?.[0]?.content?.parts ??
    r?.candidates?.find((c) => Array.isArray(c?.content?.parts))?.content?.parts;
  if (Array.isArray(parts)) {
    const joined = parts.map(p => (typeof p?.text === "string" ? p.text : "")).filter(Boolean).join("\n").trim();
    if (joined) return joined;
  }
  return undefined;
}

/** 모델이 단일 객체 JSON을 반환하도록 파싱(+잡음 제거) */
function tryParseJsonObject(raw: string) {
  const s = (raw ?? "").trim();
  if (!s) return { ok: false as const, err: "EMPTY" as const };
  const parse = (txt: string) => {
    const v = JSON.parse(txt) as unknown;
    return v && typeof v === "object" && !Array.isArray(v)
      ? { ok: true as const, data: v }
      : { ok: false as const, err: "NOT_OBJECT" as const };
  };
  try { return parse(s); } catch {}
  const first = s.indexOf("{"); const last = s.lastIndexOf("}");
  if (first >= 0 && last > first) {
    try { return parse(s.slice(first, last + 1)); } catch {}
  }
  return { ok: false as const, err: "INVALID_JSON" as const };
}

export async function POST(req: NextRequest) {
  try {
    const raw: unknown = await req.json();
    const { dayIndex, item }: AltReq = BodySchema.parse(raw);

    const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY });

    const prompt = `
You are a travel planner assistant. Replace ONE itinerary block with a similar/better option.
Constraints:
- Keep category (${item.place.category}) and general theme similar.
- Prefer nearby alternatives relative to "${item.place.name}" in the same city/region context.
- Provide coordinates (lat,lng) if confidently known; otherwise omit.
- Output strictly JSON object with fields:
  {
    "time"?: string,
    "locked"?: boolean,
    "place": {
      "name": string(Korean),
      "category": "food"|"sight"|"activity"|"cafe"|"shop"|"transport"|"hotel",
      "address"?: string,
      "lat"?: number,
      "lng"?: number,
      "estimatedCostKRW"?: number,
      "durationMin"?: number,
      "openHoursNote"?: string,
      "notes"?: string[],
      "imageUrl"?: string
    },
    "tips"?: string(Korean)
  }
Context (hint): dayIndex=${dayIndex}, replacing "${item.place.name}".
No commentary. Return only the JSON object.
`.trim();

    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { responseMimeType: "application/json", temperature: 0.6 },
    });

    const text = extractTextStrict(result);
    if (!text) {
      return new Response(
        JSON.stringify({ error: "EMPTY_OR_UNREADABLE_RESPONSE" }),
        {
          status: 502,
          headers: { "content-type": "application/json" },
        }
      );
    }

    const loose = tryParseJsonObject(text);
    if (!loose.ok) {
      return new Response(
        JSON.stringify({
          error: "INVALID_MODEL_JSON",
          detail: loose.err,
          sample: text.slice(0, 300),
        }),
        { status: 502, headers: { "content-type": "application/json" } }
      );
    }

    const validated = TripItemSchema.safeParse(loose.data);
    if (!validated.success) {
      return new Response(
        JSON.stringify({
          error: "INVALID_ITEM_SHAPE",
          issues: validated.error.flatten(),
        }),
        { status: 422, headers: { "content-type": "application/json" } }
      );
    }

    const alt: TripItem = validated.data;
    return new Response(JSON.stringify({ item: alt }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return new Response(
      JSON.stringify({ error: "regen-failed", detail: message }),
      {
        status: 500,
        headers: { "content-type": "application/json" },
      }
    );
  }
}
