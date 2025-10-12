// src/types/trip.ts
import { z } from "zod";

export type TripInput = {
  origin?: string;
  regions: string[];
  startDate?: string;
  days: number;
  travelers?: number;
  budgetTier?: "low" | "mid" | "high";
  interests: string[];
  pace?: "relaxed" | "balanced" | "tight";
  dietary?: string[];
  language?: string;
};

export type TravelMode = "walk" | "transit" | "car";

export type Place = {
  id?: string;
  name: string;
  category: "food" | "sight" | "activity" | "cafe" | "shop" | "transport" | "hotel";
  address?: string;
  lat?: number;
  lng?: number;
  estimatedCostKRW?: number;
  durationMin?: number;
  openHoursNote?: string;
  notes?: string[];
  imageUrl?: string;
};

export type TripItem = {
  id?: string;
  time?: string;
  place: Place;
  tips?: string;
  locked?: boolean;
};

export type DayPlan = {
  date?: string;
  theme?: string;
  items: TripItem[];
};

export type TripPlan = {
  title: string;
  summary?: string[];
  days: DayPlan[];
  overallBudgetKRW?: number;
  cautions?: string[];
};

/* ---------------- Zod Schemas (런타임 검증용) ---------------- */
export const PlaceSchema = z.object({
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
});

export const TripItemSchema = z.object({
  id: z.string().optional(),
  time: z.string().optional(),
  place: PlaceSchema,
  tips: z.string().optional(),
  locked: z.boolean().optional(),
});

export const DayPlanSchema = z.object({
  date: z.string().optional(),
  theme: z.string().optional(),
  items: z.array(TripItemSchema),
});

export const TripPlanSchema = z.object({
  title: z.string(),
  summary: z.array(z.string()).optional(),
  days: z.array(DayPlanSchema),
  overallBudgetKRW: z.number().optional(),
  cautions: z.array(z.string()).optional(),
});

export const TripInputSchema = z.object({
  origin: z.string().optional(),
  regions: z.array(z.string()),
  startDate: z.string().optional(),
  days: z.number().int().min(1),
  travelers: z.number().int().min(1).optional().default(1),
  budgetTier: z.enum(["low","mid","high"]).optional(),
  interests: z.array(z.string()).optional().default([]),   // ← 없으면 []로 채워줌
  pace: z.enum(["relaxed","balanced","tight"]).optional(),
  dietary: z.array(z.string()).optional(),
  language: z.string().optional(),
});

/** TS 타입 추론이 필요하면 아래 타입도 사용 가능 */
// export type TripInputParsed = z.infer<typeof TripInputSchema>;
// export type TripPlanParsed = z.infer<typeof TripPlanSchema>;
