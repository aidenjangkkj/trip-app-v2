import type { TripPlan, TripItem } from "@/types/trip";

export async function enrichPlanCoordinates(plan: TripPlan, regionHint?: string, language = "ko") {
  const missing: { id: string; name: string; address?: string }[] = [];
  plan.days.forEach(d => {
    d.items.forEach(it => {
      const has = typeof it.place.lat === "number" && typeof it.place.lng === "number";
      if (!has) missing.push({ id: it.id!, name: it.place.name, address: it.place.address });
    });
  });
  if (missing.length === 0) return plan;

  const r = await fetch("/api/geo/batch", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ items: missing, regionHint, language }),
  });
  const data = await r.json();
  if (!data?.ok) return plan;

  const map: Record<string, { lat?: number; lng?: number; place_name?: string }> = data.result || {};
  const next: TripPlan = JSON.parse(JSON.stringify(plan));
  next.days.forEach(d => {
    d.items = d.items.map((it: TripItem) => {
      const hit = map[it.id!];
      if (hit?.lat != null && hit?.lng != null) {
        return { ...it, place: { ...it.place, lat: hit.lat, lng: hit.lng, address: it.place.address ?? hit.place_name } };
      }
      return it;
    });
  });
  return next;
}
