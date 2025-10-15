// src/app/api/items/alternatives/route.ts
import { NextRequest } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { PlaceSchema, TripItemSchema } from "@/types/trip";

/** 요청 바디 검증 */
const BodySchema = z.object({
  dayIndex: z.number().int().min(0),
  itemId: z.string(),
});
type AlternativesBody = z.infer<typeof BodySchema>;

/** 모델 응답(대안 아이템) 검증: TripItem의 서브셋 */
const AltItemSchema = TripItemSchema.pick({
  time: true,
  place: true,
  tips: true,
}).extend({
  // 모델이 id/locked를 넣어도 허용 (무시 목적)
  id: z.string().optional(),
  locked: z.boolean().optional(),
});
const AltArraySchema = z.array(AltItemSchema).length(3, "must return exactly three items");
type AltItem = z.infer<typeof AltItemSchema>;

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
    const joined = parts
      .map((p) => (typeof p?.text === "string" ? p.text : ""))
      .filter(Boolean)
      .join("\n")
      .trim();
    if (joined) return joined;
  }
  return undefined;
}

/** 모델이 JSON 배열을 반환하지 않을 경우를 위한 느슨한 파서 */
function tryParseJsonArray(raw: string) {
  const s = (raw ?? "").trim();
  if (!s) return { ok: false as const, err: "EMPTY" as const };
  try {
    const data = JSON.parse(s) as unknown;
    return Array.isArray(data) ? { ok: true as const, data } : { ok: false as const, err: "NOT_ARRAY" as const };
  } catch {
    // 앞뒤 잡음 제거 시도
    const first = s.indexOf("[");
    const last = s.lastIndexOf("]");
    if (first >= 0 && last > first) {
      try {
        const data = JSON.parse(s.slice(first, last + 1)) as unknown;
        return Array.isArray(data) ? { ok: true as const, data } : { ok: false as const, err: "NOT_ARRAY" as const };
      } catch {
        return { ok: false as const, err: "INVALID_JSON" as const };
      }
    }
    return { ok: false as const, err: "INVALID_JSON" as const };
  }
}

export async function POST(req: NextRequest) {
  try {
    const raw: unknown = await req.json();
    const { dayIndex, itemId }: AlternativesBody = BodySchema.parse(raw);

    // dayIndex/itemId를 프롬프트에 포함(미사용 경고 방지 + 약간의 컨텍스트)
    const prompt = `
Return EXACTLY THREE alternative itinerary items as a pure JSON array. No commentary.
Each item shape:
{
  "time"?: string,
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

Context (hint only): dayIndex=${dayIndex}, replacing itemId="${itemId}".
`;

    const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY });

    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { responseMimeType: "application/json", temperature: 0.7 },
    });

    const text = extractTextStrict(result);
    if (!text) {
      return new Response(
        JSON.stringify({
          error: "EMPTY_OR_UNREADABLE_RESPONSE",
          hint: "No text() and no candidates content.",
        }),
        { status: 502, headers: { "content-type": "application/json" } }
      );
    }

    const loose = tryParseJsonArray(text);
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

    const validated = AltArraySchema.safeParse(loose.data);
    if (!validated.success) {
      return new Response(
        JSON.stringify({
          error: "INVALID_ALT_ITEMS",
          issues: validated.error.flatten(),
        }),
        { status: 422, headers: { "content-type": "application/json" } }
      );
    }

    const candidates: AltItem[] = validated.data;
    return new Response(JSON.stringify({ candidates }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return new Response(
      JSON.stringify({ error: "alts-failed", detail: message }),
      {
        status: 500,
        headers: { "content-type": "application/json" },
      }
    );
  }
}
