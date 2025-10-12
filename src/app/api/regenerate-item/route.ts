import { NextRequest } from "next/server";
import { GoogleGenAI } from "@google/genai";

export async function POST(req: NextRequest) {
  try {
    const { dayIndex, item } = await req.json();

    const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY });
    const prompt = `
You are a travel planner assistant. Replace ONE itinerary block with a similar/better option.
Constraints:
- Keep category (${item.place.category}) and general theme similar.
- Prefer nearby alternatives relative to "${item.place.name}" in the same city/region context.
- Provide coordinates (lat,lng) if confidently known; otherwise omit.
- Output strictly JSON with fields: { "time"?: string, "locked"?: boolean, "place": { "name": string, "category": "...", "address"?: string, "lat"?: number, "lng"?: number, "estimatedCostKRW"?: number, "durationMin"?: number, "openHoursNote"?: string, "notes"?: string[], "imageUrl"?: string }, "tips"?: string }.
`;

    const res = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { responseMimeType: "application/json", temperature: 0.6 },
    });

    const text = typeof res.text === "string" ? res.text : "";
    const data = JSON.parse(text);
    return new Response(JSON.stringify({ item: data }), { status: 200 });
  } catch (e: any) {
    console.error(e);
    return new Response(JSON.stringify({ error: "regen-failed", detail: e?.message }), { status: 500 });
  }
}
