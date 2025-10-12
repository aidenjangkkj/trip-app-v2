// trip-app-v2/src/components/DayBlock.tsx

"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import TripMap from "@/components/TripMap";
import type { TripPlan, TripItem, TravelMode } from "@/types/trip";

import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// 개별 아이템(드래그 가능)
function SortableItem({
  item,
  selected,
  onLockToggle,
  onRegenerate,
  onAlternatives,
  onPick,
}: {
  item: TripItem;
  selected?: boolean;
  onLockToggle: (id: string) => void;
  onRegenerate: (id: string) => void;
  onAlternatives: (id: string) => void;
  onPick: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: item.id!,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    border: selected ? "2px solid #2563eb" : undefined,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex gap-3 bg-white rounded-xl p-3 shadow border"
      onClick={() => onPick(item.id!)}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab px-2 text-neutral-500"
        aria-label="drag"
      >
        ↕
      </button>

      <div className="flex-1">
        <div className="font-medium">
          {item.place.name}{" "}
          <span className="text-xs text-neutral-500">#{item.place.category}</span>
        </div>
        <div className="text-sm text-neutral-600">{item.time ?? "-"}</div>
        {item.tips && <div className="text-sm mt-1">💡 {item.tips}</div>}

        <div className="flex gap-2 mt-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onLockToggle(item.id!);
            }}
            className="text-xs border rounded px-2 py-1"
          >
            {item.locked ? "🔓 해제" : "🔒 고정"}
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onRegenerate(item.id!);
            }}
            className="text-xs border rounded px-2 py-1"
          >
            ↻ 이 블록만 재추천
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onAlternatives(item.id!);
            }}
            className="text-xs border rounded px-2 py-1"
          >
            ✨ 대안 3개
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onPick(item.id!);
            }}
            className="ml-auto text-xs border rounded px-2 py-1"
          >
            선택
          </button>
        </div>
      </div>

      {typeof item.place.estimatedCostKRW === "number" && (
        <div className="text-sm whitespace-nowrap self-start">
          {item.place.estimatedCostKRW.toLocaleString()}원
        </div>
      )}
    </li>
  );
}

export default function DayBlock({
  day,
  dayIndex,
  onChange,
  onHighlight,
}: {
  day: TripPlan["days"][number];
  dayIndex: number;
  onChange: (nextItems: TripItem[]) => void;
  onHighlight: (id: string) => void;
}) {
  const [mode, setMode] = useState<TravelMode>("walk");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // 혹시 id가 비어있는 아이템이 있으면 생성해서 반영
  useEffect(() => {
    const missing = day.items.some((it) => !it.id);
    if (missing) {
      const next = day.items.map((it) => ({
        id: it.id ?? (typeof crypto !== "undefined" ? crypto.randomUUID() : String(Math.random())),
        ...it,
      })) as TripItem[];
      onChange(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day.items]);

  const itemIds = useMemo(() => day.items.map((i) => i.id!), [day.items]);

  const handleDragEnd = useCallback((e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = day.items.findIndex((i) => i.id === active.id);
    const newIndex = day.items.findIndex((i) => i.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onChange(arrayMove(day.items, oldIndex, newIndex));
  }, [day.items, onChange]);

  const onLockToggle = useCallback((id: string) => {
    onChange(
      day.items.map((it) => (it.id === id ? { ...it, locked: !it.locked } : it))
    );
  }, [day.items, onChange]);

  const onPick = useCallback((id: string) => {
    setSelectedId(id ?? null);
    onHighlight(id);
  }, [onHighlight]);

  const onRegenerate = useCallback(async (id: string) => {
    const target = day.items.find((i) => i.id === id);
    if (!target) return;
    try {
      const res = await fetch("/api/items/regen", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dayIndex, item: target }),
      });
      const json: unknown = await res.json();
      const ok = typeof json === "object" && json !== null && "item" in json;
      if (res.ok && ok) {
        const nextItem = (json as { item: TripItem }).item;
        onChange(day.items.map((it) => (it.id === id ? { ...nextItem, id } : it)));
      } else {
        const errMsg = (json as { error?: string })?.error ?? "재추천 실패";
        alert(errMsg);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      alert(msg || "재추천 실패");
    }
  }, [day.items, dayIndex, onChange]);

  const onAlternatives = useCallback(async (id: string) => {
    const target = day.items.find((i) => i.id === id);
    if (!target) return;

    try {
      // 🛠 서버의 최신 시그니처와 일치: { dayIndex, item }
      const res = await fetch("/api/items/alternatives", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dayIndex, item: target }),
      });

      const json: unknown = await res.json();
      const candidates =
        (Array.isArray((json as { candidates?: unknown })?.candidates)
          ? (json as { candidates: TripItem[] }).candidates
          : null);

      if (res.ok && candidates) {
        const menu = candidates
          .map((c, i) => `${i + 1}) ${c?.place?.name ?? "-"}`)
          .join("\n");
        const pick = prompt(`${menu}\n\n번호를 입력하세요`);
        const idx = Number(pick) - 1;

        if (!Number.isNaN(idx) && candidates[idx]) {
          const next = day.items.map((it) =>
            it.id === id ? { ...candidates[idx], id, locked: false } : it
          );
          onChange(next);
        }
      } else {
        const errMsg = (json as { error?: string })?.error ?? "대안 조회 실패";
        alert(errMsg);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      alert(msg || "대안 조회 실패");
    }
  }, [day.items, dayIndex, onChange]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h3 className="font-semibold">
          Day {dayIndex + 1}
          {day.theme ? ` · ${day.theme}` : ""}
        </h3>
        <select
          className="border rounded px-2 py-1 text-sm"
          value={mode}
          onChange={(e) => setMode(e.target.value as TravelMode)}
        >
          <option value="walk">도보</option>
          <option value="transit">대중교통</option>
          <option value="car">자동차</option>
        </select>
      </div>

      {/* 지도 */}
      <TripMap
        items={day.items}
        mode={mode}
        selectedId={selectedId}
        onSelect={(id) => onPick(id)}
        clustered
      />

      {/* 리스트 (드래그 정렬 가능) */}
      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
          <ol className="space-y-2">
            {day.items.map((it) => (
              <SortableItem
                key={it.id!}
                item={it}
                selected={selectedId === it.id}
                onLockToggle={onLockToggle}
                onRegenerate={onRegenerate}
                onAlternatives={onAlternatives}
                onPick={onPick}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
    </div>
  );
}
