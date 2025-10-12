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
  id?: string;              // 클라이언트에서 부여하는 식별자
  time?: string;
  place: Place;
  tips?: string;
  locked?: boolean;         // 🔒 고정
};

export type DayPlan = {
  date?: string;
  theme?: string;
  items: TripItem[];        // ← 기존 Array<{time,place,tips}> → TripItem[]
};

export type TripPlan = {
  title: string;
  summary?: string[];
  days: DayPlan[];
  overallBudgetKRW?: number;
  cautions?: string[];
};
