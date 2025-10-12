import { NextRequest } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { SYSTEM_PROMPT, USER_PROMPT } from "@/lib/prompt";

/** --- Zod: 모델 응답 스키마 검증 --- */
const TripPlanSchema = z.object({
  title: z.string(),
  summary: z.array(z.string()).optional(),
  days: z.array(z.object({
    date: z.string().optional(),
    theme: z.string().optional(),
    items: z.array(z.object({
      time: z.string().optional(),
      place: z.object({
        id: z.string().optional(),
        name: z.string(),
        category: z.enum(["food","sight","activity","cafe","shop","transport","hotel"]),
        address: z.string().optional(),
        lat: z.number().optional(),
        lng: z.number().optional(),
        estimatedCostKRW: z.number().optional(),
        durationMin: z.number().optional(),
        openHoursNote: z.string().optional(),
        notes: z.array(z.string()).optional(),
        imageUrl: z.string().url().optional(),
      }),
      tips: z.string().optional(),
    })),
  })),
  overallBudgetKRW: z.number().optional(),
  cautions: z.array(z.string()).optional(),
});

/** --- 느슨한 JSON 파서 --- */
function tryParseJsonLoose(raw: string) {
  const s = (raw ?? "").trim();
  if (!s) return { ok: false as const, err: "EMPTY_RESPONSE" };
  try { return { ok: true as const, data: JSON.parse(s) }; } catch {}
  const first = Math.min(...["{","["].map(ch => s.indexOf(ch)).filter(i => i >= 0));
  const last = Math.max(s.lastIndexOf("}"), s.lastIndexOf("]"));
  if (first >= 0 && last > first) {
    const slice = s.slice(first, last + 1);
    try { return { ok: true as const, data: JSON.parse(slice) }; } catch {}
  }
  return { ok: false as const, err: "INVALID_JSON", raw: s };
}

/** --- 신 SDK(@google/genai) 응답에서 안전하게 텍스트 추출 --- */
function extractTextStrict(result: any): string | undefined {
  if (typeof result?.text === "function") {
    const t = result.text();
    if (typeof t === "string" && t.trim()) return t;
  }
  const parts =
    result?.candidates?.[0]?.content?.parts ??
    result?.candidates?.find((c: any) => c?.content?.parts)?.content?.parts;
  if (Array.isArray(parts)) {
    const joined = parts
      .map((p: any) => (typeof p?.text === "string" ? p.text : ""))
      .filter(Boolean)
      .join("\n")
      .trim();
    if (joined) return joined;
  }
  return undefined;
}

/** --- API Route --- */
export async function POST(req: NextRequest) {
  try {
    const input = await req.json();

    const ai = new GoogleGenAI({
      apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    });

    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash", // 필요 시 "gemini-2.5-pro"
      contents: [
        { role: "user", parts: [{ text: SYSTEM_PROMPT }] },
        { role: "user", parts: [{ text: USER_PROMPT(input) }] },
      ],
      config: {
        temperature: 0.6,
        responseMimeType: "application/json",
      },
    });

    const text = extractTextStrict(result);
    if (!text) {
      return new Response(JSON.stringify({
        error: "EMPTY_OR_UNREADABLE_RESPONSE",
        hint: "No text() and no candidates content. Check safety blocks or quota.",
        debug: {
          hasTextFn: typeof (result as any)?.text === "function",
          hasCandidates: Array.isArray((result as any)?.candidates),
        },
      }), { status: 502, headers: { "content-type": "application/json" } });
    }

    const loose = tryParseJsonLoose(text);
    if (!loose.ok) {
      return new Response(JSON.stringify({
        error: "Model returned invalid or empty JSON",
        detail: loose.err,
        sample: (loose as any).raw?.slice(0, 400) ?? null,
      }), { status: 502, headers: { "content-type": "application/json" } });
    }

    const parsed = TripPlanSchema.safeParse(loose.data);
    if (!parsed.success) {
      return new Response(JSON.stringify({
        error: "Invalid JSON shape",
        issues: parsed.error.flatten(),
      }), { status: 422, headers: { "content-type": "application/json" } });
    }

    return new Response(JSON.stringify(parsed.data), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (e: any) {
    console.error(e);
    return new Response(JSON.stringify({
      error: "Generation failed",
      detail: e?.message,
    }), { status: 500, headers: { "content-type": "application/json" } });
  }
}
