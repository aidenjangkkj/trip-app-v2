"use client";

import { useMemo, useState } from "react";
import TripMap from "@/components/TripMap";
import type { TripItem } from "@/types/trip";

export default function DemoPage() {
  // 도쿄 근처 3개 포인트 (food → cafe → hotel)
  const demoItems = useMemo<TripItem[]>(() => [
    {
      id: "a1",
      time: "11:30",
      locked: false,
      place: {
        name: "스시 사이토",
        category: "food",
        address: "Minato City, Tokyo",
        lat: 35.6650,
        lng: 139.7300,
        estimatedCostKRW: 80000,
        durationMin: 90,
        notes: ["예약 필수", "도쿄메트로 롯폰기역 도보 7분"]
      },
      tips: "오마카세 코스, 취소 정책 확인"
    },
    {
      id: "a2",
      time: "14:00",
      locked: false,
      place: {
        name: "Blue Bottle Kiyosumi",
        category: "cafe",
        address: "Koto City, Tokyo",
        lat: 35.6790,
        lng: 139.7990,
        estimatedCostKRW: 8000,
        durationMin: 45,
        notes: ["기요스미 시라카와역 도보 5분"]
      },
      tips: "시그니처 드립 추천"
    },
    {
      id: "a3",
      time: "16:30",
      locked: false,
      place: {
        name: "Hotel Niwa Tokyo",
        category: "hotel",
        address: "Chiyoda City, Tokyo",
        lat: 35.7010,
        lng: 139.7520,
        durationMin: 0,
        notes: ["JR 스이도바시역 도보 5분"]
      },
      tips: "체크인 전 짐 보관 가능"
    }
  ], []);

  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <main className="min-h-screen bg-neutral-50">
      <section className="max-w-5xl mx-auto p-6 space-y-6">
        <h1 className="text-2xl font-bold">TripMap 미니 데모</h1>

        {/* 지도 */}
        <TripMap
          items={demoItems}
          selectedId={selectedId}
          onSelect={(id) => setSelectedId(id)}
          mode="walk"
        />

        {/* 리스트(선택 하이라이트 확인용) */}
        <ol className="grid gap-3">
          {demoItems.map((it) => (
            <li
              key={it.id}
              onClick={() => setSelectedId(it.id ?? null)}
              className={`cursor-pointer bg-white rounded-xl p-4 shadow border
                ${selectedId === it.id ? "border-blue-500 ring-2 ring-blue-200" : "border-transparent"}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-medium">
                    {it.place.name} <span className="text-xs text-neutral-500">#{it.place.category}</span>
                  </div>
                  <div className="text-sm text-neutral-600">{it.time ?? "-"}</div>
                  {it.tips && <div className="text-sm mt-1">💡 {it.tips}</div>}
                </div>
                <button
                  className="text-xs px-3 py-1 rounded-full border"
                  onClick={(e) => { e.stopPropagation(); setSelectedId(it.id ?? null); }}
                >
                  선택
                </button>
              </div>
            </li>
          ))}
        </ol>

        <p className="text-sm text-neutral-600">
          ⓘ 줌 아웃 시 파란 원(클러스터)만 보이다가, 확대(약 14 이상)하면 카테고리별 아이콘과 라벨이 보입니다.
          지도 아이콘을 클릭하면 해당 카드가 파란색으로 하이라이트됩니다.
        </p>
      </section>
    </main>
  );
}
