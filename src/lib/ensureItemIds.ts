import { TripPlan, TripItem } from "@/types/trip";

let globalCounter = 0;

function assignIdToItem(item: TripItem): TripItem {
  if (!item.id) {
    item.id = `trip-item-${globalCounter++}`;
  }
  return item;
}

export function ensureItemIds(plan: TripPlan): TripPlan {
  const copy: TripPlan = JSON.parse(JSON.stringify(plan));

  copy.days = copy.days.map((day) => ({
    ...day,
    items: day.items.map(assignIdToItem),
  }));

  return copy;
}
