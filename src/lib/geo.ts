export type TravelMode = "walk" | "transit" | "car";

// 단순 Haversine (km)
export function haversineKm(a: {lat:number; lng:number}, b: {lat:number; lng:number}) {
  const toRad = (d:number)=> d*Math.PI/180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)**2;
  return 2*R*Math.asin(Math.sqrt(h));
}

// 대략 속도 기준(보수적)
const SPEED_KMPH: Record<TravelMode, number> = {
  walk: 4.0,
  transit: 20.0, // 환승 포함 러프
  car: 30.0,     // 도심부 평균 보수치
};

export function estimateTravelMinutes(km: number, mode: TravelMode) {
  const h = km / SPEED_KMPH[mode];
  // 기본 대기/환승 페널티
  const penalty = mode === "transit" ? 10 : mode === "car" ? 5 : 0;
  return Math.round(h * 60 + penalty);
}
