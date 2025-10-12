// src/app/api/generate/route.ts
import { NextRequest } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { SYSTEM_PROMPT, USER_PROMPT } from "@/lib/prompt";
import { TripInputSchema, TripPlanSchema, type TripInput, type TripPlan } from "@/types/trip";

/** 느슨한 JSON 파서 (모델 응답용) */
function tryParseJsonLoose(raw: string) {
  const s = (raw ?? "").trim();
  if (!s) return { ok: false as const, err: "EMPTY_RESPONSE" as const };
  try { return { ok: true as const, data: JSON.parse(s) as unknown }; } catch {}
  const first = Math.min(...["{","["].map(ch => s.indexOf(ch)).filter(i => i >= 0));
  const last = Math.max(s.lastIndexOf("}"), s.lastIndexOf("]"));
  if (first >= 0 && last > first) {
    const slice = s.slice(first, last + 1);
    try { return { ok: true as const, data: JSON.parse(slice) as unknown }; } catch {}
  }
  return { ok: false as const, err: "INVALID_JSON" as const, raw: s };
}

/** 신 SDK 응답에서 안전하게 텍스트 추출 */
function extractTextStrict(result: unknown): string | undefined {
  const r = result as { text?: () => string; candidates?: { content?: { parts?: { text?: string }[] } }[] } | undefined;
  if (r && typeof r.text === "function") {
    const t = r.text();
    if (typeof t === "string" && t.trim()) return t;
  }
  const parts =
    r?.candidates?.[0]?.content?.parts ??
    r?.candidates?.find(c => Array.isArray(c?.content?.parts))?.content?.parts;
  if (Array.isArray(parts)) {
    const joined = parts.map(p => (typeof p?.text === "string" ? p.text : "")).filter(Boolean).join("\n").trim();
    if (joined) return joined;
  }
  return undefined;
}

export async function POST(req: NextRequest) {
  try {
    const raw: unknown = await req.json();

    // ✅ unknown → TripInput 확정
    const input: TripInput = TripInputSchema.parse(raw);

    const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY });
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        { role: "user", parts: [{ text: SYSTEM_PROMPT }] },
        { role: "user", parts: [{ text: USER_PROMPT(input) }] }, // ← 타입 일치
      ],
      config: { temperature: 0.6, responseMimeType: "application/json" },
    });

    const text = extractTextStrict(result);
    if (!text) {
      return new Response(JSON.stringify({ error: "EMPTY_OR_UNREADABLE_RESPONSE" }), {
        status: 502, headers: { "content-type": "application/json" },
      });
    }

    const loose = tryParseJsonLoose(text);
    if (!loose.ok) {
      return new Response(JSON.stringify({
        error: "Model returned invalid or empty JSON",
        detail: loose.err,
        sample: "raw" in loose ? (loose as { raw?: string }).raw?.slice(0, 400) ?? null : null,
      }), { status: 502, headers: { "content-type": "application/json" } });
    }

    // ✅ 모델 JSON → TripPlan 확정
    const parsed = TripPlanSchema.safeParse(loose.data);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "Invalid JSON shape", issues: parsed.error.flatten() }), {
        status: 422, headers: { "content-type": "application/json" },
      });
    }

    const data: TripPlan = parsed.data;
    return new Response(JSON.stringify(data), { status: 200, headers: { "content-type": "application/json" } });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: "Generation failed", detail: message }), {
      status: 500, headers: { "content-type": "application/json" },
    });
  }
}
