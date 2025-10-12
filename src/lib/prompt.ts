import type { TripInput } from "@/types/trip";

export const SYSTEM_PROMPT = `
You are a meticulous trip planner that outputs STRICT JSON matching the provided TypeScript types.
STRICT JSON ONLY. No markdown, no code fences, no comments, no trailing commas.
Korean by default unless another language is requested.
Ensure realistic, cluster-by-area daily plans with transport/cost notes.
`;

export const USER_PROMPT = (input: TripInput) => `
Make a ${input.days}-day itinerary for: ${input.regions.join(", ")}.
Interests: ${input.interests.join(", ")}. Pace: ${input.pace ?? "balanced"}.
Budget tier: ${input.budgetTier ?? "mid"}. Travelers: ${input.travelers ?? 2}.
Dietary: ${input.dietary?.join(", ") || "none"}.
Language: ${input.language ?? "ko"}.

Return JSON with shape:
{
  "title": string,
  "summary": string[],
  "days": [
    {
      "date"?: string,
      "theme"?: string,
      "items": [
        {
          "time"?: string,
          "place": {
            "name": string,
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
          "tips"?: string
        }
      ]
    }
  ],
  "overallBudgetKRW"?: number,
  "cautions"?: string[]
}

Rules:
- Cluster nearby spots per day; minimize travel time.
- Add brief transit hints in notes.
- Estimate costs conservatively in KRW.
- If concrete hours are unknown, include a generic "check hours" caution.
`;
