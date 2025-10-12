
import { NextRequest } from "next/server";
import { GoogleGenAI } from "@google/genai";

export async function POST(req: NextRequest) {
  try {
    const { dayIndex, itemId } = await req.json();
    // 실제로는 dayIndex와 현재 Day의 장소들, 도시명 등 컨텍스트를 함께 보내세요.
    const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY });
    const prompt = `
Suggest exactly THREE alternative itinerary items as JSON array.
Each item shape:
{ "time"?: string, "place": { "name": string, "category": "food|sight|activity|cafe|shop|transport|hotel", "address"?: string, "lat"?: number, "lng"?: number, "estimatedCostKRW"?: number, "durationMin"?: number, "openHoursNote"?: string, "notes"?: string[], "imageUrl"?: string }, "tips"?: string }
No commentary. JSON array only.
`;

    const res = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { responseMimeType: "application/json", temperature: 0.7 },
    });

    const text = typeof res.text === "string" ? res.text : "";
    const arr = JSON.parse(text);
    return new Response(JSON.stringify({ candidates: arr }), { status: 200 });
  } catch (e: any) {
    console.error(e);
    return new Response(JSON.stringify({ error: "alts-failed", detail: e?.message }), { status: 500 });
  }
}
